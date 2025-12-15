import Decimal from '../infrastructure/decimal.mjs';
import { DateTimeUtils } from './utils/DateTimeUitls.js';
import { ValidateUtils } from '../infrastructure/ValidateUtils.js';
/**
 * Entity_Base - 系统基础实体基类
 *
 * 提供常见实体的基础字段与工具：
 * - 私有字段 `#id`, `#createdAt`, `#updatedAt`（通过 getter 暴露）
 * - `updateTime()`：更新实例的更新时间戳
 * - `toSerializable()`：通过实例 getter 自动生成可序列化的原始数据结构，
 *   其叶子值被规范为原始可序列化类型（string、number、boolean、null），便于持久化/比较/日志记录等场景。
 *
 * 序列化要点：
 * - 支持 Array / Map / Set / Object，保持容器结构但将叶子值转换为字符串
 * - 支持 Decimal（使用 toString()）
 * - 若对象实现 `toSerializable(opts)` 实例方法，将优先使用其返回值进行递归序列化
 * - 采用 WeakSet 防止循环引用；若遇到循环则返回 `undefined` 以标示不可序列化
 *
 * @example
 * const e = new Entity_Base('uuid-...');
 * console.log(e.toSerializable());
 *
 * @class Entity_Base
 */
export default class Entity_Base {

    #entityModelVersion; // 实体模型版本号
    /** @private {string} 标准化后的 UUID */
    #id;
    /** @private {string} 创建时间，格式 YYYYMMDD_HHMMSS */
    #createdAt;
    /** @private {string} 更新时间，格式 YYYYMMDD_HHMMSS */
    #updatedAt;

    /**
     * 构造一个基础实体实例。
     * @param {string} id - 实体唯一标识（UUID 字符串），会通过 ValidateUtil 校验/标准化
     * @param {Date|string|null} [createdAt=null] - 可选的创建时间，支持 Date 实例或可解析的时间字符串；为空则取当前时间
     * @param {Date|string|null} [updatedAt=null] - 可选的更新时间，支持 Date 或字符串；为空则取当前时间
     */
    constructor(id, createdAt = null, updatedAt = null, entityModelVersion = null) {
        this.#id = ValidateUtils.stringIsStandardUUID(id);
        const now = DateTimeUtils.to_yyyymmdd_hhmmss(new Date());
        this.#createdAt = createdAt
            ? DateTimeUtils.to_yyyymmdd_hhmmss(createdAt)
            : now;
        this.#updatedAt = updatedAt
            ? DateTimeUtils.to_yyyymmdd_hhmmss(updatedAt)
            : now;
        this.#entityModelVersion = entityModelVersion;
    }

