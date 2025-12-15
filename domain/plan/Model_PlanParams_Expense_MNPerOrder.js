import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';
import { Model_PlanParams_Expense_PerOrder } from './Model_PlanParams_Expense_PerOrder.js';
import ValidateUtils from '../../infrastructure/ValidateUtils.js';

// ==================== ExpensePer ====================
/**
 * M个的订单里边有N个订单每单要支付的成本
 * @class Model_PlanParams_Expense_MNPerOrder
 * @classdesc M个的订单里边有N个订单每单要支付的成本实体类，用于存储订单的相关成本信息
 */
export class Model_PlanParams_Expense_MNPerOrder extends Model_PlanParams_Expense_PerOrder {
    #orderPer;           // 订单占比（小数形式0-1）
    #refundBefPer;       // 售前退款比例（小数形式0-1）
    #refundIngPer;       // 售中退款比例（小数形式0-1）
    #refundAftPer;       // 售后退款比例（小数形式0-1）
    #refundTotalPer;     // 总退款比例（小数形式0-1）

    /**
    * @param {Object} dto - 费用配置对象
    * @param {number|string|Decimal} dto.orderPer - 订单占比（小数形式 0-1）
    * @param {number|string|Decimal} [dto.refundBefPer=0] - 售前退款比例（小数形式 0-1）
    * @param {number|string|Decimal} [dto.refundIngPer=0] - 售中退款比例（小数形式 0-1）
    * @param {number|string|Decimal} [dto.refundAftPer=0] - 售后退款比例（小数形式 0-1）
     */
    constructor(dto) {
        super(dto); // 调用父类构造函数

        // 订单占比处理
        this.#orderPer = new Percentage(dto.orderPer, { min: 0, max: 1 });

        // 退款比例处理
        this.#refundBefPer = new Percentage(dto.refundBefPer, { min: 0, max: 1 });
        this.#refundIngPer = new Percentage(dto.refundIngPer, { min: 0, max: 1 });
        this.#refundAftPer = new Percentage(dto.refundAftPer, { min: 0, max: 1 });
        this.#refundTotalPer = this.#refundBefPer.plus(this.#refundIngPer).plus(this.#refundAftPer, { min: 0, max: 1 });
    }

    static parse(dto) {
        return new Model_PlanParams_Expense_MNPerOrder({
            name: dto.name,
            valueType: dto.valueType,
            valueMoney: dto.valueMoney.value,
            valuePercentage: dto.valuePercentage.value,
            inputRate: dto.inputRate.value,
            base: dto.base,
            baseHaveTax: dto.baseHaveTax,
            refundBefRec: dto.refundBefRec.value,
            refundIngRec: dto.refundIngRec.value,
            refundAftRec: dto.refundAftRec.value,
            
            orderPer: dto.orderPer.value,
            refundBefPer: dto.refundBefPer.value,
            refundIngPer: dto.refundIngPer.value,
            refundAftPer: dto.refundAftPer.value,
        });
    }

    // Getters
    get orderPer() { return this.#orderPer; }
    get refundBefPer() { return this.#refundBefPer; }
    get refundIngPer() { return this.#refundIngPer; }
    get refundAftPer() { return this.#refundAftPer; }
    get refundTotalPer() { return this.#refundTotalPer; }

}