import { Model_PlanParams_Sale } from './Model_PlanParams_Sale.js';
import { Model_PlanParams_Refund } from './Model_PlanParams_Refund.js';
import { Model_PlanParams_Goods } from './Model_PlanParams_Goods.js';
import { Model_PlanParams_Gift } from './Model_PlanParams_Gift.js';
import { Model_PlanParams_Expense_PerOrder } from './Model_PlanParams_Expense_PerOrder.js';
import { Model_PlanParams_Expense_MNPerOrder } from './Model_PlanParams_Expense_MNPerOrder.js';
import { Model_PlanParams_Expense_Fixed } from './Model_PlanParams_Expense_Fixed.js';
import { Model_PlanParams_Advertising } from './Model_PlanParams_Advertising.js';
import Entity_Base from './../Entity_Base.js';
/**
 * 计划模型类，封装计划的所有属性和行为
 * @class PlanModel
 * @classdesc 表示一个完整的计划方案，包含基础信息、配置信息和明细项
 */
export class Entity_PlanParams extends Entity_Base {
    #modelPlanParamsSale; // 销售配置模型
    #modelPlanParamsRefund; // 退款配置模型
    #modelPlanParamsGoods; // 商品配置模型
    #modelPlanParamsGift; // 赠品配置模型
    #modelPlanParamsExpensePerOrder; // 每单费用配置模型
    #modelPlanParamsExpenseMNPerOrder; // M->N单费用配置模型
    #modelPlanParamsExpenseFixed; // 固定费用配置模型
    #modelPlanParamsAdvertising; // 广告费用配置模型

    /**
     * 创建PlanModel实例
     * @param {Object} dto - 初始化计划的数据对象
     * @param {string} dto.id - 计划唯一标识符,复用 PlanMeta的ID，这样就不用搞什么外键之类的东西了。
     * @param {Date} dto.createdAt - 计划创建时间
     * @param {Date} dto.updatedAt - 计划最后更新时间
     * @returns {Entity_PlanParams} 计划实体实例
     */
    constructor(dto) {
        super(dto.id, dto.createdAt, dto.updatedAt, "1.0.0");
    }

