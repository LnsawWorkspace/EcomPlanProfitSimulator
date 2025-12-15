import { Model_Report_SalesRevenue } from './Model_Report_SalesRevenue.js';
import { Model_Report_GoodsCost } from './Model_Report_GoodsCost.js';
import { Model_Report_GiftCost } from './Model_Report_GiftCost.js';
import { Model_Report_Enpense_PerOrder } from './Model_Report_Enpense_PerOrder.js';
import { Model_Report_Enpense_MNPerOrder } from './Model_Report_Enpense_MNPerOrder.js';
import { Model_Report_Enpense_Fixed } from './Model_Report_Enpense_Fixed.js';
import { Model_Report_Advertising } from './Model_Report_Advertising.js';
import { Model_Report_Ext } from './Model_Report_Ext.js';
import Entity_Base from './../Entity_Base.js';

export class Entity_PlanReport extends Entity_Base {
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
        this.#modelReportSalesRevenue = new Model_Report_SalesRevenue();
        this.#modelReportGoodsCost = new Model_Report_GoodsCost();
        this.#modelReportGiftCost = new Model_Report_GiftCost();
        this.#modelreportEnpensePerOrder = new Model_Report_Enpense_PerOrder();
        this.#modelreportEnpenseMNPerOrder = new Model_Report_Enpense_MNPerOrder();
        this.#modelReportEnpenseFixed = new Model_Report_Enpense_Fixed();
        this.#modelReportAdvertising = new Model_Report_Advertising();
        this.#modelReportExt = new Model_Report_Ext();
    }
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

}