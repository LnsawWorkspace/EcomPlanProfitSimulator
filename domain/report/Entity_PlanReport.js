import { Model_Report_SalesRevenue } from './Model_Report_SalesRevenue.js';
import { Model_Report_GoodsCost } from './Model_Report_GoodsCost.js';
import { Model_Report_GiftCost } from './Model_Report_GiftCost.js';
import { Model_Report_Enpense_PerOrder, Model_Report_Enpense_PerOrder_Item } from './Model_Report_Enpense_PerOrder.js';
import { Model_Report_Enpense_MNPerOrder } from './Model_Report_Enpense_MNPerOrder.js';
import { Model_Report_Enpense_Fixed } from './Model_Report_Enpense_Fixed.js';
import { Model_Report_Advertising } from './Model_Report_Advertising.js';
import { Model_Report_Ext } from './Model_Report_Ext.js';
import Entity_Base from './../Entity_Base.js';
import { Entity_PlanParams } from '../plan/Entity_PlanParams.js';

export class Entity_PlanReport extends Entity_Base {
    #planParams; // 计划参数
    #modelReportSalesRevenue; // 销售收入报告
    #modelReportGoodsCost;    // 商品成本报告
    #modelReportGiftCost;     // 赠品成本报告
    #modelreportEnpensePerOrder; // 单订单费用报告
    #modelreportEnpenseMNPerOrder; // 单订单人工及杂费报告
    #modelReportEnpenseFixed; // 固定费用报告
    #modelReportAdvertising; // 广告费用报告
    #modelReportExt; // 扩展报告

    /**
     * 创建PlanModel实例
     * @param {Object} dto - 初始化计划的数据对象
     * @param {string} dto.id - 计划唯一标识符,复用 PlanMeta的ID，这样就不用搞什么外键之类的东西了。
     * @param {Date} dto.createdAt - 计划创建时间
     * @param {Date} dto.updatedAt - 计划最后更新时间
     * @returns {Entity_PlanReport} 计划实体实例
     */
    constructor(dto) {
        super(dto.id, dto.createdAt, dto.updatedAt, "1.0.0");
        // 但是不知道为啥非得判断类型，才能toSerializable(),明明传入的就是这个类型。
        if (dto.planParams instanceof Entity_PlanParams) {
            // 拷贝，防止被修改导致引用变化
            this.#planParams = Entity_PlanParams.parse(dto.planParams.toSerializable());
        } else {
            this.#planParams = Entity_PlanParams.parse(dto.planParams);
        }
        this.#modelReportSalesRevenue = new Model_Report_SalesRevenue();
        this.#modelReportGoodsCost = new Model_Report_GoodsCost();
        this.#modelReportGiftCost = new Model_Report_GiftCost();
        this.#modelreportEnpensePerOrder = new Model_Report_Enpense_PerOrder();
        this.#modelreportEnpenseMNPerOrder = new Model_Report_Enpense_MNPerOrder();
        this.#modelReportEnpenseFixed = new Model_Report_Enpense_Fixed();
        this.#modelReportAdvertising = new Model_Report_Advertising();
        this.#modelReportExt = new Model_Report_Ext();
    }

