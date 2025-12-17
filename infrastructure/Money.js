import Decimal from './decimal.mjs';
import Integer from './Integer.js';
import Percentage from './Percentage.js';

/**
 * @class
 * @classdesc Money 类封装了货币金额的表示与运算，基于 Decimal 实现高精度计算，支持多种选项配置。
 */
export default class Money {

    // - 默认使用“银行家”舍入模式，即四舍六入五成双。
    // - 参考：https://en.wikipedia.org/wiki/Rounding#Round_half_to_even

    /**
     * 默认舍入模式：四舍六入五成双（银行家舍入法）
     * 行为：常规的“四舍五入”，但当被舍弃部分正好是 0.5 的时候（tie），
     *      舍入到使最后一位为偶数，从而减少累计偏差。
     * 示例（保留 3 位小数）：
     *   1.2345  => 1.234  （第三位是 4（偶数），tie 时舍入到偶数）
     *   1.2355  => 1.236  （第三位是 5（奇数），tie 时进一位）
     * 
     */
    static ROUND_DEFAULT = Decimal.ROUND_HALF_EVEN;

    /**
     * 向外舍入（away from zero）
     * 行为：只要存在任何非零的被舍弃部分，就将结果朝远离 0 的方向调整（增大绝对值）。
     * 这对正数表现为向上，对负数表现为向下（更负）。
     * 示例（保留 3 位小数）：
     *   1.2341  => 1.235
     *   1.2340  => 1.234
     *   -1.2341 => -1.235
     */
    static ROUND_UP = Decimal.ROUND_UP;

    /**
     * 向零舍入（toward zero）
     * 行为：总是朝接近 0 的方向舍入（截断），不论被舍弃部分多大。
     * 示例（保留 3 位小数）：
     *   1.2349  => 1.234
     *   1.2340  => 1.234
     *   -1.2349 => -1.234
     */
    static ROUND_DOWN = Decimal.ROUND_DOWN;

    /**
     * 向正无穷舍入（toward +Infinity，ceil）
     * 行为：总是向更大的值舍入（向 +∞），即正数向上，负数向上（绝对值变小，趋近 0）。
     * 示例（保留 3 位小数）：
     *   1.2341  => 1.235
     *   1.2340  => 1.234
     *   -1.2341 => -1.234
     */
    static ROUND_CEIL = Decimal.ROUND_CEIL;

    /**
     * 向负无穷舍入（toward -Infinity，floor）
     * 行为：总是向更小的值舍入（向 -∞），即正数向下（绝对值变小），负数向下（变得更负）。
     * 示例（保留 3 位小数）：
     *   1.2349  => 1.234
     *   -1.2341 => -1.235
     */
    static ROUND_FLOOR = Decimal.ROUND_FLOOR;

    /**
     * 四舍五入（ties away from zero）
     * 行为：传统的四舍五入规则：
     *   被舍弃部分 < half  => 向 0 舍入（下舍）
     *   被舍弃部分 > half  => 远离 0（上舍）
     *   被舍弃部分 == half => 远离 0（5 进）
     * 示例（保留 3 位小数）：
     *   1.2344  => 1.234
     *   1.2345  => 1.235
     *   -1.2345 => -1.235
     */
    static ROUND_HALF_UP = Decimal.ROUND_HALF_UP;

    /**
     * 半向下（ties toward zero）
     * 行为：与 HALF_UP 相反：当被舍弃部分正好为 half（tie）时，朝 0 舍入；非 tie 时按常规四舍五入规则。
     * 示例（保留 3 位小数）：
     *   1.2344  => 1.234
     *   1.2345  => 1.234  (tie 时不进位)
     *   1.2346  => 1.235
     */
    static ROUND_HALF_DOWN = Decimal.ROUND_HALF_DOWN;

    /**
     * 半向最近偶数（银行家舍入，ties to even）
     * 同 ROUND_DEFAULT，专门命名以便明确引用。
     * 示例（保留 3 位小数）：
     *   1.2345 => 1.234  (前一位 4 为偶数)
     *   1.2355 => 1.236  (前一位 5 为奇数)
     */
    static ROUND_HALF_EVEN = Decimal.ROUND_HALF_EVEN;

