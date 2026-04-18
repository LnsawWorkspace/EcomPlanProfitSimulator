import Decimal from './decimal.mjs';
import Integer from './Integer.js';

export default class Percentage {

    static ROUND_DEFAULT = Decimal.ROUND_HALF_UP;
    static ROUND_UP = Decimal.ROUND_UP;
    static ROUND_DOWN = Decimal.ROUND_DOWN;
    static ROUND_CEIL = Decimal.ROUND_CEIL;
    static ROUND_FLOOR = Decimal.ROUND_FLOOR;
    static ROUND_HALF_UP = Decimal.ROUND_HALF_UP;
    static ROUND_HALF_DOWN = Decimal.ROUND_HALF_DOWN;
    static ROUND_HALF_EVEN = Decimal.ROUND_HALF_EVEN;
    static ROUND_HALF_CEIL = Decimal.ROUND_HALF_CEIL;
    static ROUND_HALF_FLOOR = Decimal.ROUND_HALF_FLOOR;

    static DEFAULT_OPTIONS = {
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
        rounding: Percentage.ROUND_DEFAULT,
    };

    // - 6位小数精度，0.000001 即百万分之一 ，足够绝大部分场景使用了。
    // - 没有设置更高精度的必要。
    static DEFAULT_PECISION = new Integer(16, { min: 0, integer: true });

    // - 常量 百分之百 百分之一 千分之一 万分之一
    static ONE_HUNDRED_PERCENT = new Percentage(1);
    static ONE_PERCENT = new Percentage(0.01);
    static ONE_TENTH_PERCENT = new Percentage(0.001);
    static ONE_HUNDREDTH_PERCENT = new Percentage(0.0001);