    /** @returns {Entity_PlanParams} */
    get planParams() { return this.#planParams; }
    /** @returns {Model_Report_SalesRevenue} */
    get modelReportSalesRevenue() { return this.#modelReportSalesRevenue; }
    /** @returns {Model_Report_GoodsCost} */
    get modelReportGoodsCost() { return this.#modelReportGoodsCost; }
    /** @returns {Model_Report_GiftCost} */
    get modelReportGiftCost() { return this.#modelReportGiftCost; }
    /** @returns {Model_Report_Enpense_PerOrder} */
    get modelreportEnpensePerOrder() { return this.#modelreportEnpensePerOrder; }
    /** @returns {Model_Report_Enpense_MNPerOrder} */
    get modelreportEnpenseMNPerOrder() { return this.#modelreportEnpenseMNPerOrder; }
    /** @returns {Model_Report_Enpense_Fixed} */
    get modelReportEnpenseFixed() { return this.#modelReportEnpenseFixed; }
    /** @returns {Model_Report_Advertising} */
    get modelReportAdvertising() { return this.#modelReportAdvertising; }
    /** @returns {Model_Report_Ext} */
    get modelReportExt() { return this.#modelReportExt; }

    set planParams(value) { this.#planParams = value; }
    set modelReportSalesRevenue(value) { this.#modelReportSalesRevenue = value; }
    set modelReportGoodsCost(value) { this.#modelReportGoodsCost = value; }
    set modelReportGiftCost(value) { this.#modelReportGiftCost = value; }
    set modelreportEnpensePerOrder(value) { this.#modelreportEnpensePerOrder = value; }
    set modelreportEnpenseMNPerOrder(value) { this.#modelreportEnpenseMNPerOrder = value; }
    set modelReportEnpenseFixed(value) { this.#modelReportEnpenseFixed = value; }
    set modelReportAdvertising(value) { this.#modelReportAdvertising = value; }
    set modelReportExt(value) { this.#modelReportExt = value; }

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
        const entity = new Entity_PlanReport({ id: dto.id, createdAt: dto.createdAt, updatedAt: dto.updatedAt, entityModelVersion: dto.entityModelVersion, planParams: dto.planParams });

        // — 仅在传入对象有实际字段时构造对应模型 —

        // Sale（单对象）
        if (hasContent(dto.modelReportSalesRevenue)) {
            entity.modelReportSalesRevenue = (dto.modelReportSalesRevenue instanceof Model_Report_SalesRevenue)
                ? dto.modelReportSalesRevenue
                : Model_Report_SalesRevenue.parse(dto.modelReportSalesRevenue, dto.entityModelVersion);
        }
        // Advertising（单对象）
        if (hasContent(dto.modelReportAdvertising)) {
            entity.modelReportAdvertising = (dto.modelReportAdvertising instanceof Model_Report_Advertising)
                ? dto.modelReportAdvertising
                : Model_Report_Advertising.parse(dto.modelReportAdvertising);
        }
        // Goods（可能为数组或单对象）
        if (hasContent(dto.modelReportGoodsCost)) {
            if (Array.isArray(dto.modelReportGoodsCost)) {
                entity.modelReportGoodsCost = dto.modelReportGoodsCost
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_Report_GoodsCost) ? item : Model_Report_GoodsCost.parse(item));
            } else if (hasContent(dto.modelReportGoodsCost)) {
                // 单对象也支持
                entity.modelReportGoodsCost =
                    (dto.modelReportGoodsCost instanceof Model_Report_GoodsCost)
                        ? dto.modelReportGoodsCost
                        : Model_Report_GoodsCost.parse(dto.modelReportGoodsCost)
                    ;
            }
        }
        // Gift（可能为数组或单对象）
        if (hasContent(dto.modelReportGiftCost)) {
            if (Array.isArray(dto.modelReportGiftCost)) {
                entity.modelReportGiftCost = dto.modelReportGiftCost
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_Report_GiftCost) ? item : Model_Report_GiftCost.parse(item));
            } else if (hasContent(dto.modelReportGiftCost)) {
                entity.modelReportGiftCost =
                    (dto.modelReportGiftCost instanceof Model_Report_GiftCost)
                        ? dto.modelReportGiftCost
                        : Model_Report_GiftCost.parse(dto.modelReportGiftCost)
                    ;
            }
        }
        // Expense_PerOrder（可能为数组或单对象）
        if (hasContent(dto.modelreportEnpensePerOrder)) {
            if (Array.isArray(dto.modelreportEnpensePerOrder)) {
                entity.modelreportEnpensePerOrder = dto.modelreportEnpensePerOrder
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_Report_Enpense_PerOrder) ? item : Model_Report_Enpense_PerOrder.parse(item));
            } else if (hasContent(dto.modelreportEnpensePerOrder)) {
                entity.modelreportEnpensePerOrder =
                    (dto.modelreportEnpensePerOrder instanceof Model_Report_Enpense_PerOrder)
                        ? dto.modelreportEnpensePerOrder
                        : Model_Report_Enpense_PerOrder.parse(dto.modelreportEnpensePerOrder)
                    ;
            }
        }
        // Expense_MNPerOrder（可能为数组或单对象）
        if (hasContent(dto.modelreportEnpenseMNPerOrder)) {
            if (Array.isArray(dto.modelreportEnpenseMNPerOrder)) {
                entity.modelreportEnpenseMNPerOrder = dto.modelreportEnpenseMNPerOrder
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_Report_Enpense_MNPerOrder) ? item : Model_Report_Enpense_MNPerOrder.parse(item));
            } else if (hasContent(dto.modelreportEnpenseMNPerOrder)) {
                entity.modelreportEnpenseMNPerOrder =
                    (dto.modelreportEnpenseMNPerOrder instanceof Model_Report_Enpense_MNPerOrder)
                        ? dto.modelreportEnpenseMNPerOrder
                        : Model_Report_Enpense_MNPerOrder.parse(dto.modelreportEnpenseMNPerOrder)
                    ;
            }
        }
        // Expense_Fixed（可能为数组或单对象）
        if (hasContent(dto.modelReportEnpenseFixed)) {
            if (Array.isArray(dto.modelReportEnpenseFixed)) {
                entity.modelReportEnpenseFixed = dto.modelReportEnpenseFixed
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_Report_Enpense_Fixed) ? item : Model_Report_Enpense_Fixed.parse(item));
            } else if (hasContent(dto.modelReportEnpenseFixed)) {
                entity.modelReportEnpenseFixed =
                    (dto.modelReportEnpenseFixed instanceof Model_Report_Enpense_Fixed)
                        ? dto.modelReportEnpenseFixed
                        : Model_Report_Enpense_Fixed.parse(dto.modelReportEnpenseFixed)
                    ;
            }
        }

        // Model_Report_Ext（可能为数组或单对象）
        if (hasContent(dto.modelReportExt)) {
            if (Array.isArray(dto.modelReportExt)) {
                entity.modelReportExt = dto.modelReportExt
                    .filter(item => hasContent(item))
                    .map(item => (item instanceof Model_Report_Ext) ? item : Model_Report_Ext.parse(item));
            } else if (hasContent(dto.modelReportExt)) {
                entity.modelReportExt =
                    (dto.modelReportExt instanceof Model_Report_Ext)
                        ? dto.modelReportExt
                        : Model_Report_Ext.parse(dto.modelReportExt)
                    ;
            }
        }

        return entity;
    }


}