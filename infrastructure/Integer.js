import Decimal from './decimal.mjs';

export default class Integer {

    static ROUND_DEFAULT = Decimal.ROUND_UP;
    static ROUND_UP = Decimal.ROUND_UP;
    static ROUND_DOWN = Decimal.ROUND_DOWN;
    static ROUND_CEIL = Decimal.ROUND_CEIL;
    static ROUND_FLOOR = Decimal.ROUND_FLOOR;
    static ROUND_HALF_UP = Decimal.ROUND_HALF_UP;
    static ROUND_HALF_DOWN = Decimal.ROUND_HALF_DOWN;
    static ROUND_HALF_EVEN = Decimal.ROUND_HALF_EVEN;
    static ROUND_HALF_CEIL = Decimal.ROUND_HALF_CEIL;
    static ROUND_HALF_FLOOR = Decimal.ROUND_HALF_FLOOR;

    static DEFAULT_PECISION = 0;

    static DEFAULT_OPTIONS = {
        // - 前缀符号，用于显示时组合使用。
        prefix: '',
        // - 后缀符号，用于显示时组合使用。
        suffix: '',
        // - 允许的最小值
        min: undefined,
        // - 允许的最大值
        max: undefined,
        // - 最小值是否包含边界
        inclusiveMin: true,
        // - 最大值是否包含边界
        inclusiveMax: true,
        // - 是否允许负值
        allowNegative: true,
        // - 是否允许正值
        allowPositive: true,
        // - 是否允许零值
        allowZero: true,
        // - 舍入模式           
        rounding: Integer.ROUND_DEFAULT,
    };

    /** @type {Decimal} - 数值 */
    #value;
    /** @type {Object} - 选项配置 */
    #options;

