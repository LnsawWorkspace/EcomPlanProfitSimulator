import Decimal from './decimal.mjs';
/**
 * Validate 工具集合 — 提供常用的输入校验与转换方法。
 * - 值不符合业务校验时抛出 `ValidateError`。
 * - 类型不匹配时抛出标准的 `TypeError`（例如传入非字符串但预期字符串）。
 * @class ValidateUtils
 */
class ValidateUtils {

    /**
     * 严格校验字符串：不能为空或全为空白字符。
     * - 输入必须为 `string`，否则抛出 `TypeError`。
     * - 值为空或仅包含空白字符时抛出 `ValidateError`。
     * @param {string} value 要校验的字符串
     * @returns {string} 校验通过后的字符串（已 `trim()`）
     * @throws {TypeError} 当 `value` 不是字符串时抛出
     * @throws {ValidateError} 当字符串为空或仅包含空白时抛出
     */
    static stringNotEmptyAndWhitespace(value) {
        if (typeof value !== 'string') {
            throw new TypeError('必须是字符串');
        }
        if (!value || value.trim().length === 0) {
            throw new ValidateError('不能为空');
        }
        return value.trim();
    }
    /**
     * 校验标准 UUID（包含连字符的 36 字符形式，例如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）。
     * - 输入必须为 `string`，否则抛出 `TypeError`。
     * - 值为空或格式不符合时抛出 `ValidateError`。
     * @param {string} uuid 要校验的 UUID 字符串
     * @returns {string} 校验通过后的 UUID（已 `trim()`）
     * @throws {TypeError} 当 `uuid` 不是字符串时抛出
     * @throws {ValidateError} 当为空或不是标准 UUID 格式时抛出
     */
    static stringIsStandardUUID(uuid) {
        if (typeof uuid !== 'string') {
            throw new TypeError('uuid必须是字符串');
        }
        if (!uuid || uuid.trim().length === 0) {
            throw new ValidateError('不能为空');
        }
        const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!guidRegex.test(uuid)) {
            throw new ValidateError('不是标准的UUID格式');
        }
        return uuid.trim();
    }
    /**
     * 校验 UUID（支持带连字符的标准 36 字符和不带连字符的 32 字符两种格式）。
     * - 输入必须为 `string`，否则抛出 `TypeError`。
     * - 值为空或格式不匹配时抛出 `ValidateError`。
     * @param {string} uuid 要校验的 UUID 字符串（32 或 36 字符格式）
     * @returns {string} 校验通过后的 UUID（已 `trim()`）
     * @throws {TypeError} 当 `uuid` 不是字符串时抛出
     * @throws {ValidateError} 当为空或不是有效 UUID 格式时抛出
     */
    static stringIsUUID(uuid) {
        if (typeof uuid !== 'string') {
            throw new TypeError('uuid必须是字符串');
        }
        if (!uuid || uuid.trim().length === 0) {
            throw new ValidateError('不能为空');
        }
        const uuidRegex = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F]{32})$/;
        if (!uuidRegex.test(uuid)) {
            throw new ValidateError('不是有效的UUID格式');
        }
        return uuid.trim();
    }

    /**
     * 扩展的布尔值转换器。接受布尔值、数字或字符串，返回布尔值：
     * - 布尔类型原样返回。
     * - 字符串（忽略大小写与两端空白）支持：
     *   - 真值: 'true','1','yes','on','是','对','正确'
     *   - 假值: 'false','0','no','off','否','不对','错误','错'
     * - 数字：大于 0 视为 true，<= 0 视为 false。
     * - 当无法识别时抛出 `TypeError`。
     * @param {boolean|number|string} value 待转换的值
     * @returns {boolean} 转换结果
     * @throws {TypeError} 当值无法解析为布尔时抛出
     */
    static extendedBooleanConverter(value) {
        if (typeof value === 'boolean') return value;

        if (typeof value === 'string') {
            const lowerValue = value.toLowerCase().trim();
            const trueValues = ['true', '1', 'yes', 'on', '是', '对', '正确'];
            const falseValues = ['false', '0', 'no', 'off', '否', '不对', '错误', '错'];

            if (trueValues.includes(lowerValue)) return true;
            if (falseValues.includes(lowerValue)) return false;
        }

        if (typeof value === 'number') {
            if (value > 0) return true;
            if (value <= 0) return false;
        }

        throw new TypeError('无效的布尔值格式');
    }

    /**
     * 清理数字字符串：移除空白与千分符（英文/中文逗号），并支持括号表示负数。
     * - 如果传入非字符串，则会调用 `String(value)` 并返回其结果（便于兼容）。
     * 示例：" 1,234 " -> "1234"；"(123)" -> "-123"。
     * @param {string|any} str 待清理的值，优选字符串
     * @returns {string} 清理并规范化后的字符串
     */
    static cleanNumericString(str) {
        if (typeof str !== 'string') return String(str);
        // 移除空白、不可见空格、英文与中文逗号（千分符）
        let s = str.replace(/[\s\u00A0,，]/g, '').trim();
        // 支持括号表示负数 "(1234)" -> -1234
        const paren = s.match(/^\((.*)\)$/);
        if (paren) s = '-' + paren[1];
        return s;
    }

    /**
     * 通用数字校验器（返回 `number`）。
     * - 仅接受 `string` 或 `number` 类型输入；若传入其他类型会抛出 `TypeError`。
     * - 字符串输入会先通过 `cleanNumericString` 进行清理再转换为 `Number`。
     * - 选项参数示例： `{ allowNegative: false, allowZero: true, integer: true }`。
    * @param {number|string|Decimal} value 要校验的值（字符串、数字，或 `Decimal`）
     * @param {Object} [options]
     * @param {boolean} [options.allowNegative=true] 允许负数
     * @param {boolean} [options.allowPositive=true] 允许正数
     * @param {boolean} [options.allowZero=true] 允许零
     * @param {boolean} [options.integer=false] 是否要求整数
     * @returns {number} 校验并解析后的数字
     * @throws {TypeError} 当输入类型不匹配时抛出
     * @throws {ValidateError} 当值不符合业务规则（例如不允许为负、非整数等）时抛出
     */
    static number(value, options = {}) {
        const {
            allowNegative = true,
            allowPositive = true,
            allowZero = true,
            integer = false
        } = options;

        // 不可能的约束：若同时禁止正数、负数与零，则没有任何数字可满足要求
        if (!allowNegative && !allowPositive && !allowZero) {
            throw new ValidateError('无效的数字约束：allowNegative、allowPositive 和 allowZero 不能同时为 false');
        }

        try {
            let num;
            if (value instanceof Decimal) {
                // Decimal -> number（用于返回 number 的场景），但仍需检测有限性
                const n = value.toNumber();
                if (!Number.isFinite(n)) throw new ValidateError('必须是有限数字');
                num = n;
            } else if (typeof value === 'string') {
                const cleaned = this.cleanNumericString(value);
                if (cleaned.length === 0) throw new Error('必须是数字');
                num = Number(cleaned);
            } else if (typeof value === 'number') {
                num = value;
            } else {
                throw new TypeError('number必须是数字或字符串');
            }

            if (!Number.isFinite(num)) throw new Error('必须是有限数字');

            // 先单独处理 0，0 的允许与否与正负无关
            if (num === 0) {
                if (!allowZero) throw new ValidateError('不允许为0');
                // 如果允许0，则不再对正负做限制
            } else {
                // 非零值再判断正负约束
                if (num < 0 && !allowNegative) throw new ValidateError('不允许为负数');
                if (num > 0 && !allowPositive) throw new ValidateError('不允许为正数');
            }

            if (integer && !Number.isInteger(num)) {
                throw new ValidateError('必须是整数类型');
            }

            return num;
        } catch (err) {
            throw new ValidateError(err?.message || '不是有效的数字格式');
        }
    }
    /**
     * Number 专用范围校验 —— 以原生 `number` 路径解析和比较，返回 `number`。
     *
     * 支持两种调用风格：
     * 1. 对象风格（推荐）：`(value, { min, max, inclusiveMin, inclusiveMax, integer })`
     * 2. 位置参数（兼容旧代码）：`(value, min, max)` — 此时使用默认的 `inclusiveMin=true` 和 `inclusiveMax=true`，且 `integer` 为 `false`。
     *
     * 当采用对象风格时，第二个参数 `optionsOrMin` 支持以下字段：
     * - `min` (number|string|Decimal|null): 最小边界（可省略），支持字符串或 Decimal 表示法。
     * - `max` (number|string|Decimal|null): 最大边界（可省略）。
     * - `inclusiveMin` (boolean, default true): 最小边界是否包含相等值（闭区间左端点）。
     * - `inclusiveMax` (boolean, default true): 最大边界是否包含相等值（闭区间右端点）。
     * - `integer` (boolean, default false): 是否要求被校验值为整数（使用 `Number.isInteger` 判定）。
     *
     * 约定：至少需要指定 `min` 或 `max` 中的一个，否则会抛出 `ValidateError`。
     *
     * 示例：
     * ```js
     * // 对象风格
     * ValidateUtils.numberRange('5.2', { min: 1, max: 10 }); // 解析并返回 number 5.2
     * // 位置参数风格（向后兼容）
     * ValidateUtils.numberRange('5', 1, 10); // 返回 number 5
     * ```
     *
     * @param {number|string|Decimal} value 要校验的值
     * @param {Object|number|null} [optionsOrMin] 配置对象或最小值（当为数字/Decimal 时视为 min）
     * @param {number|null} [maybeMax] 当第二个参数为最小值时，第三个参数为最大值
     * @returns {number} 校验通过后的 number
     * @throws {ValidateError|TypeError}
     */
    static numberRange(value, optionsOrMin = {}, maybeMax = undefined) {
        // 兼容 `(value, min, max)` 调用
        let options = {};
        if (optionsOrMin !== null && (typeof optionsOrMin === 'number' || optionsOrMin instanceof Decimal)) {
            options = { min: optionsOrMin, max: maybeMax };
        } else {
            options = Object.assign({}, optionsOrMin || {});
        }

        const {
            min = null,
            max = null,
            inclusiveMin = true,
            inclusiveMax = true,
        } = options;

        if (min === null && max === null) {
            throw new ValidateError('numberRange 需要至少指定 min 或 max');
        }

        const num = this.number(value, { allowNegative: true, allowPositive: true, allowZero: true, integer });

        const parseNumOrNull = (v) => (v === null || v === undefined) ? null : this.number(v, { allowNegative: true, allowPositive: true, allowZero: true, integer: false });

        const minNum = parseNumOrNull(min);
        const maxNum = parseNumOrNull(max);

        if (minNum !== null) {
            if (num < minNum || (!inclusiveMin && num === minNum)) {
                throw new ValidateError('值小于最小允许值');
            }
        }
        if (maxNum !== null) {
            if (num > maxNum || (!inclusiveMax && num === maxNum)) {
                throw new ValidateError('值大于最大允许值');
            }
        }

        return num;
    }

    /** @param {number|string|Decimal} value 要校验的值
    * @param {Object|number|null} [optionsOrMin] 配置对象或最小值（当为数字/Decimal 时视为 min）
    * @param {number|null} [maybeMax] 当第二个参数为最小值时，第三个参数为最大值
    * @returns {number} 校验通过后的 number
    * @throws {ValidateError|TypeError}
    */
    static numberIntegerRange(value, optionsOrMin = {}, maybeMax = undefined) {
        // 兼容 `(value, min, max)` 调用
        let options = {};
        if (optionsOrMin !== null && (typeof optionsOrMin === 'number' || optionsOrMin instanceof Decimal)) {
            options = { min: optionsOrMin, max: maybeMax };
        } else {
            options = Object.assign({}, optionsOrMin || {});
        }

        const {
            min = null,
            max = null,
            inclusiveMin = true,
            inclusiveMax = true,
        } = options;

        if (min === null && max === null) {
            throw new ValidateError('numberRange 需要至少指定 min 或 max');
        }

        const num = this.number(value, { allowNegative: true, allowPositive: true, allowZero: true, integer: true });

        const parseNumOrNull = (v) => (v === null || v === undefined) ? null : this.number(v, { allowNegative: true, allowPositive: true, allowZero: true, integer: true });

        const minNum = parseNumOrNull(min);
        const maxNum = parseNumOrNull(max);

        if (minNum !== null) {
            if (num < minNum || (!inclusiveMin && num === minNum)) {
                throw new ValidateError('值小于最小允许值');
            }
        }
        if (maxNum !== null) {
            if (num > maxNum || (!inclusiveMax && num === maxNum)) {
                throw new ValidateError('值大于最大允许值');
            }
        }

        return num;
    }

    /**
     * Decimal 校验器（返回 `Decimal` 实例）。
     * - 支持输入类型：`Decimal`、`number`、`string`。
     * - 字符串会先用 `cleanNumericString` 清理后直接构造 `Decimal`，以避免先转换为 `number` 导致的精度丢失。
     * - 配置项与 `number()` 类似，用于控制是否允许负数/正数/零或是否必须为整数。
     *
     * @param {Decimal|number|string} value 要校验的值
     * @param {Object} [options]
     * @param {boolean} [options.allowNegative=true] 允许负数，默认 true
     * @param {boolean} [options.allowPositive=true] 允许正数，默认 true
     * @param {boolean} [options.allowZero=true] 允许零，默认 true
     * @param {boolean} [options.integer=false] 是否要求整数，默认 false（使用 Decimal.isInteger 判定）
     * @returns {Decimal} 校验并返回的 `Decimal` 实例
     * @throws {TypeError} 当输入类型不支持时抛出
     * @throws {ValidateError} 当值不符合约束时抛出（例如不允许为0/负数/非整数等）
     */
    static decimal(value, options = {}) {
        const {
            allowNegative = true,
            allowPositive = true,
            allowZero = true,
            integer = false
        } = options;

        // 不可能的约束：若同时禁止正数、负数与零，则没有任何数字可满足要求
        if (!allowNegative && !allowPositive && !allowZero) {
            throw new ValidateError('无效的数字约束：allowNegative、allowPositive 和 allowZero 不能同时为 false');
        }

        try {
            let dec;
            if (value instanceof Decimal) {
                dec = value;
            } else if (typeof value === 'string') {
                const cleaned = this.cleanNumericString(value);
                if (cleaned.length === 0) throw new TypeError('不是有效的数字');
                try {
                    // 直接使用字符串构造 Decimal，避免先转为 Number 导致精度丢失
                    dec = new Decimal(cleaned);
                } catch (e) {
                    throw new TypeError('不是有效的数字');
                }
            } else if (typeof value === 'number') {
                if (!Number.isFinite(value)) throw new ValidateError('必须是有限数字');
                dec = new Decimal(value);
            } else {
                throw new TypeError('number必须是数字、字符串或Decimal类型');
            }

            // 检查有限性
            if (!dec.isFinite()) throw new ValidateError('必须是有限数字');

            // 先单独处理 0，0 的允许与否与正负无关
            if (dec.isZero()) {
                if (!allowZero) throw new ValidateError('不允许为0');
                // 允许0则跳过正负判断
            } else {
                if (dec.isNegative() && !allowNegative) throw new ValidateError('不允许为负数');
                if (dec.gt(0) && !allowPositive) throw new ValidateError('不允许为正数');
            }

            if (integer && !dec.isInteger()) {
                throw new ValidateError('必须是整数类型');
            }

            return dec;
        } catch (err) {
            throw new ValidateError(err?.message || '不是有效的Decimal格式');
        }
    }
    /**
     * Decimal 专用范围校验 —— 始终使用 `Decimal` 路径解析与比较，返回 `Decimal` 实例。
     *
     * 支持两种调用风格：
     * 1. 对象风格（推荐）：`(value, { min, max, inclusiveMin, inclusiveMax, integer })`
     * 2. 位置参数（兼容旧代码）：`(value, min, max)` — 此时默认 `inclusiveMin=true`、`inclusiveMax=true`。
     *
     * 当采用对象风格时，`optionsOrMin` 支持以下字段：
     * - `min` (number|string|Decimal|null): 最小边界（可省略），支持字符串或 Decimal 表示法。
     * - `max` (number|string|Decimal|null): 最大边界（可省略）。
     * - `inclusiveMin` (boolean, default true): 最小边界是否包含相等值。
     * - `inclusiveMax` (boolean, default true): 最大边界是否包含相等值。
     *
     * 约定：至少要指定 `min` 或 `max` 中的一个，否则函数会抛出 `ValidateError`。
     *
     * 示例：
     * ```js
     * // 对象风格（推荐）
     * ValidateUtils.decimalRange('0.06', { min: 0, max: 1 }); // 返回 Decimal(0.06)
     * // 位置参数风格（向后兼容）
     * ValidateUtils.decimalRange(new Decimal(5), 1, 10); // 返回 Decimal(5)
     * ```
     *
     * @param {number|string|Decimal} value 要校验的值（将解析为 Decimal）
     * @param {Object|number|Decimal|null} [optionsOrMin] 配置对象或最小值（当为数字/Decimal 时视为 min）
     * @param {number|Decimal|null} [maybeMax] 当第二个参数为最小值时，第三个参数为最大值
     * @returns {Decimal} 校验通过后的 Decimal 实例
     * @throws {ValidateError|TypeError}
     */
    static decimalRange(value, optionsOrMin = {}, maybeMax = undefined) {
        // 兼容 `(value, min, max)` 调用
        let options = {};
        if (optionsOrMin !== null && (typeof optionsOrMin === 'number' || optionsOrMin instanceof Decimal)) {
            options = { min: optionsOrMin, max: maybeMax };
        } else {
            options = Object.assign({}, optionsOrMin || {});
        }

        const {
            min = null,
            max = null,
            inclusiveMin = true,
            inclusiveMax = true,
        } = options;

        if (min === null && max === null) {
            throw new ValidateError('decimalRange 需要至少指定 min 或 max');
        }

        const dec = this.decimal(value, { allowNegative: true, allowPositive: true, allowZero: true, integer: false });

        const parseDecOrNull = (v) => (v === null || v === undefined) ? null : this.decimal(v, { allowNegative: true, allowPositive: true, allowZero: true, integer: false });

        const minDec = parseDecOrNull(min);
        const maxDec = parseDecOrNull(max);

        if (minDec !== null) {
            const cmp = dec.cmp(minDec);
            if (cmp < 0 || (cmp === 0 && !inclusiveMin)) {
                throw new ValidateError(`值${dec.toString()}小于最小允许值${minDec.toString()}${inclusiveMin ? '（闭区间包含）' : '（开区间不含）'}`);
            }
        }
        if (maxDec !== null) {
            const cmp = dec.cmp(maxDec);
            if (cmp > 0 || (cmp === 0 && !inclusiveMax)) {
                throw new ValidateError(`值${dec.toString()}大于最大允许值${maxDec.toString()}${inclusiveMax ? '（闭区间包含）' : '（开区间不含）'}`);
            }
        }

        return dec;
    }
    /**
     * Decimal 整数范围校验 —— 与 `decimalRange` 相似，但会强制整数检查（`integer: true`）。
     *
     * 支持的参数与 `decimalRange` 一致：可以使用对象风格 `{ min, max, inclusiveMin, inclusiveMax }`，
     * 或位置参数 `(value, min, max)`，并且在内部会以 `integer: true` 调用 `decimal()` 来保证整数性。
     *
     * @param {number|string|Decimal} value 要校验的值（将解析为 Decimal 并要求为整数）
     * @param {Object|number|Decimal|null} [optionsOrMin] 配置对象或最小值
     * @param {number|Decimal|null} [maybeMax] 当第二个参数为最小值时，第三个参数为最大值
     * @returns {Decimal} 校验通过后的 Decimal（整数）
     * @throws {ValidateError|TypeError}
     */
    static decimalIntegerRange(value, optionsOrMin = {}, maybeMax = undefined) {
        // 兼容 `(value, min, max)` 调用
        let options = {};
        if (optionsOrMin !== null && (typeof optionsOrMin === 'number' || optionsOrMin instanceof Decimal)) {
            options = { min: optionsOrMin, max: maybeMax };
        } else {
            options = Object.assign({}, optionsOrMin || {});
        }

        const {
            min = null,
            max = null,
            inclusiveMin = true,
            inclusiveMax = true,
        } = options;

        if (min === null && max === null) {
            throw new ValidateError('decimalIntegerRange 需要至少指定 min 或 max');
        }

        const dec = this.decimal(value, { allowNegative: true, allowPositive: true, allowZero: true, integer: true });

        const parseDecOrNull = (v) => (v === null || v === undefined) ? null : this.decimal(v, { allowNegative: true, allowPositive: true, allowZero: true, integer: true });

        const minDec = parseDecOrNull(min);
        const maxDec = parseDecOrNull(max);

        if (minDec !== null) {
            const cmp = dec.cmp(minDec);
            if (cmp < 0 || (cmp === 0 && !inclusiveMin)) {
                throw new ValidateError('值小于最小允许值');
            }
        }
        if (maxDec !== null) {
            const cmp = dec.cmp(maxDec);
            if (cmp > 0 || (cmp === 0 && !inclusiveMax)) {
                throw new ValidateError('值大于最大允许值');
            }
        }

        return dec;
    }
}
/**
 * 验证异常类型
 * - 用于表示业务规则校验失败（例如：为空、不允许为负数、格式不合法等）。
 * - 与 `TypeError` 区分：当参数类型不匹配时抛 `TypeError`；当值不满足校验规则时抛 `ValidateError`。
 */
class ValidateError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidateError';
    }
}

export default ValidateUtils;
// 兼容命名导入：允许 `import { ValidateUtils, ValidateError } from '...';`
export { ValidateUtils, ValidateError };