    /** @type {Decimal} - 比例数值 */
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
            !(value instanceof Percentage) &&
            !(value instanceof Integer)) {
            throw new TypeError('Percentage.value must be one of: number, string, Decimal, Integer, Percentage');
        }

        if (typeof value === 'number') {
            // - 处理极端数值，防止科学计数法带来不可预期的问题。
            if (!isFinite(value)) {
                throw new PercentageError('Percentage.value cannot be NaN or Infinite');
            }
        }

        // - copy constructor 拷贝构造
        if (value instanceof Percentage) {
            const origin = value;
            value = origin.value;
            // - 如果调用时未提供 options，则沿用原 Percentage 实例的设置。注意：{}视为有效参数。
            if (options === undefined || options === null) { options = origin.options; }
        }

        // - 类型验证通过，开始处理逻辑

        if (value instanceof Integer) value = value.value;

        if (typeof value === 'string') value = this.#getPercentageFromString(value);

        // - 先赋值
        try {
            this.#options = { ...Percentage.DEFAULT_OPTIONS, ...Object.fromEntries(Object.entries(options ?? {}).filter(([, v]) => v !== undefined && v !== null)) };
            this.#value = new Decimal(value).toDecimalPlaces(Percentage.DEFAULT_PECISION.toNumber(), this.#options.rounding);
        } catch (e) {
            // - 先原样抛出异常，暂时没什么要处理的。
            // - 如果之后有需要，可以在这里添加处理逻辑。
            throw e;
        }

        // - 后校验
        const { min, max, inclusiveMin, inclusiveMax } = this.#options;
        if (min !== undefined && min !== null) {
            // - 换什么行啊，怎么，没有宽屏显示器？
            const minRaw = typeof min === 'string' ? this.#cleanNumericString(min) : (min instanceof Percentage || min instanceof Integer) ? min.value : min;
            const minDec = minRaw instanceof Decimal ? minRaw : new Decimal(minRaw);
            const cmp = this.#value.comparedTo(minDec);
            if (cmp < 0 || (cmp === 0 && !inclusiveMin)) {
                throw new PercentageError(`${this.#value.toString()}小于最小允许值${minDec.toString()}${inclusiveMin ? '（闭区间包含）' : '（开区间不含）'}`);
            }
        }
        if (max !== undefined && max !== null) {
            // - 换什么行啊，怎么，没有宽屏显示器？
            const maxRaw = typeof max === 'string' ? this.#cleanNumericString(max) : (max instanceof Percentage || max instanceof Integer) ? max.value : max;
            const maxDec = maxRaw instanceof Decimal ? maxRaw : new Decimal(maxRaw);
            const cmp = this.#value.comparedTo(maxDec);
            if (cmp > 0 || (cmp === 0 && !inclusiveMax)) {
                throw new PercentageError(`${this.#value.toString()}大于最大允许值${maxDec.toString()}${inclusiveMax ? '（闭区间包含）' : '（开区间不含）'}`);
            }
        }

        const { allowNegative, allowPositive, allowZero } = this.#options;
        if (!allowNegative && this.#value.isNegative()) {
            throw new PercentageError(`不允许负值，但传入了${this.#value.toString()}`);
        }
        if (!allowPositive && this.#value.isPositive()) {
            throw new PercentageError(`不允许正值，但传入了${this.#value.toString()}`);
        }
        if (!allowZero && this.#value.isZero()) {
            throw new PercentageError(`不允许零值，但传入了${this.#value.toString()}`);
        }
    }

    plus(percentage, options = {}) {
        if (!(percentage instanceof Percentage)) throw new TypeError('传入的 percentage 必须是 Percentage 实例');
        return new Percentage(this.#value.plus(percentage.value), options);
    }

    minus(percentage, options = {}) {
        if (!(percentage instanceof Percentage)) throw new TypeError('传入的 percentage 必须是 Percentage 实例');
        return new Percentage(this.#value.minus(percentage.value), options);
    }

    times(factor, options = {}) {
        if (factor instanceof Percentage) factor = factor.value;
        if (factor instanceof Integer) factor = factor.value;
        if (factor instanceof Percentage) factor = factor.value;
        if (typeof factor === 'string') factor = this.#getPercentageFromString(factor);
        const d = factor instanceof Decimal ? factor : new Decimal(factor);
        return new Percentage(this.#value.times(d), options);
    }

    dividedBy(divisor, options = {}) {
        if (divisor instanceof Percentage) divisor = divisor.value;
        if (divisor instanceof Integer) divisor = divisor.value;
        if (divisor instanceof Percentage) divisor = divisor.value;
        if (typeof divisor === 'string') divisor = this.#getPercentageFromString(divisor);
        const d = divisor instanceof Decimal ? divisor : new Decimal(divisor);
        return new Percentage(this.#value.dividedBy(d), options);
    }

    toNumber() {
        return this.#value.toNumber();
    }

    /**
     * @description 输出数值的定点字符串形式。
     * @param {Integer|number} precision - 小数点后的位数，默认为 Percentage.DEFAULT_PECISION。
     * @returns {string} - 返回金额的定点字符串形式。
     */
    toFixed(precision = Percentage.DEFAULT_PECISION) {
        if (!(precision instanceof Integer)) { precision = new Integer(precision, { min: 0, allowNegative: false }); }
        return this.#value.toFixed(precision.toNumber());
    }
    /**
     * @description 输出数值的字符串形式.
     * @returns {string} - 返回金额的字符串形式。
     */
    toString() {
        return this.#value.toString();
    }

    /**
     * @description 将当前 Percentage 实例的数值转换为百分比字符串形式。
     * @param {Integer|number} precision - 小数点后的位数，默认为 Percentage.DEFAULT_PECISION。
     * @returns {string} - 返回百分比字符串形式，例如 "12.34%"。
     */
    toPercentString(precision = Percentage.DEFAULT_PECISION) {
        const factor = new Decimal(100);
        return this.times(factor).toFixed(precision) + '%';
    }
    /**
     * @description 将当前 Percentage 实例的数值转换为千分比字符串形式。
     * @param {Integer|number} precision - 小数点后的位数，默认为 Percentage.DEFAULT_PECISION。
     * @returns {string} - 返回千分比字符串形式，例如 "123.4‰"。
     */
    toPerMilleString(precision = Percentage.DEFAULT_PECISION) {
        const factor = new Decimal(1000);
        return this.times(factor).toFixed(precision) + '‰';
    }
    /**
     * @description 将当前 Percentage 实例的数值转换为万分比字符串形式。
     * @param {Integer|number} precision - 小数点后的位数，默认为 Percentage.DEFAULT_PECISION。
     * @returns {string} - 返回万分比字符串形式，例如 "1234‱"。
     */
    toPerTenThousandString(precision = Percentage.DEFAULT_PECISION) {
        const factor = new Decimal(10000);
        return this.times(factor).toFixed(precision) + '‱';
    }

    /**
     * @description 根据数值的大小自动选择合适的比例单位进行字符串表示。
     * - 当数值绝对值大于等于 0.01 时，使用百分比表示。
     * - 当数值绝对值大于等于 0.001 且小于 0.01 时，使用千分比表示。
     * - 当数值绝对值小于 0.001 时，使用万分比表示。
     * @returns {string} - 返回自动选择比例单位的字符串形式。
     */
    toAutoString(precision = Percentage.DEFAULT_PECISION) {
        const absValue = this.#value.abs();
        if (absValue.isZero()) { return this.toPercentString(precision); }
        if (absValue.greaterThanOrEqualTo(new Decimal(0.01))) {
            return this.toPercentString(precision);
        } else if (absValue.greaterThanOrEqualTo(new Decimal(0.001))) {
            return this.toPerMilleString(precision);
        } else {
            return this.toPerTenThousandString(precision);
        }
    }

    /**
     * @param {Percentage} percentage - 要比较的 Percentage 实例。类型不匹配时直接返回 false。
     * @description 比较当前 Percentage 实例与另一个 Percentage 实例的数值是否相等。
     * @returns {boolean} - 如果数值相等则返回 true，否则返回 false。
     */
    equals(percentage) {
        if (!(percentage instanceof Percentage)) return false;
        return this.#value.equals(percentage.value);
    }
    /**
     * @param {Percentage} percentage - 要比较的 Percentage 实例。类型不匹配时直接返回 true。
     * @description 比较当前 Percentage 实例与另一个 Percentage 实例的数值是否不相等。
     * @returns {boolean} - 如果数值不相等则返回 true，否则返回 false。
     */
    notEquals(percentage) {
        if (!(percentage instanceof Percentage)) return true;
        return !this.#value.equals(percentage.value);
    }
    /**
     * @param {Percentage} percentage - 要比较的 Percentage 实例。
     * @description 判断当前 Percentage 实例的数值是否大于另一个 Percentage 实例的数值。
     * @returns {boolean} - 如果当前实例的数值大于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 Percentage 不是 Percentage 实例时抛出。
     */
    greaterThan(percentage) {
        if (!(percentage instanceof Percentage)) throw new TypeError('Must compare with Percentage');
        return this.#value.greaterThan(percentage.value);
    }
    /**
     * @param {Percentage} percentage - 要比较的 Percentage 实例。
     * @description 判断当前 Percentage 实例的数值是否小于另一个 Percentage 实例的数值。
     * @returns {boolean} - 如果当前实例的数值小于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 Percentage 不是 Percentage 实例时抛出。
     */
    lessThan(percentage) {
        if (!(percentage instanceof Percentage)) throw new TypeError('Must compare with Percentage');
        return this.#value.lessThan(percentage.value);
    }
    /**
     * @param {Percentage} percentage - 要比较的 Percentage 实例。
     * @description 判断当前 Percentage 实例的数值是否大于或等于另一个 Percentage 实例的数值。
     * @returns {boolean} - 如果当前实例的数值大于或等于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 Percentage 不是 Percentage 实例时抛出。
     */
    greaterThanOrEqual(percentage) {
        if (!(percentage instanceof Percentage)) throw new TypeError('Must compare with Percentage');
        return this.#value.greaterThanOrEqualTo(percentage.value);
    }
    /**
     * @param {Percentage} percentage - 要比较的 Percentage 实例。
     * @description 判断当前 Percentage 实例的数值是否小于或等于另一个 Percentage 实例的数值。
     * @returns {boolean} - 如果当前实例的数值小于或等于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 Percentage 不是 Percentage 实例时抛出。
     */
    lessThanOrEqual(percentage) {
        if (!(percentage instanceof Percentage)) throw new TypeError('Must compare with Percentage');
        return this.#value.lessThanOrEqualTo(percentage.value);
    }
    /**
     * @param {Percentage} percentage - 要比较的 Percentage 实例。
     * @description 比较当前 Percentage 实例与另一个 Percentage 实例的数值大小。内部使用的是 Decimal 的 comparedTo 方法。
     * @returns {number} - 如果当前实例的数值小于传入实例的数值则返回 -1，等于则返回 0，大于则返回 1。
     * @throws {TypeError} - 当传入的 Percentage 不是 Percentage 实例时抛出。
     */
    comparedTo(percentage) {
        if (!(percentage instanceof Percentage)) throw new TypeError('Must compare with Percentage');
        return this.#value.comparedTo(percentage.value);
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
     * @throws {PercentageError} - 当输入为 undefined、null、空字符串或格式不正确时抛出错误。
     */
    #cleanNumericString(input) {
        if (input === undefined || input === null) throw new PercentageError('Numeric input is undefined or null');

        // 总是先统一为字符串
        let str = String(input);

        // 移除空白、不可见空格、英文与中文逗号（千分位分隔符）
        str = str.replace(/[\s\u00A0,，]/g, '').trim();

        // 支持括号表示负数
        const paren = str.match(/^\((.*)\)$/);
        if (paren) str = '-' + paren[1];

        // 检查是否是空字符串
        if (str === '') throw new PercentageError('Numeric string is empty');

        // 限制超长
        if (str.length > 128) throw new PercentageError('Numeric string is too long');

        // 假如是Infinity或者-Infinity或者NaN之类的怎么办呢？理论上是允许的，但业务上通常这个属于最后的结果了吧。好烦
        // 那么先直接放行吧
        if (/^(?:-)?(?:Infinity|NaN)$/.test(str)) {
            return str;
        }

        // 严格校验数字格式：可选负号，数字，最多一个小数点,可以有百分比、千分比、万分比
        // 允许形式："123", "-123", "123.45", "-123.45","123.45%","123.45‰","123.45‱"

        if (!/^-?\d+(?:\.\d+)?(?:[%‰‱])?$/.test(str)) {
            console.error(`Invalid numeric string format: "${input}" cleaned to "${str}"`);
            throw new PercentageError('Numeric string 格式不正确');
        }
        return str;
    }

    #getPercentageFromString(value) {
        // 先清理字符串
        let valueRaw = this.#cleanNumericString(value);
        // 处理 可能的 % ‰ ‱ 
        if (valueRaw.endsWith('%')) {
            valueRaw = new Decimal(valueRaw.slice(0, -1)).dividedBy(100);
        } else if (valueRaw.endsWith('‰')) {
            valueRaw = new Decimal(valueRaw.slice(0, -1)).dividedBy(1000);
        } else if (valueRaw.endsWith('‱')) {
            valueRaw = new Decimal(valueRaw.slice(0, -1)).dividedBy(10000);
        }
        return valueRaw;
    }
}

/**
 * @class
 * @classdesc PercentageError 类用于表示 Percentage 相关的错误，继承自标准的 Error 类。
 */
export
    class PercentageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PercentageError';
    }
}