    get value() { return this.#value; }
    get options() { return { ...this.#options }; }

    constructor(value, options) {
        // - 类型验证 1
        if (!(typeof value === 'number') &&
            !(typeof value === 'string') &&
            !(value instanceof Decimal) &&
            !(value instanceof Integer)) {
            throw new TypeError('Integer.value must be one of: number, string, Decimal, Integer, Integer');
        }

        if (typeof value === 'number') {
            // - 处理极端数值，防止科学计数法带来不可预期的问题。
            if (!isFinite(value)) {
                throw new IntegerError('Integer.value cannot be NaN or Infinite');
            }
        }

        if (typeof value === 'string') value = this.#cleanNumericString(value);

        // - 类型验证通过，开始处理逻辑

        // - copy constructor 拷贝构造
        if (value instanceof Integer) {
            const origin = value;
            value = origin.value;
            // - 如果调用时未提供 options，则沿用原 Integer 实例的设置。注意：{}视为有效参数。
            if (options === undefined || options === null) { options = origin.options; }
        }

        // - 先赋值
        try {
            this.#options = { ...Integer.DEFAULT_OPTIONS, ...Object.fromEntries(Object.entries(options ?? {}).filter(([, v]) => v !== undefined && v !== null)) };
            this.#value = new Decimal(value).toDecimalPlaces(Integer.DEFAULT_PECISION, this.#options.rounding);
        } catch (e) {
            // - 先原样抛出异常，暂时没什么要处理的。
            // - 如果之后有需要，可以在这里添加处理逻辑。
            throw e;
        }

        // - 后校验
        const { min, max, inclusiveMin, inclusiveMax } = this.#options;
        if (min !== undefined && min !== null) {
            // - 换什么行啊，怎么，没有宽屏显示器？
            const minRaw = typeof min === 'string' ? this.#cleanNumericString(min) : (min instanceof Integer || min instanceof Integer) ? min.value : min;
            const minDec = minRaw instanceof Decimal ? minRaw : new Decimal(minRaw);
            const cmp = this.#value.comparedTo(minDec);
            if (cmp < 0 || (cmp === 0 && !inclusiveMin)) {
                throw new IntegerError(`${this.#value.toString()}小于最小允许值${minDec.toString()}${inclusiveMin ? '（闭区间包含）' : '（开区间不含）'}`);
            }
        }
        if (max !== undefined && max !== null) {
            // - 换什么行啊，怎么，没有宽屏显示器？
            const maxRaw = typeof max === 'string' ? this.#cleanNumericString(max) : (max instanceof Integer || max instanceof Integer) ? max.value : max;
            const maxDec = maxRaw instanceof Decimal ? maxRaw : new Decimal(maxRaw);
            const cmp = this.#value.comparedTo(maxDec);
            if (cmp > 0 || (cmp === 0 && !inclusiveMax)) {
                throw new IntegerError(`${this.#value.toString()}大于最大允许值${maxDec.toString()}${inclusiveMax ? '（闭区间包含）' : '（开区间不含）'}`);
            }
        }

        const { allowNegative, allowPositive, allowZero } = this.#options;
        if (!allowNegative && this.#value.isNegative()) {
            throw new IntegerError(`不允许负值，但传入了${this.#value.toString()}`);
        }
        if (!allowPositive && this.#value.isPositive()) {
            throw new IntegerError(`不允许正值，但传入了${this.#value.toString()}`);
        }
        if (!allowZero && this.#value.isZero()) {
            throw new IntegerError(`不允许零值，但传入了${this.#value.toString()}`);
        }
    }

    plus(integer, options = {}) {
        if (!(integer instanceof Integer)) throw new TypeError('传入的 integer 必须是 Integer 实例');
        return new Integer(this.#value.plus(integer.value), options);
    }

    minus(integer, options = {}) {
        if (!(integer instanceof Integer)) throw new TypeError('传入的 integer 必须是 Integer 实例');
        return new Integer(this.#value.minus(integer.value), options);
    }

    times(factor, options = {}) {
        if (factor instanceof Integer) factor = factor.value;
        if (typeof factor === 'string') factor = this.#cleanNumericString(factor);
        const d = factor instanceof Decimal ? factor : new Decimal(factor);
        return new Integer(this.#value.times(d), options);
    }

    dividedBy(divisor, options = {}) {
        if (divisor instanceof Integer) divisor = divisor.value;
        if (typeof divisor === 'string') divisor = this.#cleanNumericString(divisor);
        const d = divisor instanceof Decimal ? divisor : new Decimal(divisor);
        return new Integer(this.#value.dividedBy(d), options);
    }

    toNumber() {
        return this.#value.toNumber();
    }

    /**
     * @description 输出数值的字符串形式.
     * @returns {string} - 返回金额的字符串形式。
     */
    toString() {
        return this.#value.toString();
    }

    /**
     * @param {Object} options - 本地化选项，参考 JavaScript 的 toLocaleString 方法的选项参数。
     * @param {string|string[]} locale - 本地化语言代码，默认值为 'zh-CN'。
     * @description 将数值格式化为本地化的字符串形式。
     * @returns {string} - 返回本地化格式的字符串。
     */
    toLocaleString(options = {}, locale = 'zh-CN') {
        return this.#value.toNumber().toLocaleString(locale, options);
    }

    /**
     * @param {Integer} integer - 要比较的 Integer 实例。类型不匹配时直接返回 false。
     * @description 比较当前 Integer 实例与另一个 Integer 实例的数值是否相等。
     * @returns {boolean} - 如果数值相等则返回 true，否则返回 false。
     */
    equals(integer) {
        if (!(integer instanceof Integer)) return false;
        return this.#value.equals(integer.value);
    }
    /**
     * @param {Integer} integer - 要比较的 Integer 实例。类型不匹配时直接返回 true。
     * @description 比较当前 Integer 实例与另一个 Integer 实例的数值是否不相等。
     * @returns {boolean} - 如果数值不相等则返回 true，否则返回 false。
     */
    notEquals(integer) {
        if (!(integer instanceof Integer)) return true;
        return !this.#value.equals(integer.value);
    }
    /**
     * @param {Integer} integer - 要比较的 Integer 实例。
     * @description 判断当前 Integer 实例的数值是否大于另一个 Integer 实例的数值。
     * @returns {boolean} - 如果当前实例的数值大于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 Integer 不是 Integer 实例时抛出。
     */
    greaterThan(integer) {
        if (!(integer instanceof Integer)) throw new TypeError('Must compare with Integer');
        return this.#value.greaterThan(integer.value);
    }
    /**
     * @param {Integer} integer - 要比较的 Integer 实例。
     * @description 判断当前 Integer 实例的数值是否小于另一个 Integer 实例的数值。
     * @returns {boolean} - 如果当前实例的数值小于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 Integer 不是 Integer 实例时抛出。
     */
    lessThan(integer) {
        if (!(integer instanceof Integer)) throw new TypeError('Must compare with Integer');
        return this.#value.lessThan(integer.value);
    }
    /**
     * @param {Integer} integer - 要比较的 Integer 实例。
     * @description 判断当前 Integer 实例的数值是否大于或等于另一个 Integer 实例的数值。
     * @returns {boolean} - 如果当前实例的数值大于或等于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 Integer 不是 Integer 实例时抛出。
     */
    greaterThanOrEqual(integer) {
        if (!(integer instanceof Integer)) throw new TypeError('Must compare with Integer');
        return this.#value.greaterThanOrEqualTo(integer.value);
    }
    /**
     * @param {Integer} integer - 要比较的 Integer 实例。
     * @description 判断当前 Integer 实例的数值是否小于或等于另一个 Integer 实例的数值。
     * @returns {boolean} - 如果当前实例的数值小于或等于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 Integer 不是 Integer 实例时抛出。
     */
    lessThanOrEqual(integer) {
        if (!(integer instanceof Integer)) throw new TypeError('Must compare with Integer');
        return this.#value.lessThanOrEqualTo(integer.value);
    }
    /**
     * @param {Integer} integer - 要比较的 Integer 实例。
     * @description 比较当前 Integer 实例与另一个 Integer 实例的数值大小。内部使用的是 Decimal 的 comparedTo 方法。
     * @returns {number} - 如果当前实例的数值小于传入实例的数值则返回 -1，等于则返回 0，大于则返回 1。
     * @throws {TypeError} - 当传入的 Integer 不是 Integer 实例时抛出。
     */
    comparedTo(integer) {
        if (!(integer instanceof Integer)) throw new TypeError('Must compare with Integer');
        return this.#value.comparedTo(integer.value);
    }

    isZero() { return this.#value.isZero(); }
    isNaN() { return this.#value.isNaN(); }
    isNegative() { return this.#value.isNegative(); }
    isPositive() { return this.#value.isPositive(); }
    isFinite() { return this.#value.isFinite(); }
    isInteger() { return this.#value.isInteger(); }

    /**
     * @param {string|number} input - 要清理的数字字符串，可以是字符串或数字类型。
     * @description 清理并验证数字字符串，移除空白字符、千分位分隔符，支持括号表示负数，确保格式正确。
     * @returns {string} - 返回清理后的数字字符串。
     * @throws {IntegerError} - 当输入为 undefined、null、空字符串或格式不正确时抛出错误。
     */
    #cleanNumericString(input) {
        if (input === undefined || input === null) throw new IntegerError('Numeric input is undefined or null');

        // 总是先统一为字符串
        let str = String(input);

        // 移除空白、不可见空格、英文与中文逗号（千分位分隔符）
        str = str.replace(/[\s\u00A0,，]/g, '').trim();

        // 支持括号表示负数
        const paren = str.match(/^\((.*)\)$/);
        if (paren) str = '-' + paren[1];

        // 检查是否是空字符串
        if (str === '') throw new IntegerError('Numeric string is empty');

        // 限制超长
        if (str.length > 128) throw new IntegerError('Numeric string is too long');

        // 严格校验数字格式：可选负号，数字，最多一个小数点,可以有百分比、千分比、万分比
        // 允许形式："123", "-123", "123.45", "-123.45","123.45%","123.45‰","123.45‱"

        if (!/^-?\d+(?:\.\d+)?(?:[%‰‱])?$/.test(str)) {
            throw new IntegerError('Numeric string 格式不正确');
        }
        return str;
    }
}

/**
 * @class
 * @classdesc IntegerError 类用于表示 Integer 相关的错误，继承自标准的 Error 类。
 */
export
    class IntegerError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IntegerError';
    }
}