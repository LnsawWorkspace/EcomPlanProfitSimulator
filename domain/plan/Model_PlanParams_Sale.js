import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';
import ValidateUtils from '../../infrastructure/ValidateUtils.js';

// ==================== SaleInfo ====================
/**
 * 销售配置实体类
 * @class Model_Sale
 * @classdesc 销售配置实体类，用于存储销售的相关配置信息
 */
export class Model_PlanParams_Sale {
    /**@type {Money} */
    #salePrice;             // 销售额值（Decimal类型）
    #payOrderQuantity;          // 订单数量（正整数）
    #method;            // 分摊计算方式
    #quantityPattern;   //单量计算模式

    /**
     * @param {Object} [dto={}] - 销售额配置对象
     * @param {number|string|Decimal} dto.salePrice - 销售额值（支持数字/字符串/Decimal）
     * @param {number|string|Decimal} [dto.payOrderQuantity=10000] - 订单数量（正整数）
     * @param {('cost'|'fair')} [dto.method='cost'] - 分摊计算方式
     */
    constructor(dto = {}) {
        this.#salePrice = new Money(dto.salePrice, 4, { allowNegative: false, allowZero: false });
        this.#payOrderQuantity = new Integer(dto.payOrderQuantity ?? 10000, { allowNegative: false, allowZero: false });
        this.#validateAndSetMethod(dto.method);
        this.#quantityPattern = dto.quantityPattern || 'real';
    }

    static parse(dto, entityModelVersion = null) {
        // 不同的版本可能有不同的解析逻辑，当前版本统一处理
        // 目的是为了未来的兼容性预留接口，将旧的数据结构转换为当前结构
        return new Model_PlanParams_Sale({
            salePrice: dto.salePrice.value,
            payOrderQuantity: dto.payOrderQuantity.value,
            method: dto.method
        });
    }

    // 私有方法：严格校验并设置分摊方式method（抛出错误）
    #validateAndSetMethod(method) {
        const validatedMethod = ValidateUtils.stringNotEmptyAndWhitespace(method);
        const validMethods = ['cost', 'fair'];
        this.#method = validMethods.includes(validatedMethod) ? validatedMethod : 'cost';
    }

    // Getters
    /**@returns {Money} */
    get salePrice() { return this.#salePrice; }
    get payOrderQuantity() { return this.#payOrderQuantity; }
    get method() { return this.#method; }
    get quantityPattern() { return this.#quantityPattern; }

    set quantityPattern(value) {
        this.#quantityPattern = value;
    }
    set salePrice(value) {
        this.#salePrice = new Money(value, 4, { allowNegative: false, allowZero: false });
    }
    set payOrderQuantity(order_quantity) {
        this.#payOrderQuantity = new Integer(order_quantity ?? 10000, { allowNegative: false, allowZero: false });
    }
}