    /**
     * 半时向上（ties toward +Infinity）
     * 行为：在被舍弃部分正好为 half（tie）时，朝 +∞ 舍入；非 tie 按常规四舍五入。
     * 示例（保留 3 位小数）：
     *   1.2345  => 1.235  (tie 朝 +∞)
     *   -1.2345 => -1.234 (tie 朝 +∞，即更接近 0)
     */
    static ROUND_HALF_CEIL = Decimal.ROUND_HALF_CEIL;

    /**
     * 半时向下（ties toward -Infinity）
     * 行为：在被舍弃部分正好为 half（tie）时，朝 -∞ 舍入；非 tie 按常规四舍五入。
     * 示例（保留 3 位小数）：
     *   1.2345  => 1.234  (tie 朝 -∞)
     *   -1.2345 => -1.235 (tie 朝 -∞)
     */
    static ROUND_HALF_FLOOR = Decimal.ROUND_HALF_FLOOR;

    static DEFAULT_OPTIONS = {
        // - 前缀符号，用于显示时组合使用。
        prefix: '¥',
        // - 后缀符号，用于显示时组合使用。
        suffix: '元',
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
        rounding: Money.ROUND_DEFAULT,
    };

    // - 默认4位小数，通常对于货币来说，2位小数已经足够，4位小数可以应付大部分场景。再高一般不需要了。
    // - 很纠结到底是用默认小数位数，还是要求必须显式提供小数位数。
    // - 按理说，提供默认值可以简化使用，但又怕使用时忽略了小数位数的设置，导致出现意外结果。
    // - 毕竟，货币是一个非常敏感的领域，任何小数位数的误差都可能导致严重后果。
    // - 目前，仅保留默认值定义，构造时仍然要求必须显式提供小数位数。
    // - 如果未来有需要，可以考虑改成允许默认值的使用。
    // - 目前，构造函数必须提供 precision 参数。而 plus、minus、times、dividedBy 方法的 precision 参数是可选的，默认沿用当前实例的 precision。
    static DEFAULT_PRECISION = new Integer(4);

    // - 静态零值实例，方便使用。
    static ZERO = new Money(0, Money.DEFAULT_PRECISION);

    /** @type {Decimal} - 金额数值 */
    #value;
    /** @type {Integer} - 小数位数 */
    #precision;
    /** @type {Object} - 选项配置 */
    #options;

