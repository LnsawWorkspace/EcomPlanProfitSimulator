import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';
import ValidateUtils from '../../infrastructure/ValidateUtils.js';

// ==================== ExpenseAvgItems ====================
/**
 * 一次性支出，和订单上什么的没关系，不用考虑什么退款之类的，总之就是一笔彻底的固定支出。
 * 2025-12-24 大修改：改成了和Expense_PerOrder类似的结构，支持百分比和金额两种形式的支出定义
 * 用来支持基于销售额、利润等模式的支持，例如按照销售额或利润的一定比例作为主播、运营、等人员的提成。
 * @class Model_PlanParams_Expense_Fixed
 * @classdesc 固定支出实体类，用于存储计划的固定支出信息
 */
export class Model_PlanParams_Expense_Fixed {
    #name;
    #valueMoney;         // 费用数值（金额）
    #valuePercentage;    // 费用数值（百分比）
    #valueType;           // 费用类型：'num'（金额）/'per'（百分比）
    #inputRate;           // 进项税率（小数形式0-1）

    #base;                // 计算基础（百分比时必填），只有当valueType是per的时候，才有意义
    #baseHaveTax;         // 是否基于含税金额计算,只有当valueType是per的时候，才有意义，这个参数目前似乎没什么用。但是先保留。

    /**
     * @param {Object} dto
     * @param {string} dto.name 不能为空
     * @param {number|string|Decimal} dto.value 不能为空
     * @param {number|string|Decimal} dto.inputRate 可选，默认值为6
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
        this.#baseHaveTax = true;
    }

    static parse(dto) {
        return new Model_PlanParams_Expense_Fixed({
            name: dto.name,
            valueType: dto.valueType,
            valueMoney: dto.valueMoney.value,
            valuePercentage: dto.valuePercentage.value,
            inputRate: dto.inputRate.value,
            base: dto.base,
            baseHaveTax: dto.baseHaveTax,
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