    /** 获取实体唯一 ID（标准化后的 UUID） @returns {string} */
    get id() { return this.#id; }
    /** 获取创建时间（YYYYMMDD_HHMMSS） @returns {string} */
    get createdAt() { return this.#createdAt; }
    /** 获取更新时间（YYYYMMDD_HHMMSS） @returns {string} */
    get updatedAt() { return this.#updatedAt; }

    /**
     * 更新实例的 `updatedAt` 为当前时间（格式由 DateTimeUtil.to_yyyymmdd_hhmmss 决定）
     * @returns {void}
     */
    updateTime() {
        const now = new Date();
        this.#updatedAt = DateTimeUtils.to_yyyymmdd_hhmmss(now);
    }

    /**
     * 私有静态：将任意 JS 值转换为“可序列化”的原始结构。
     * 行为要点：
     * - 对于原始类型（number/string/boolean/null/undefined）返回字符串形式
     * - 对于 Decimal 使用 toString()
     * - 对于 Array/Set/Map/Object 遍历并递归处理，保留容器结构
     * - 优先调用对象的实例方法 `toSerializable(opts)`（若存在），并继续对其返回值进行处理
     * - 使用 WeakSet 跟踪已访问对象以避免循环引用；遇到循环引用返回 `undefined` 表示不可序列化
     * - 对函数、symbol 等不可序列化的类型返回 `undefined`
     *
     * @private
     * @param {any} value 要序列化的值
     * @param {Object} [opts] 可选项，透传给自定义 `toSerializable` 方法
     * @param {WeakSet} [_seen] 内部使用的 WeakSet，用于循环引用检测
     * @returns {any|undefined} 序列化结果（叶子为字符串），遇到不可序列化的值返回 `undefined`
     */
    static #toSerializableValue(value, opts = {}, _seen = new WeakSet()) {
        // 保持 null 和 undefined 原样：
        // - null -> null（便于 JSON 表示）
        // - undefined -> undefined（作为不可序列化/缺失的标记，由上层决定是否省略该键）
        if (value === null) return null;
        if (value === undefined) return undefined;

        // Decimal 以字符串形式输出
        if (typeof Decimal !== 'undefined' && value instanceof Decimal) {
            return value.toString();
        }

        const t = typeof value;

        // 原始类型（number、string、boolean）保留其原始类型
        if (t === 'number' || t === 'string' || t === 'boolean') {
            return value;
        }

        // 函数、symbol 等不可序列化 -> 返回 undefined 标示不可序列化
        if (t !== 'object') return undefined;

        // 对象类型，检查循环引用
        if (_seen.has(value)) return undefined;
        _seen.add(value);

        // 如果对象实现了 toSerializable 实例方法，优先调用，并继续处理其返回值
        if (typeof value.toSerializable === 'function') {
            try {
                const res = value.toSerializable(opts);
                return this.#toSerializableValue(res, opts, _seen);
            } catch (e) {
                // 若自定义序列化失败，回退到通用处理
            }
        }

        // 如果对象在其原型链上定义了 getter（如多数领域模型通过 getter 暴露属性），
        // 则优先基于 getter 来序列化该对象的可访问属性。
        // 这可以保证使用私有字段 + getter 实现的类实例能被正确序列化为对象。
        let protoForCheck = Object.getPrototypeOf(value);
        let hasGetter = false;
        while (protoForCheck && protoForCheck !== Object.prototype) {
            const names = Object.getOwnPropertyNames(protoForCheck);
            for (const n of names) {
                const desc = Object.getOwnPropertyDescriptor(protoForCheck, n);
                if (desc && typeof desc.get === 'function') { hasGetter = true; break; }
            }
            if (hasGetter) break;
            protoForCheck = Object.getPrototypeOf(protoForCheck);
        }
        if (hasGetter) {
            return this.#serializeByGetters(value, opts, _seen);
        }

        // Array -> 递归为数组，元素为字符串或嵌套结构
        if (Array.isArray(value)) {
            return value.map((v) => this.#toSerializableValue(v, opts, _seen));
        }

        // Map -> 转为对象，键为字符串，值递归处理
        if (value instanceof Map) {
            const obj = {};
            for (const [k, v] of value.entries()) {
                obj[String(k)] = this.#toSerializableValue(v, opts, _seen);
            }
            return obj;
        }

        // Set -> 转为数组
        if (value instanceof Set) {
            return Array.from(value).map((v) => this.#toSerializableValue(v, opts, _seen));
        }

        // 普通对象：仅遍历可枚举键
        const out = {};
        for (const key of Object.keys(value)) {
            out[key] = this.#toSerializableValue(value[key], opts, _seen);
        }
        return out;
    }

    /**
     * 私有静态：通过实例的所有 getter（包含父类）收集属性并序列化。
     * 行为说明：
     * - 从实例的原型链向上遍历（直到 Object.prototype），收集所有带 getter 的属性名
     * - 对每个 getter 调用 instance[name]，并将结果通过 #toSerializableValue 处理
     * - 若某个 getter 调用抛错，则该字段被设置为字符串形式的 `undefined`
     *
     * @private
     * @param {Object} instance 要序列化的实例
     * @param {Object} [opts] 透传选项，会传给 #toSerializableValue（以及自定义 toSerializable 方法）
     * @returns {Object} 返回一个普通对象，包含通过 getter 收集并序列化后的键值（叶子为字符串或嵌套结构）
     */
    static #serializeByGetters(instance, opts = {}) {
        if (!instance || typeof instance !== 'object') {
            throw new TypeError('instance 必须为对象');
        }

        const out = {};
        let proto = Object.getPrototypeOf(instance);
        const seenProps = new Set();

        while (proto && proto !== Object.prototype) {
            for (const name of Object.getOwnPropertyNames(proto)) {
                if (seenProps.has(name)) continue;
                seenProps.add(name);
                const desc = Object.getOwnPropertyDescriptor(proto, name);
                if (desc && typeof desc.get === 'function') {
                    try {
                        const val = instance[name];
                        out[name] = this.#toSerializableValue(val, opts);
                    } catch (e) {
                        out[name] = undefined;
                    }
                }
            }
            proto = Object.getPrototypeOf(proto);
        }

        return out;
    }

    /**
     * 将当前实例序列化为原始对象结构，常用于存储、对比或调试输出。
     * 返回结果保证叶子值为字符串（便于存储/比较），结构保留容器类型（对象/数组等）。
     *
     * @param {Object} [opts] 透传选项，传给内部序列化逻辑或实例自定义的 `toSerializable` 方法
     * @returns {Object} 可序列化的普通对象
     */
    toSerializable(opts = {}) {
        return Entity_Base.#serializeByGetters(this, opts);
    }

    /**
     * 兼容性方法：旧代码可能调用 `Serializable()`，此处保持兼容并代理到 `toSerializable()`。
     * @deprecated 推荐使用 `toSerializable()`。
     */
    Serializable(opts = {}) {
        return this.toSerializable(opts);
    }
}