    /** @returns {Decimal} */
    get value() { return this.#value; }
    /** @returns {Integer} */
    get precision() { return new Integer(this.#precision); }
    /** @returns {Object} */
    get options() { return { ...this.#options }; }

    /**
     * @constructor
     * @param {string|number|Decimal|Money|Integer} value - 金额数值，可以传入 number、string、Decimal、Integer 或 Money 实例，最终会转换为 Decimal 存储。
     * @param {string|number|Decimal|Integer} precision - 小数位数,如果传入 Money 可以沿用其 precision，否则必须显式提供。
     * @param {object} options - 选项配置和约束 ：当进行计算时，不会自动应用这些约束，约束仅在构造时生效。
     * @description 可选配置项包括：
     * @param {string} [options.prefix='¥'] - 货币前缀符号。
     * @param {string} [options.suffix='元'] - 货币后缀符号。
     * @param {string|number|Decimal|Money|Integer} [options.min] - 最小值（包含）。
     * @param {string|number|Decimal|Money|Integer} [options.max] - 最大值（包含）。
     * @param {boolean} [options.inclusiveMin=true] - 最小值是否包含边界。
     * @param {boolean} [options.inclusiveMax=true] - 最大值是否包含边界。
     * @param {boolean} [options.allowNegative=true] - 是否允许负值。
     * @param {boolean} [options.allowPositive=true] - 是否允许正值。
     * @param {boolean} [options.allowZero=true] - 是否允许零值。
     * @param {number} [options.rounding=Money.ROUND_DEFAULT] - 舍入模式，参考 Money 静态常量。
     * @example
     * new Money('1234.56', 2, { min: '0.00', max: '10000.00', prefix: '$', suffix: ' USD' });
     * @throws {TypeError} - 当传入的 value 类型不正确时抛出。
     * @throws {MoneyError} - 当传入的 value 格式不正确或不符合选项约束时抛出。
     */
    constructor(value, precision, options) {

        // - 类型验证 1
        if (!(typeof value === 'number') &&
            !(typeof value === 'string') &&
            !(value instanceof Decimal) &&
            !(value instanceof Money) &&
            !(value instanceof Integer)) {
            throw new TypeError('Money.value must be one of: number, string, Decimal, Integer, Money');
        }

        if (typeof value === 'number') {
            // - 处理极端数值，防止科学计数法带来不可预期的问题。
            if (!isFinite(value)) {
                throw new MoneyError('Money.value cannot be NaN or Infinite');
            }
        }

        // - copy constructor 拷贝构造
        if (value instanceof Money) {
            const origin = value;
            value = origin.value;
            // - 如果调用时未提供 precision，则沿用原 Money 实例的设置。
            if (precision === undefined || precision === null) { precision = origin.precision; }
            // - 如果调用时未提供 options，则沿用原 Money 实例的设置。注意：{}视为有效参数。
            if (options === undefined || options === null) { options = origin.options; }
        }

        // - 需要先验证 value 是否是Money，再验证 precision。
        // - 如果 value 是 Money，则允许不提供 precision。
        // - 因为会沿用原实例的 precision。
        if (precision === undefined || precision === null) {
            throw new MoneyError('Money 构造必须显式提供 precision (小数位数)！');
        }

        // - 类型验证 2
        if (!(precision instanceof Integer) && !(typeof precision === 'number') && !(typeof precision === 'string') && !(precision instanceof Decimal)) {
            throw new TypeError('Money.precision must be one of: Integer, number, string, Decimal');
        }

        // - 类型验证通过，开始处理逻辑

        if (value instanceof Integer) value = value.value;

        if (typeof value === 'string') value = this.#cleanNumericString(value);

        // - 先赋值
        try {
            this.#options = { ...Money.DEFAULT_OPTIONS, ...Object.fromEntries(Object.entries(options ?? {}).filter(([, v]) => v !== undefined && v !== null)) };
            this.#precision = new Integer(precision, { min: 0, allowNegative: false });
            this.#value = new Decimal(value).toDecimalPlaces(this.#precision.toNumber(), this.#options.rounding);
        } catch (e) {
            // - 先原样抛出异常，暂时没什么要处理的。
            // - 如果之后有需要，可以在这里添加处理逻辑。
            throw e;
        }

        // - 后校验
        const { min, max, inclusiveMin, inclusiveMax } = this.#options;
        if (min !== undefined && min !== null) {
            // - 换什么行啊，怎么，没有宽屏显示器？
            const minRaw = typeof min === 'string' ? this.#cleanNumericString(min) : (min instanceof Money || min instanceof Integer) ? min.value : min;
            const minDec = minRaw instanceof Decimal ? minRaw : new Decimal(minRaw);
            const cmp = this.#value.comparedTo(minDec);
            if (cmp < 0 || (cmp === 0 && !inclusiveMin)) {
                throw new MoneyError(`${this.#value.toString()}小于最小允许值${minDec.toString()}${inclusiveMin ? '（闭区间包含）' : '（开区间不含）'}`);
            }
        }
        if (max !== undefined && max !== null) {
            // - 换什么行啊，怎么，没有宽屏显示器？
            const maxRaw = typeof max === 'string' ? this.#cleanNumericString(max) : (max instanceof Money || max instanceof Integer) ? max.value : max;
            const maxDec = maxRaw instanceof Decimal ? maxRaw : new Decimal(maxRaw);
            const cmp = this.#value.comparedTo(maxDec);
            if (cmp > 0 || (cmp === 0 && !inclusiveMax)) {
                throw new MoneyError(`${this.#value.toString()}大于最大允许值${maxDec.toString()}${inclusiveMax ? '（闭区间包含）' : '（开区间不含）'}`);
            }
        }

        const { allowNegative, allowPositive, allowZero } = this.#options;
        if (!allowNegative && this.#value.isNegative()) {
            throw new MoneyError(`不允许负值，但传入了${this.#value.toString()}`);
        }
        if (!allowPositive && this.#value.isPositive()) {
            throw new MoneyError(`不允许正值，但传入了${this.#value.toString()}`);
        }
        if (!allowZero && this.#value.isZero()) {
            throw new MoneyError(`不允许零值，但传入了${this.#value.toString()}`);
        }
    }
    /**
     * @param {Money} money - 要相加的 Money 实例。只允许 Money + Money，如果要和其他类型相加，请先转换为 Money 实例。或者使用money.value、money.toNumber()再计算。
     * @description plus() 方法用于将当前 Money 实例与另一个 Money 实例相加，返回一个新的 Money 实例表示相加后的结果。
     * @param {Integer|number|Decimal} [precision=this.#precision] - 结果的精度（小数位数），如果不提供则沿用当前实例的 precision。
     * @param {object} [options={}] - 结果的选项配置，如果不提供则使用默认配置，注意是默认配置（Money.DEFAULT_OPTIONS），而不是当前配置，如果想用当前配置，需要显式传入 this.options。
     * @example
     * const money1 = new Money('100.50', 2);
     * const money2 = new Money('200.75', 2);
     * const result1 = money1.plus(money2); // 结果为新的 Money 实例，值为 '301.25'，复用money1的 precision。
     * const result2 = money1.plus(money2, 3); // 结果为新的 Money 实例，值为 '301.250'。使用新的 precision 3。
     * const result3 = money1.plus(money2, 2, { prefix: '$', suffix: ' USD' }); // 使用了新的 options。
     * const result4 = money1.plus(money2, money1.precision, money2.options); // 指定使用money1的 precision和money2的 options。
     * @returns {Money} - 返回一个新的 Money 实例，表示相加后的结果。
     * @throws {TypeError} - 当传入的 money 不是 Money 实例时抛出。
     * @throws {MoneyError} - 当计算结果不符合选项约束时抛出。
     */

    plus(money, precision = this.#precision, options = {}) {
        if (!(money instanceof Money)) throw new TypeError('传入的 money 必须是 Money 实例');
        return new Money(this.#value.plus(money.value), precision, options);
    }

    /**
     * @param {Money} money - 要相减的 Money 实例。只允许 Money - Money，如果要和其他类型相减，请先转换为 Money 实例。或者使用money.value、money.toNumber()再计算。
     * @description minus() 方法用于将当前 Money 实例与另一个 Money 实例相减，返回一个新的 Money 实例表示相减后的结果。
     * @param {Integer|number|Decimal} [precision=this.#precision] - 结果的精度（小数位数），如果不提供则沿用当前实例的 precision。
     * @param {object} [options={}] - 结果的选项配置，如果不提供则使用默认配置，注意是默认配置（Money.DEFAULT_OPTIONS），而不是当前配置，如果想用当前配置，需要显式传入 this.options。
     * @example
     * const money1 = new Money('300.75', 2);
     * const money2 = new Money('100.50', 2);
     * const result1 = money1.minus(money2); // 结果为新的 Money 实例，值为 '200.25'，复用money1的 precision。
     * const result2 = money1.minus(money2, 3); // 结果为新的 Money 实例，值为 '200.250'。使用新的 precision 3。
     * const result3 = money1.minus(money2, 2, { prefix: '$', suffix: ' USD' }); // 使用了新的 options。
     * const result4 = money1.minus(money2, money1.precision, money2.options); // 指定使用money1的 precision和money2的 options。
     * @returns {Money} - 返回一个新的 Money 实例，表示相减后的结果。
     * @throws {TypeError} - 当传入的 money 不是 Money 实例时抛出。
     * @throws {MoneyError} - 当计算结果不符合选项约束时抛出。
     */
    minus(money, precision = this.#precision, options = {}) {
        if (!(money instanceof Money)) throw new TypeError('传入的 money 必须是 Money 实例');
        return new Money(this.#value.minus(money.value), precision, options);
    }

    /**
     * @param {Money|Integer|Percentage|number|string|Decimal} factor - 乘数，可以是 Money、Integer、Percentage 实例，或 number、string、Decimal 类型。
     * @description 乘法运算支持多种类型的乘数：
     * - Money 实例：使用其金额值进行乘法计算。虽然不知道金额乘以金额在实际业务中是否有意义，但技术上是允许的。
     * - Integer 实例：使用其整数值进行乘法计算。
     * - Percentage 实例：使用其百分比值进行乘法计算。
     * - Decimal 实例：直接使用该数值进行乘法计算。
     * - number|string 类型：转换为 Decimal 后使用该数值进行乘法计算。
     * @param {Integer|number|Decimal} [precision=this.#precision] - 结果的精度（小数位数），如果不提供则沿用当前实例的 precision。
     * @param {object} [options={}] - 结果的选项配置，如果不提供则使用默认配置，注意是默认配置（Money.DEFAULT_OPTIONS），而不是当前配置，如果想用当前配置，需要显式传入 this.options。
     * @example
     * const money = new Money('100.50', 2);
     * const integerFactor = new Integer(2);
     * const percentageFactor = new Percentage('150%');
     * const result1 = money.times(integerFactor); // 结果为新的 Money 实例，值为 '201.00'。
     * const result2 = money.times(percentageFactor); // 结果为新的 Money 实例，值为 '150.75'。
     * const result3 = money.times(3); // 结果为新的 Money 实例，值为 '301.50'。
     * const result4 = money.times('2.5', 3); // 结果为新的 Money 实例，值为 '251.250'。使用新的 precision 3。  
     * const result5 = money.times(1.2, money.precision, { prefix: '$', suffix: ' USD' }); // 使用了新的 options。
     * @returns {Money} - 返回一个新的 Money 实例，表示乘法运算后的结果。
     * @throws {TypeError} - 当传入的 factor 类型不正确时抛出。
     * @throws {MoneyError} - 当计算结果不符合选项约束时抛出。
     */
    times(factor, precision = this.#precision, options = {}) {
        if (factor instanceof Money) factor = factor.value;
        if (factor instanceof Integer) factor = factor.value;
        if (factor instanceof Percentage) factor = factor.value;
        if (typeof factor === 'string') factor = this.#cleanNumericString(factor);
        const d = factor instanceof Decimal ? factor : new Decimal(factor);
        return new Money(this.#value.times(d), precision, options);
    }

    /**
     * @param {Money|Integer|Percentage|number|string|Decimal} divisor - 除数，可以是 Money、Integer、Percentage 实例，或 number、string、Decimal 类型。
     * @description 除法运算支持多种类型的除数：
     * - Money 实例：使用其金额值进行除法计算。相比times，金额除以金额在实际业务中确实存在一定的应用场景，比如计算两个金额的比值。
     * - Integer 实例：使用其整数值进行除法计算。
     * - Percentage 实例：使用其百分比值进行除法计算。
     * - Decimal 实例：直接使用该数值进行除法计算。
     * - number|string 类型：转换为 Decimal 后使用该数值进行除法计算。
     * @param {Integer|number|Decimal} [precision=this.#precision] - 结果的精度（小数位数），如果不提供则沿用当前实例的 precision。
     * @param {object} [options={}] - 结果的选项配置，如果不提供则使用默认配置，注意是默认配置（Money.DEFAULT_OPTIONS），而不是当前配置，如果想用当前配置，需要显式传入 this.options。
     * @example
     * const money = new Money('100.50', 2);
     * const integerDivisor = new Integer(2);
     * const percentageDivisor = new Percentage('50%');
     * const result1 = money.dividedBy(integerDivisor); // 结果为新的 Money 实例，值为 '50.25'。
     * const result2 = money.dividedBy(percentageDivisor); // 结果为新的 Money 实例，值为 '201.00'。
     * const result3 = money.dividedBy(2); // 结果为新的 Money 实例，值为 '50.25'。
     * const result4 = money.dividedBy('0.5', 3); // 结果为新的 Money 实例，值为 '201.000'。使用新的 precision 3。
     * const result5 = money.dividedBy(1.25, money.precision, { prefix: '$', suffix: ' USD' }); // 使用了新的 options。
     * @returns {Money} - 返回一个新的 Money 实例，表示除法运算后的结果。
     * @throws {TypeError} - 当传入的 divisor 类型不正确时抛出。
     * @throws {MoneyError} - 当计算结果不符合选项约束时抛出。
     */
    dividedBy(divisor, precision = this.#precision, options = {}) {
        if (divisor instanceof Money) divisor = divisor.value;
        if (divisor instanceof Integer) divisor = divisor.value;
        if (divisor instanceof Percentage) divisor = divisor.value;
        if (typeof divisor === 'string') divisor = this.#cleanNumericString(divisor);
        const d = divisor instanceof Decimal ? divisor : new Decimal(divisor);
        return new Money(this.#value.dividedBy(d), precision, options);
    }

    /**
     * @description 输出数值的原始数字形式。可能会丢失精度，慎用。
     * @returns {number} - 返回金额的数字形式。
     */
    toNumber() {
        return this.#value.toNumber();
    }
    /**
     * @param {Integer} [precision=this.#precision] - 小数位数，默认使用当前实例的 precision。
     * @description 输出数值的定点字符串形式，指定小数位数。
     * @returns {string} - 返回金额的定点字符串形式。
     */
    toFixed(precision = this.#precision) {
        // - 与plus等方法不同，需要主动验证 precision 类型。
        // - 因为plus等方法，最终会传给构造函数，而构造函数会验证类型。
        if (!(precision instanceof Integer)) { precision = new Integer(precision, { min: 0, allowNegative: false }); }
        return this.#value.toFixed(precision.toNumber());
    }
    /**
     * @param {Object} [options={ minimumFractionDigits: this.#precision.toNumber(), maximumFractionDigits: this.#precision.toNumber() }] - 本地化选项，参考 MDN 文档中 Number.prototype.toLocaleString 的 options 参数。默认会设置 minimumFractionDigits 和 maximumFractionDigits 为当前实例的 precision。
     * @param {string} [locale='zh-CN'] - 本地化区域设置，默认为中文（中国）。
     * @description 输出数值的本地化定点字符串形式。没考虑大数超界等问题，先简单实现。一般来说 Money不会轻易超出 JS 数字范围。
     * @returns {string} - 返回金额的本地化定点字符串形式。可能会丢失精度。
     */
    toLocaleFixed(precision = this.#precision, options = { minimumFractionDigits: this.#precision.toNumber(), maximumFractionDigits: this.#precision.toNumber() }, locale = 'zh-CN') {
        precision = new Integer(precision, { min: 0, allowNegative: false });
        options = { ...options, minimumFractionDigits: precision.toNumber(), maximumFractionDigits: precision.toNumber() };
        return this.#value.toDecimalPlaces(precision.toNumber(), this.#options.rounding).toNumber().toLocaleString(locale, options);
    }
    /**
     * @description 输出数值的字符串形式.
     * @returns {string} - 返回金额的字符串形式。
     */
    toString() {
        return this.#value.toString();
    }
    /**
     * @param {Object} [options={}] - 本地化选项，参考 MDN 文档中 Number.prototype.toLocaleString 的 options 参数。
     * @param {string} [locale='zh-CN'] - 本地化区域设置，默认为中文（中国）。
     * @description 输出数值的本地化字符串形式。没考虑大数超界等问题，先简单实现。一般来说 Money不会轻易超出 JS 数字范围。
     * @returns {string} - 返回金额的本地化字符串形式。可能会丢失精度。
     */
    toLocaleString(options = {}, locale = 'zh-CN') {
        return this.#value.toNumber().toLocaleString(locale, options);
    }

    /**
     * @param {Money} money - 要比较的 Money 实例。类型不匹配时直接返回 false。
     * @description 比较当前 Money 实例与另一个 Money 实例的数值是否相等。
     * @returns {boolean} - 如果数值相等则返回 true，否则返回 false。
     */
    equals(money) {
        if (!(money instanceof Money)) return false;
        return this.#value.equals(money.value);
    }
    /**
     * @param {Money} money - 要比较的 Money 实例。类型不匹配时直接返回 true。
     * @description 比较当前 Money 实例与另一个 Money 实例的数值是否不相等。
     * @returns {boolean} - 如果数值不相等则返回 true，否则返回 false。
     */
    notEquals(money) {
        if (!(money instanceof Money)) return true;
        return !this.#value.equals(money.value);
    }
    /**
     * @param {Money} money - 要比较的 Money 实例。
     * @description 判断当前 Money 实例的数值是否大于另一个 Money 实例的数值。
     * @returns {boolean} - 如果当前实例的数值大于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 money 不是 Money 实例时抛出。
     */
    greaterThan(money) {
        if (!(money instanceof Money)) throw new TypeError('Must compare with Money');
        return this.#value.greaterThan(money.value);
    }
    /**
     * @param {Money} money - 要比较的 Money 实例。
     * @description 判断当前 Money 实例的数值是否小于另一个 Money 实例的数值。
     * @returns {boolean} - 如果当前实例的数值小于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 money 不是 Money 实例时抛出。
     */
    lessThan(money) {
        if (!(money instanceof Money)) throw new TypeError('Must compare with Money');
        return this.#value.lessThan(money.value);
    }
    /**
     * @param {Money} money - 要比较的 Money 实例。
     * @description 判断当前 Money 实例的数值是否大于或等于另一个 Money 实例的数值。
     * @returns {boolean} - 如果当前实例的数值大于或等于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 money 不是 Money 实例时抛出。
     */
    greaterThanOrEqual(money) {
        if (!(money instanceof Money)) throw new TypeError('Must compare with Money');
        return this.#value.greaterThanOrEqualTo(money.value);
    }
    /**
     * @param {Money} money - 要比较的 Money 实例。
     * @description 判断当前 Money 实例的数值是否小于或等于另一个 Money 实例的数值。
     * @returns {boolean} - 如果当前实例的数值小于或等于传入实例的数值则返回 true，否则返回 false。
     * @throws {TypeError} - 当传入的 money 不是 Money 实例时抛出。
     */
    lessThanOrEqual(money) {
        if (!(money instanceof Money)) throw new TypeError('Must compare with Money');
        return this.#value.lessThanOrEqualTo(money.value);
    }
    /**
     * @param {Money} money - 要比较的 Money 实例。
     * @description 比较当前 Money 实例与另一个 Money 实例的数值大小。内部使用的是 Decimal 的 comparedTo 方法。
     * @returns {number} - 如果当前实例的数值小于传入实例的数值则返回 -1，等于则返回 0，大于则返回 1。
     * @throws {TypeError} - 当传入的 money 不是 Money 实例时抛出。
     */
    comparedTo(money) {
        if (!(money instanceof Money)) throw new TypeError('Must compare with Money');
        return this.#value.comparedTo(money.value);
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
     * @throws {MoneyError} - 当输入为 undefined、null、空字符串或格式不正确时抛出错误。
     */
    #cleanNumericString(input) {
        if (input === undefined || input === null) throw new MoneyError('Numeric input is undefined or null');

        // 总是先统一为字符串
        let str = String(input);

        // 移除空白、不可见空格、英文与中文逗号（千分位分隔符）
        str = str.replace(/[\s\u00A0,，]/g, '').trim();

        // 支持括号表示负数
        const paren = str.match(/^\((.*)\)$/);
        if (paren) str = '-' + paren[1];

        // 检查是否是空字符串
        if (str === '') throw new MoneyError('Numeric string is empty');

        // 限制超长
        if (str.length > 128) throw new MoneyError('Numeric string is too long');

        // 严格校验数字格式：可选负号，数字，最多一个小数点
        // 允许形式："123", "-123", "123.45", "-123.45"
        if (!/^-?\d+(?:\.\d+)?$/.test(str)) {
            throw new MoneyError('Numeric string 格式不正确');
        }
        return str;
    }
}

/**
 * @class
 * @classdesc MoneyError 类用于表示 Money 相关的错误，继承自标准的 Error 类。
 */
export
    class MoneyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MoneyError';
    }
}