    /** @returns {Model_PlanParams_Sale} */
    get modelPlanParamsSale() { return this.#modelPlanParamsSale; }
    /** @returns {Model_PlanParams_Refund} */
    get modelPlanParamsRefund() { return this.#modelPlanParamsRefund; }
    /** @returns {Model_PlanParams_Goods} */
    get modelPlanParamsGoods() { return this.#modelPlanParamsGoods; }
    /** @returns {Model_PlanParams_Gift} */
    get modelPlanParamsGift() { return this.#modelPlanParamsGift; }
    /** @returns {Model_PlanParams_Expense_PerOrder} */
    get modelPlanParamsExpensePerOrder() { return this.#modelPlanParamsExpensePerOrder; }
    /** @returns {Model_PlanParams_Expense_MNPerOrder} */
    get modelPlanParamsExpenseMNPerOrder() { return this.#modelPlanParamsExpenseMNPerOrder; }
    /** @returns {Model_PlanParams_Expense_Fixed} */
    get modelPlanParamsExpenseFixed() { return this.#modelPlanParamsExpenseFixed; }
    /** @returns {Model_PlanParams_Advertising} */
    get modelPlanParamsAdvertising() { return this.#modelPlanParamsAdvertising; }

    /** @param {Model_PlanParams_Sale} value */
    set modelPlanParamsSale(value) { this.#modelPlanParamsSale = value; }
    /** @param {Model_PlanParams_Refund} value */
    set modelPlanParamsRefund(value) { this.#modelPlanParamsRefund = value; }
    /** @param {Model_PlanParams_Goods} value */
    set modelPlanParamsGoods(value) { this.#modelPlanParamsGoods = value; }
    /** @param {Model_PlanParams_Gift} value */
    set modelPlanParamsGift(value) { this.#modelPlanParamsGift = value; }
    /** @param {Model_PlanParams_Expense_PerOrder} value */
    set modelPlanParamsExpensePerOrder(value) { this.#modelPlanParamsExpensePerOrder = value; }
    /** @param {Model_PlanParams_Expense_MNPerOrder} value */
    set modelPlanParamsExpenseMNPerOrder(value) { this.#modelPlanParamsExpenseMNPerOrder = value; }
    /** @param {Model_PlanParams_Expense_Fixed} value */
    set modelPlanParamsExpenseFixed(value) { this.#modelPlanParamsExpenseFixed = value; }
    /** @param {Model_PlanParams_Advertising} value */
    set modelPlanParamsAdvertising(value) { this.#modelPlanParamsAdvertising = value; }


    /**
     * 将 DTO 对象解析为 Entity_PlanParams 实例
     * @param {Object} dto - 包含计划各部分配置的 DTO 对象
     * @returns {Entity_PlanParams} 解析得到的计划实体实例
     */
    static parse(dto) {
        if (!dto || typeof dto !== 'object') {
            throw new TypeError('parse 需要一个 DTO 对象');
        }

        // 辅助：判定对象是否包含有意义的数据（非 null/undefined，且非空对象/数组）
        const hasContent = (v) => {
            // null / undefined -> no content
            if (v === null || v === undefined) return false;

            // strings: treat empty/whitespace or textual 'undefined'/'null' as no content
            if (typeof v === 'string') {
                const s = v.trim().toLowerCase();
                if (s.length === 0) return false;
                if (s === 'undefined' || s === 'null') return false;
                return true;
            }

            // primitive non-object (number, boolean, symbol, bigint) -> considered content
            if (typeof v !== 'object') return true;

            // arrays: non-empty arrays are content
            if (Array.isArray(v)) return v.length > 0;

            // plain objects: consider it has content only if at least one own property
            // contains meaningful content (recursively checked). This prevents empty
            // objects or objects with only empty values from being treated as content.
            return Object.keys(v).some((k) => hasContent(v[k]));
        };

        // 要求 DTO 必须包含有效的 id（调用方应负责提供 PlanMeta 的 id）
        if (!dto.id || typeof dto.id !== 'string' || dto.id.trim().length === 0) {
            throw new TypeError('parse 需要 DTO 包含有效的 id 字段');
        }

        // 构造基础实体（id 由调用方提供并由 Entity_Base 校验）
        const entity = new Entity_PlanParams({ id: dto.id, createdAt: dto.createdAt, updatedAt: dto.updatedAt, entityModelVersion: dto.entityModelVersion });

        // — 仅在传入对象有实际字段时构造对应模型 —

        // Sale（单对象）
        if (hasContent(dto.modelPlanParamsSale)) {
            entity.modelPlanParamsSale = (dto.modelPlanParamsSale instanceof Model_PlanParams_Sale)
                ? dto.modelPlanParamsSale
                : Model_PlanParams_Sale.parse(dto.modelPlanParamsSale, dto.entityModelVersion);
        }
        // Refund（单对象）
        if (hasContent(dto.modelPlanParamsRefund)) {
            entity.modelPlanParamsRefund = (dto.modelPlanParamsRefund instanceof Model_PlanParams_Refund)
                ? dto.modelPlanParamsRefund
                : Model_PlanParams_Refund.parse(dto.modelPlanParamsRefund);
        }
        // Advertising（单对象）
        if (hasContent(dto.modelPlanParamsAdvertising)) {
            entity.modelPlanParamsAdvertising = (dto.modelPlanParamsAdvertising instanceof Model_PlanParams_Advertising)
                ? dto.modelPlanParamsAdvertising
                : Model_PlanParams_Advertising.parse(dto.modelPlanParamsAdvertising);
        }
        // Goods（可能为数组或单对象）
        if (hasContent(dto.modelPlanParamsGoods)) {
            if (Array.isArray(dto.modelPlanParamsGoods)) {
                entity.modelPlanParamsGoods = dto.modelPlanParamsGoods
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_PlanParams_Goods) ? item : Model_PlanParams_Goods.parse(item));
            } else if (hasContent(dto.modelPlanParamsGoods)) {
                // 单对象也支持
                entity.modelPlanParamsGoods = 
                    (dto.modelPlanParamsGoods instanceof Model_PlanParams_Goods)
                        ? dto.modelPlanParamsGoods
                        : Model_PlanParams_Goods.parse(dto.modelPlanParamsGoods)
                ;
            }
        }
        // Gift（可能为数组或单对象）
        if (hasContent(dto.modelPlanParamsGift)) {
            if (Array.isArray(dto.modelPlanParamsGift)) {
                entity.modelPlanParamsGift = dto.modelPlanParamsGift
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_PlanParams_Gift) ? item : Model_PlanParams_Gift.parse(item));
            } else if (hasContent(dto.modelPlanParamsGift)) {
                entity.modelPlanParamsGift = 
                    (dto.modelPlanParamsGift instanceof Model_PlanParams_Gift)
                        ? dto.modelPlanParamsGift
                        : Model_PlanParams_Gift.parse(dto.modelPlanParamsGift)
                ;
            }
        }
        // Expense_PerOrder（可能为数组或单对象）
        if (hasContent(dto.modelPlanParamsExpensePerOrder)) {
            if (Array.isArray(dto.modelPlanParamsExpensePerOrder)) {
                entity.modelPlanParamsExpensePerOrder = dto.modelPlanParamsExpensePerOrder
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_PlanParams_Expense_PerOrder) ? item : Model_PlanParams_Expense_PerOrder.parse(item));
            } else if (hasContent(dto.modelPlanParamsExpensePerOrder)) {
                entity.modelPlanParamsExpensePerOrder = 
                    (dto.modelPlanParamsExpensePerOrder instanceof Model_PlanParams_Expense_PerOrder)
                        ? dto.modelPlanParamsExpensePerOrder
                        : Model_PlanParams_Expense_PerOrder.parse(dto.modelPlanParamsExpensePerOrder)
                ;
            }
        }
        // Expense_MNPerOrder（可能为数组或单对象）
        if (hasContent(dto.modelPlanParamsExpenseMNPerOrder)) {
            if (Array.isArray(dto.modelPlanParamsExpenseMNPerOrder)) {
                entity.modelPlanParamsExpenseMNPerOrder = dto.modelPlanParamsExpenseMNPerOrder
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_PlanParams_Expense_MNPerOrder) ? item : Model_PlanParams_Expense_MNPerOrder.parse(item));
            } else if (hasContent(dto.modelPlanParamsExpenseMNPerOrder)) {
                entity.modelPlanParamsExpenseMNPerOrder = 
                    (dto.modelPlanParamsExpenseMNPerOrder instanceof Model_PlanParams_Expense_MNPerOrder)
                        ? dto.modelPlanParamsExpenseMNPerOrder
                        : Model_PlanParams_Expense_MNPerOrder.parse(dto.modelPlanParamsExpenseMNPerOrder)
                ;
            }
        }
        // Expense_Fixed（可能为数组或单对象）
        if (hasContent(dto.modelPlanParamsExpenseFixed)) {
            if (Array.isArray(dto.modelPlanParamsExpenseFixed)) {
                entity.modelPlanParamsExpenseFixed = dto.modelPlanParamsExpenseFixed
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_PlanParams_Expense_Fixed) ? item : Model_PlanParams_Expense_Fixed.parse(item));
            } else if (hasContent(dto.modelPlanParamsExpenseFixed)) {
                entity.modelPlanParamsExpenseFixed = 
                    (dto.modelPlanParamsExpenseFixed instanceof Model_PlanParams_Expense_Fixed)
                        ? dto.modelPlanParamsExpenseFixed
                        : Model_PlanParams_Expense_Fixed.parse(dto.modelPlanParamsExpenseFixed)
                ;
            }
        }

        return entity;
    }
}