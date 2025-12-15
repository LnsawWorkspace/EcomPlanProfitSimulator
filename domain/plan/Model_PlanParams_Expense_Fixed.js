import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';
import ValidateUtils from '../../infrastructure/ValidateUtils.js';

// ==================== ExpenseAvgItems ====================
/**
 * 一次性支出，和订单上什么的没关系，不用考虑什么退款之类的，总之就是一笔彻底的固定支出。
 * @class Model_PlanParams_Expense_Fixed
 * @classdesc 固定支出实体类，用于存储计划的固定支出信息
 */
export class Model_PlanParams_Expense_Fixed {
    #name;
    #value;
    #inputRate;

    /**
     * @param {Object} dto
     * @param {string} dto.name 不能为空
     * @param {number|string|Decimal} dto.value 不能为空
     * @param {number|string|Decimal} dto.inputRate 可选，默认值为6
     */
    constructor(dto = {}) {
        this.#name = ValidateUtils.stringNotEmptyAndWhitespace(dto.name);
        this.#value = new Money(dto.value, 4, { allowNegative: false, allowZero: false });
        this.#inputRate = new Percentage(dto.inputRate ?? 0.06, { min: 0, max: 1 });
    }

    static parse(dto) {
        return new Model_PlanParams_Expense_Fixed({
            name: dto.name,
            value: dto.value.value,
            inputRate: dto.inputRate.value,
        });
    }

    // Getters
    get name() { return this.#name; }
    get value() { return this.#value; }
    get inputRate() { return this.#inputRate; }
}