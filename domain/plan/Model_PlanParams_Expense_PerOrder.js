import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';
import ValidateUtils from '../../infrastructure/ValidateUtils.js';
// ==================== ExpenseAvgItems ====================
/**
 * 每个订单都要支持的成本
 * @class Entity_PlanParams_Expense_PerOrder
 * @classdesc 每个订单都要支持的成本实体类，用于存储订单的相关成本信息
 */
export class Model_PlanParams_Expense_PerOrder {
    #name;                // 费用名称
    #valueMoney;         // 费用数值（金额）
    #valuePercentage;    // 费用数值（百分比）
    #valueType;           // 费用类型：'num'（金额）/'per'（百分比）
    #inputRate;           // 进项税率（小数形式0-1）

    #base;                // 计算基础（百分比时必填），只有当valueType是per的时候，才有意义
    #baseHaveTax;         // 是否基于含税金额计算,只有当valueType是per的时候，才有意义

    #refundBefRec;        // 售前退款回收率（小数形式0-1）
    #refundIngRec;        // 售中退款回收率（小数形式0-1）
    #refundAftRec;        // 售后退款回收率（小数形式0-1）

    /**
     * @param {Object} dto - 费用配置对象
     * @param {string} dto.name - 费用名称
     * @param {number|string|Decimal} dto.valueMoney - 费用数值（金额）
     * @param {number|string|Decimal} dto.valuePercentage - 费用数值（百分比）
     * @param {('num'|'per')} dto.valueType - 费用类型：num=金额，per=百分比（需/100）
     * @param {string|null} dto.base - 计算基础（百分比时必填，如'sales'/'cost'）
     * @param {boolean} [dto.baseHaveTax=true] - 是否基于含税金额计算
     * @param {number|string|Decimal} [dto.inputRate=13] - 进项税率（百分比）
     * @param {number|string|Decimal} [dto.refundBefRec=100] - 售前退款回收率（百分比）
     * @param {number|string|Decimal} [dto.refundIngRec=100] - 售中退款回收率（百分比）
     * @param {number|string|Decimal} [dto.refundAftRec=100] - 售后退款回收率（百分比）
     */
    constructor(dto = {}) {
        // 基础信息校验
        this.#name = ValidateUtils.stringNotEmptyAndWhitespace(dto.name);
        this.#valueType = this.#validateAndSetValueType(dto.valueType);
        this.#valueMoney = new Money(dto.valueMoney ?? 0, 4, { min: 0, allowNegative: false });
        this.#valuePercentage = new Percentage(dto.valuePercentage ?? 0, { min: 0, max: 1 });
        this.#inputRate = new Percentage(dto.inputRate ?? 0.06, { min: 0, max: 1 });

        // 计算基础校验
        this.#base = ValidateUtils.stringNotEmptyAndWhitespace(dto.base);
        this.#baseHaveTax = ValidateUtils.extendedBooleanConverter(dto.baseHaveTax);

        // 退款回收率处理（百分比转小数）
        this.#refundBefRec = new Percentage(dto.refundBefRec, { min: 0, max: 1 });
        this.#refundIngRec = new Percentage(dto.refundIngRec, { min: 0, max: 1 });
        this.#refundAftRec = new Percentage(dto.refundAftRec, { min: 0, max: 1 });
    }

    static parse(dto) {
        return new Model_PlanParams_Expense_PerOrder({
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
        });
    }

    // Getters
    get name() { return this.#name; }
    get valueMoney() { return this.#valueMoney; }
    get valuePercentage() { return this.#valuePercentage; }
    get valueType() { return this.#valueType; }
    get base() { return this.#base; }
    get baseHaveTax() { return this.#baseHaveTax; }
    get inputRate() { return this.#inputRate; }
    get refundBefRec() { return this.#refundBefRec; }
    get refundIngRec() { return this.#refundIngRec; }
    get refundAftRec() { return this.#refundAftRec; }

    // 私有方法：校验费用类型
    #validateAndSetValueType(type) {
        const t = ValidateUtils.stringNotEmptyAndWhitespace(type);
        const validTypes = ['num', 'per'];
        if (!validTypes.includes(t)) {
            throw new TypeError(`费用类型必须是${validTypes.join('或')}，当前值：${t}`);
        }
        return t;
    }
}