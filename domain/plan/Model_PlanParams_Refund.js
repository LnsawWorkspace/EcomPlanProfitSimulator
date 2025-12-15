import Decimal from '../../infrastructure/decimal.mjs';
import Percentage from '../../infrastructure/Percentage.js';
import ValidateUtils from '../../infrastructure/ValidateUtils.js';

// ==================== RefundInfo ====================
/**
 * 退款配置实体类
 * @class Entity_Refund
 * @classdesc 退款配置实体类，用于存储退款的相关配置信息
 */
export class Model_PlanParams_Refund {
    #refundBefPer;     // 售前退款比例（小数形式，如0.05代表5%）
    #refundIngPer;     // 售中退款比例（小数形式）
    #refundAftPer;     // 售后退款比例（小数形式）
    #refundTotalPer;   // 总退款比例（小数形式）

    /**
      * @param {Object} [dto={}] - 退款配置对象
      * @param {number|string|Decimal} [dto.refundBefPer=0] - 售前退款比例（小数形式，0-1）
      * @param {number|string|Decimal} [dto.refundIngPer=0] - 售中退款比例（小数形式，0-1）
      * @param {number|string|Decimal} [dto.refundAftPer=0] - 售后退款比例（小数形式，0-1）
     */
    constructor(dto = {}) {
        // 初始化各退款比例（自动转换为小数）
        this.#refundBefPer = new Percentage(dto.refundBefPer || 0, { min: 0, max: 1 });
        this.#refundIngPer = new Percentage(dto.refundIngPer || 0, { min: 0, max: 1 });
        this.#refundAftPer = new Percentage(dto.refundAftPer || 0, { min: 0, max: 1 });
        this.#updateTotalPer();

    }

    static parse(dto) {
        if (!dto || typeof dto !== 'object') {
            throw new TypeError('parse 需要一个 DTO 对象');
        }
        return new Model_PlanParams_Refund({
            refundBefPer: dto.refundBefPer.value,
            refundIngPer: dto.refundIngPer.value,
            refundAftPer: dto.refundAftPer.value,
        });
    }

    // 私有方法：更新总退款比例
    #updateTotalPer() {
        this.#refundTotalPer = this.#refundBefPer.plus(this.#refundIngPer).plus(this.#refundAftPer, { min: 0, max: 1 });
    }

    // Getters（返回百分比形式或小数形式，按需选择）
    get refundBefPer() { return this.#refundBefPer; }
    get refundIngPer() { return this.#refundIngPer; }
    get refundAftPer() { return this.#refundAftPer; }
    get refundTotalPer() { return this.#refundTotalPer; }

    // Setters
    set refundBefPer(value) {
        this.#refundBefPer = new Percentage(value, { min: 0, max: 1 });
        this.#updateTotalPer();
    }

    set refundIngPer(value) {
        this.#refundIngPer = new Percentage(value, { min: 0, max: 1 });
        this.#updateTotalPer();
    }

    set refundAftPer(value) {
        this.#refundAftPer = new Percentage(value, { min: 0, max: 1 });
        this.#updateTotalPer();
    }
}