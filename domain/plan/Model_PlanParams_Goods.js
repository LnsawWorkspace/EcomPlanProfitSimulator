import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';
import ValidateUtils from '../../infrastructure/ValidateUtils.js';

// ==================== GoodsItems ====================
/**
 * 商品成本配置实体类
 * @class Entity_Goods
 * @classdesc 商品成本配置实体类，用于存储商品的相关成本信息
 */
export class Model_PlanParams_Goods {
    #name;                // 商品名称
    #quantity;            // 商品数量（正整数）

    #purchaseAmount;      // 采购金额（Decimal）
    #purchaseQuantity;    // 采购数量（正整数）
    #valueIncTax;         // 含税商品成本（Decimal）
    #valueExcTax;         // 不含税商品成本（Decimal）

    #inputRate;           // 进项税率（小数形式，0-1，如0.13代表13%）
    #outputRate;          // 销项税率（小数形式，0-1）
    #fairValue;           // 商品公允价值（不含税，Decimal）

    #refundBefRec;        // 售前退款回收率（小数形式，0-1）
    #refundIngRec;        // 售中退款回收率（小数形式，0-1）
    #refundAftRec;        // 售后退款回收率（小数形式，0-1）

    /**
     * @param {Object} dto - 商品成本配置对象
      * @param {string} dto.name - 商品名称（必填）
      * @param {number|string|Decimal} [dto.num=1] - 商品数量（正整数）
      * @param {number|string|Decimal} [dto.purchaseAmount=0] - 采购金额（用于计算商品成本）
      * @param {number|string|Decimal} [dto.purchaseQuantity=0] - 采购数量（用于计算商品成本）
      * @param {number|string|Decimal} [dto.valueIncTax=0] - 含税商品成本（采购成本）
      * @param {number|string|Decimal} [dto.valueExcTax=0] - 不含税商品成本（优先级最高）
      * @param {number|string|Decimal} [dto.inputRate=0] - 进项税率（小数形式0-1，如0.13代表13%）
      * @param {number|string|Decimal} [dto.outputRate=0] - 销项税率（小数形式0-1，默认等于进项税率）
      * @param {number|string|Decimal} [dto.fairValue=0] - 商品公允价值（不含税）
      * @param {number|string|Decimal} [dto.refundBefRec=100] - 售前退款回收率（小数形式0-1）
      * @param {number|string|Decimal} [dto.refundIngRec=100] - 售中退款回收率（小数形式0-1）
      * @param {number|string|Decimal} [dto.refundAftRec=100] - 售后退款回收率（小数形式0-1）
     */
    constructor(dto = {}) {
        // 基础信息校验
        this.#name = ValidateUtils.stringNotEmptyAndWhitespace(dto.name);
        this.#quantity = new Integer(dto.quantity ?? 1, { integer: true, allowNegative: false, allowZero: false });

        // 采购相关参数
        this.#purchaseAmount = new Money(dto.purchaseAmount ?? 0, 4, { allowNegative: false });
        this.#purchaseQuantity = new Integer(dto.purchaseQuantity ?? 0, { integer: true, allowNegative: false });

        // 税率处理（小数形式 0-1）
        this.#inputRate = new Percentage(dto.inputRate ?? 0.13, { min: 0, max: 1 });
        this.#outputRate = new Percentage(dto.outputRate ?? 0.13, { min: 0, max: 1 });

        // 商品成本计算
        this.#valueIncTax = new Money(dto.valueIncTax ?? 0, 4, { allowNegative: false });
        this.#valueExcTax = new Money(dto.valueExcTax ?? 0, 4, { allowNegative: false });
        this.#calculateCost();

        // 公允价值
        this.#fairValue = new Money(dto.fairValue ?? 0, 4, { allowNegative: false });

        // 退款回收率（小数形式 0-1）
        this.#refundBefRec = new Percentage(dto.refundBefRec ?? 1, { min: 0, max: 1 });
        this.#refundIngRec = new Percentage(dto.refundIngRec ?? 1, { min: 0, max: 1 });
        this.#refundAftRec = new Percentage(dto.refundAftRec ?? 1, { min: 0, max: 1 });
    }

    static parse(dto) {
        return new Model_PlanParams_Goods({
            name: dto.name,
            quantity: dto.quantity.value,
            purchaseAmount: dto.purchaseAmount.value,
            purchaseQuantity: dto.purchaseQuantity.value,
            valueIncTax: dto.valueIncTax.value,
            valueExcTax: dto.valueExcTax.value,
            inputRate: dto.inputRate.value,
            outputRate: dto.outputRate.value,
            fairValue: dto.fairValue.value,
            refundBefRec: dto.refundBefRec.value,
            refundIngRec: dto.refundIngRec.value,
            refundAftRec: dto.refundAftRec.value,
        });
    }

    // 私有方法：计算商品成本（核心逻辑）
    #calculateCost() {
        // 优先级1：通过采购金额/数量计算
        if (this.#purchaseAmount.greaterThan(Money.ZERO) && this.#purchaseQuantity.greaterThan(Integer.ZERO)) {
            this.#valueIncTax = this.#purchaseAmount.dividedBy(this.#purchaseQuantity);
            this.#valueExcTax = this.#valueIncTax.dividedBy(this.#inputRate.plus(Percentage.ONE_HUNDRED_PERCENT, {}));
        }
        // 优先级2：输入含税成本
        else if (!this.#valueIncTax.isZero()) {
            this.#valueExcTax = this.#valueIncTax.dividedBy(this.#inputRate.plus(Percentage.ONE_HUNDRED_PERCENT, {}));
        }
        // 优先级3：直接输入不含税成本
        else if (!this.#valueExcTax.isZero()) {
            this.#valueIncTax = this.#valueExcTax.times(this.#inputRate.plus(Percentage.ONE_HUNDRED_PERCENT, {}));
        }
    }

    // Getters
    get name() { return this.#name; }
    get quantity() { return this.#quantity; }
    get purchaseAmount() { return this.#purchaseAmount; }
    get purchaseQuantity() { return this.#purchaseQuantity; }
    get valueIncTax() { return this.#valueIncTax; }
    get valueExcTax() { return this.#valueExcTax; }
    get inputRate() { return this.#inputRate; }
    get outputRate() { return this.#outputRate; }
    get fairValue() { return this.#fairValue; }
    get refundBefRec() { return this.#refundBefRec; }
    get refundIngRec() { return this.#refundIngRec; }
    get refundAftRec() { return this.#refundAftRec; }

    set quantity(value) {
        this.#quantity = new Integer(value, { integer: true, allowNegative: false, allowZero: false });
    }
}