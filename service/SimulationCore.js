import { Entity_PlanReport } from '../domain/report/Entity_PlanReport.js';
import { Model_Report_SalesRevenue, Model_Report_SalesRevenue_Item } from '../domain/report/Model_Report_SalesRevenue.js';
import { Model_Report_GoodsCost, Model_Report_GoodsCost_Item } from '../domain/report/Model_Report_GoodsCost.js';
import { Model_Report_GiftCost, Model_Report_GiftCost_Item } from '../domain/report/Model_Report_GiftCost.js';
import { Model_Report_Enpense_PerOrder, Model_Report_Enpense_PerOrder_Item } from '../domain/report/Model_Report_Enpense_PerOrder.js';
import { Model_Report_Enpense_MNPerOrder, Model_Report_Enpense_MNPerOrder_Item } from '../domain/report/Model_Report_Enpense_MNPerOrder.js';
import { Model_Report_Enpense_Fixed, Model_Report_Enpense_Fixed_Item } from '../domain/report/Model_Report_Enpense_Fixed.js';
import { Model_Report_Ext } from '../domain/report/Model_Report_Ext.js';

import { Entity_PlanParams } from '../domain/plan/Entity_PlanParams.js';
import Decimal from '../infrastructure/decimal.mjs';
import Percentage from '../infrastructure/Percentage.js';
import Money from '../infrastructure/Money.js';
import Integer from '../infrastructure/Integer.js';


export class SimulationCore {

    /**
     * 
     * @param {Entity_PlanParams} entity 
     * @returns {any}
     */
    runSimulation(entity) {
        console.log('%c  + start Simulation:', "color: green", performance.now());
        entity.modelPlanParamsSale.quantityPattern = 'real';
        const report = new Entity_PlanReport({ id: crypto.randomUUID() });
        this.#getSalesRevenue(entity, report);
        this.#getGoodsCost(entity, report);
        this.#getGiftCost(entity, report);
        this.#getEnpensePerOrder(entity, report);
        this.#getEnpenseMNPerOrder(entity, report);
        this.#getEnpenseFixed(entity, report);
        this.#getAdvertisingCost(entity, report);
        this.#getExtReport(entity, report);
        console.log('%c  + end Simulation:', "color: green", performance.now());
        return report;
    }

    /**
     * @param {Entity_PlanParams} entity_params
     * @param {Entity_PlanReport} entity_report
     * @return {boolean}
     */
    #getSalesRevenue_PayOrderQuantity(entity_params, entity_report) {
        const report = entity_report.modelReportSalesRevenue;
        if (entity_params.modelPlanParamsSale.quantityPattern === 'real') {
            report.订单数量_退款前 = entity_params.modelPlanParamsSale.payOrderQuantity;
            report.订单数量_退款后 = report.订单数量_退款前.times(Percentage.ONE_HUNDRED_PERCENT.minus(entity_params.modelPlanParamsRefund.refundTotalPer).value, { rounding: Integer.ROUND_DOWN });
            report.订单数量_售前损失 = report.订单数量_退款前.times(entity_params.modelPlanParamsRefund.refundBefPer.value);
            report.订单数量_售中损失 = report.订单数量_退款前.times(entity_params.modelPlanParamsRefund.refundIngPer.value);
            report.订单数量_售后损失 = report.订单数量_退款前.times(entity_params.modelPlanParamsRefund.refundAftPer.value);
            report.订单数量_原始差额 = report.订单数量_退款前.minus(report.订单数量_退款后).minus(report.订单数量_售前损失.plus(report.订单数量_售中损失).plus(report.订单数量_售后损失));
            report.订单数量_退款后 = report.订单数量_退款后.plus(report.订单数量_原始差额);

            // - 似乎不用像下边这复杂的去算余数，然后分配给各个损失部分。
            // - 实际上，需要调整的很可能不是三个部分的退款损失，而是退款后这一项。
            // - 其他地方都改成直接修正退款后这一项，仅这里保留算余数的方法的记录。方便以后回顾。
            // if (!report.订单数量_原始差额.isNegative()) {
            //     const 余数 = [
            //         { name: '订单数量_售前损失', value: report.订单数量_售前损失.value },
            //         { name: '订单数量_售中损失', value: report.订单数量_售中损失.value },
            //         { name: '订单数量_售后损失', value: report.订单数量_售后损失.value },
            //     ]
            //     const 分配结果 = this.#GF(余数, report.订单数量_原始差额.value);
            //     report.订单数量_售前损失 = new Integer(分配结果['订单数量_售前损失'], { rounding: Integer.ROUND_DOWN });
            //     report.订单数量_售中损失 = new Integer(分配结果['订单数量_售中损失'], { rounding: Integer.ROUND_DOWN });
            //     report.订单数量_售后损失 = new Integer(分配结果['订单数量_售后损失'], { rounding: Integer.ROUND_DOWN });
            // } else {
            //     report.订单数量_售前损失 = new Integer(report.订单数量_售前损失.value, { rounding: Integer.ROUND_DOWN });
            //     report.订单数量_售中损失 = new Integer(report.订单数量_售中损失.value, { rounding: Integer.ROUND_DOWN });
            //     report.订单数量_售后损失 = new Integer(report.订单数量_售后损失.value, { rounding: Integer.ROUND_DOWN });
            //     report.订单数量_退款后 = report.订单数量_退款后.plus(report.订单数量_原始差额);
            // }
        }
        else {
            // 用Money类型代替Integer类型进行计算，实际单位仍然是数量。
            // 似乎没有必要计算小数点的销量。全部用real模式就行。不过也未必。比如单量是1的时候。
            // 不过绝大部分都可以用real模式。
            report.订单数量_退款前 = new Money(entity_params.modelPlanParamsSale.payOrderQuantity, 4);
            report.订单数量_退款后 = report.订单数量_退款前.times(Percentage.ONE_HUNDRED_PERCENT.minus(entity_params.modelPlanParamsRefund.refundTotalPer), 4);
            report.订单数量_售前损失 = report.订单数量_退款前.times(entity_params.modelPlanParamsRefund.refundBefPer, 4)
            report.订单数量_售中损失 = report.订单数量_退款前.times(entity_params.modelPlanParamsRefund.refundIngPer, 4)
            report.订单数量_售后损失 = report.订单数量_退款前.times(entity_params.modelPlanParamsRefund.refundAftPer, 4)
            report.订单数量_原始差额 = report.订单数量_退款前.minus(report.订单数量_退款后).minus(report.订单数量_售前损失.plus(report.订单数量_售中损失).plus(report.订单数量_售后损失), 4);
            report.订单数量_退款后 = report.订单数量_退款后.plus(report.订单数量_原始差额);
        }
    }
    /**
     * @param {Entity_PlanParams} entity_params
     * @param {Entity_PlanReport} entity_report
     */
    #getSalesRevenue(entity_params, entity_report) {
        // 先算单量
        this.#getSalesRevenue_PayOrderQuantity(entity_params, entity_report);

        const report = entity_report.modelReportSalesRevenue;

        // 判断商品销项税率是否一致，如果一致，则不分配售价，不计算明细。
        const firstOutputRate = entity_params.modelPlanParamsGoods[0].outputRate;
        const 商品税率一致 = entity_params.modelPlanParamsGoods.every(goodsItem => goodsItem.outputRate.equals(firstOutputRate));

        if (商品税率一致) {
            const 商品单售价 = entity_params.modelPlanParamsSale.salePrice;
            report.GMV_退款前 = 商品单售价.times(report.订单数量_退款前, 4);
            report.GMV_退款后 = 商品单售价.times(report.订单数量_退款后, 4);
            report.GMV_售前损失 = 商品单售价.times(report.订单数量_售前损失, 4);
            report.GMV_售中损失 = 商品单售价.times(report.订单数量_售中损失, 4);
            report.GMV_售后损失 = 商品单售价.times(report.订单数量_售后损失, 4);
            report.GMV_原始差额 = report.GMV_退款前.minus(report.GMV_退款后).minus(report.GMV_售前损失.plus(report.GMV_售中损失).plus(report.GMV_售后损失), 4);
            report.GMV_退款后 = report.GMV_退款后.plus(report.GMV_原始差额);

            const 商品单收入 = 商品单售价.dividedBy(Percentage.ONE_HUNDRED_PERCENT.plus(firstOutputRate), 4);
            report.收入_退款前 = 商品单收入.times(report.订单数量_退款前, 4);
            report.收入_退款后 = 商品单收入.times(report.订单数量_退款后, 4);
            report.收入_售前损失 = 商品单收入.times(report.订单数量_售前损失, 4);
            report.收入_售中损失 = 商品单收入.times(report.订单数量_售中损失, 4);
            report.收入_售后损失 = 商品单收入.times(report.订单数量_售后损失, 4);
            report.收入_原始差额 = report.收入_退款前.minus(report.收入_退款后).minus(report.收入_售前损失.plus(report.收入_售中损失).plus(report.收入_售后损失), 4);
            report.收入_退款后 = report.收入_退款后.plus(report.收入_原始差额);
        } else {
            // 计算用来分配销售额的商品总成本或总公允价值
            let totalCost = null;
            if (entity_params.modelPlanParamsSale.method === 'cost') {
                totalCost = entity_params.modelPlanParamsGoods.reduce((acc, goodsItem) => {
                    return acc.plus(goodsItem.valueExcTax);
                }, new Money(0, 4));
            } else if (entity_params.modelPlanParamsSale.method === 'fair') {
                totalCost = entity_params.modelPlanParamsGoods.reduce((acc, goodsItem) => {
                    return acc.plus(goodsItem.fairValue);
                }, new Money(0, 4));
            } else {
                throw new Error(`未知的售价分配方法：${entity_params.modelPlanParamsSale.method}`);
            }
            // 根据成本或公允价值比例分配售价
            const 分配后的售价 = [];
            entity_params.modelPlanParamsGoods.forEach((goodsItem) => {
                const 当前商品成本 = entity_params.modelPlanParamsSale.method === 'cost' ? goodsItem.valueExcTax : goodsItem.fairValue;
                const 当前商品成本占比 = new Percentage(当前商品成本.dividedBy(totalCost, 10).value);
                const 当前商品单售价 = entity_params.modelPlanParamsSale.salePrice.times(当前商品成本占比, 4);
                分配后的售价.push({
                    商品名称: goodsItem.name,
                    进项税率: goodsItem.inputRate,
                    销项税率: goodsItem.outputRate,
                    当前商品单售价: 当前商品单售价,
                });
            });
            // 这个地方还真就必须得用余数的方式来分配差额了。将1个大数分成N个小数，小数的和不可能大于1。除非使用了不当的四舍五入。
            // money的舍入方法默认用的是银行家舍入法。也就是四舍六入五成双。理论上能降低一部分误差。但不太确认这里是否需要。
            // 不管怎么样，这里必须得用余数分配法来分配差额。避免分配后的售价总和与预期不符。
            const 售价差 = entity_params.modelPlanParamsSale.salePrice.minus(分配后的售价.reduce((acc, item) => acc.plus(item.当前商品单售价), new Money(0, 8)));
            const 售价余数 = 分配后的售价.map(item => { return { name: item.商品名称, value: item.当前商品单售价.value }; });
            const 售价分配结果 = this.#GF(售价余数, 售价差.value);
            分配后的售价.forEach(item => { item.当前商品单售价 = new Money(售价分配结果[item.商品名称], 8); });

            // 然后按照比例计算单个商品的收入,收入是不含税的，需要/(1+outputRate)
            分配后的售价.forEach((goodsItem) => {
                // - 当前商品单售价和当前商品单收入都是8的精度。至于原因了，大概是因为有好处吧。
                // - 虽然是这样决定的。但我也不知道到底是为什么。
                // - 好像想起来了？比如 100块钱分给3个商品，每个33.33333333，最后一个33.33333334，但这个是在分配销售额的那个地方算的。和这里用8位精度没关系吧？
                // - 生气！自己写都写不明白。算了 反正用8位精度数据没出错就行了。
                const 当前商品单售价 = goodsItem.当前商品单售价
                const 当前商品单收入 = goodsItem.当前商品单售价.dividedBy(Percentage.ONE_HUNDRED_PERCENT.plus(goodsItem.销项税率), 8);

                const revenueItem = new Model_Report_SalesRevenue_Item();
                revenueItem.商品名称 = goodsItem.商品名称;
                revenueItem.商品税率 = goodsItem.进项税率;
                revenueItem.销项税率 = goodsItem.销项税率;

                revenueItem.GMV_退款前 = 当前商品单售价.times(report.订单数量_退款前, 4);
                revenueItem.GMV_退款后 = 当前商品单售价.times(report.订单数量_退款后, 4);
                revenueItem.GMV_售前损失 = 当前商品单售价.times(report.订单数量_售前损失, 4);
                revenueItem.GMV_售中损失 = 当前商品单售价.times(report.订单数量_售中损失, 4);
                revenueItem.GMV_售后损失 = 当前商品单售价.times(report.订单数量_售后损失, 4);
                revenueItem.GMV_原始差额 = revenueItem.GMV_退款前.minus(revenueItem.GMV_退款后).minus(revenueItem.GMV_售前损失.plus(revenueItem.GMV_售中损失).plus(revenueItem.GMV_售后损失), 4);
                revenueItem.GMV_退款后 = revenueItem.GMV_退款后.plus(revenueItem.GMV_原始差额);

                // - 收入的计算方法到底用什么算比较合适？应该用GMV/(1+outputRate)来计算收入？还是用售价/(1+outputRate)*数量来计算收入？
                // - 结果可能一样但是逻辑上是有区别的。但两种逻辑都不能说错。
                // - 假如给客户开票是1单1单的开票，那么用单收入*数量来计算收入是对的。
                // - 假如给客户开票是汇总开票，那么用GMV来计算收入是对的。
                // - 这就让人很纠结了。
                // - 按理说电商一个订单一个客户，一个订单一个发票。那么用单收入*数量来计算收入应该最合适。
                revenueItem.收入_退款前 = 当前商品单收入.times(report.订单数量_退款前, 4);
                revenueItem.收入_退款后 = 当前商品单收入.times(report.订单数量_退款后, 4);
                revenueItem.收入_售前损失 = 当前商品单收入.times(report.订单数量_售前损失, 4);
                revenueItem.收入_售中损失 = 当前商品单收入.times(report.订单数量_售中损失, 4);
                revenueItem.收入_售后损失 = 当前商品单收入.times(report.订单数量_售后损失, 4);
                revenueItem.收入_原始差额 = revenueItem.收入_退款前.minus(revenueItem.收入_退款后).minus(revenueItem.收入_售前损失.plus(revenueItem.收入_售中损失).plus(revenueItem.收入_售后损失), 4);
                revenueItem.收入_退款后 = revenueItem.收入_退款后.plus(revenueItem.收入_原始差额);

                report.明细.push(revenueItem);

                // - 又开始纠结了。既然是商品销项税率不一致的情况下，必须分配销售额，那么这里的总和不如就直接累计各项更合适。
                // - 因为本来就对不上数的，也没办法对上数。GMV到是可以对上，但收入由于存在税率系数，几乎没法对上数。
                // - 所以 到底是高精度累加，最后四舍五入。还是直接明细累加呢？

                // - 先按照最高精度累加，最后再四舍五入到4位小数，减少计算误差带来的影响。
                report.GMV_退款前 = report.GMV_退款前.plus(当前商品单售价.times(report.订单数量_退款前));
                report.GMV_退款后 = report.GMV_退款后.plus(当前商品单售价.times(report.订单数量_退款后));
                report.GMV_售前损失 = report.GMV_售前损失.plus(当前商品单售价.times(report.订单数量_售前损失));
                report.GMV_售中损失 = report.GMV_售中损失.plus(当前商品单售价.times(report.订单数量_售中损失));
                report.GMV_售后损失 = report.GMV_售后损失.plus(当前商品单售价.times(report.订单数量_售后损失));
                // - 先按照最高精度累加，最后再四舍五入到4位小数，减少计算误差带来的影响。
                report.收入_退款前 = report.收入_退款前.plus(当前商品单收入.times(report.订单数量_退款前));
                report.收入_退款后 = report.收入_退款后.plus(当前商品单收入.times(report.订单数量_退款后));
                report.收入_售前损失 = report.收入_售前损失.plus(当前商品单收入.times(report.订单数量_售前损失));
                report.收入_售中损失 = report.收入_售中损失.plus(当前商品单收入.times(report.订单数量_售中损失));
                report.收入_售后损失 = report.收入_售后损失.plus(当前商品单收入.times(report.订单数量_售后损失));
            });

            report.GMV_退款前 = new Money(report.GMV_退款前.value, 4);
            report.GMV_退款后 = new Money(report.GMV_退款后.value, 4);
            report.GMV_售前损失 = new Money(report.GMV_售前损失.value, 4);
            report.GMV_售中损失 = new Money(report.GMV_售中损失.value, 4);
            report.GMV_售后损失 = new Money(report.GMV_售后损失.value, 4);
            report.GMV_原始差额 = report.GMV_退款前.minus(report.GMV_退款后).minus(report.GMV_售前损失.plus(report.GMV_售中损失).plus(report.GMV_售后损失), 4);
            report.GMV_退款后 = report.GMV_退款后.plus(report.GMV_原始差额);

            report.收入_退款前 = new Money(report.收入_退款前.value, 4);
            report.收入_退款后 = new Money(report.收入_退款后.value, 4);
            report.收入_售前损失 = new Money(report.收入_售前损失.value, 4);
            report.收入_售中损失 = new Money(report.收入_售中损失.value, 4);
            report.收入_售后损失 = new Money(report.收入_售后损失.value, 4);
            report.收入_原始差额 = report.收入_退款前.minus(report.收入_退款后).minus(report.收入_售前损失.plus(report.收入_售中损失).plus(report.收入_售后损失), 4);
        }
    }

    /**
     * @param {Entity_PlanParams} entity_params
     * @param {Entity_PlanReport} entity_report
     */
    #getGoodsCost(entity_params, entity_report) {
        const report = entity_report.modelReportGoodsCost;

        entity_params.modelPlanParamsGoods?.forEach((goodsItem) => {
            const costItem = new Model_Report_GoodsCost_Item();
            costItem.商品名称 = goodsItem.name;
            costItem.商品成本_含税 = goodsItem.valueIncTax;
            costItem.商品成本_不含税 = goodsItem.valueExcTax;
            costItem.进项税率 = goodsItem.inputRate;

            costItem.商品数量_退款前 = entity_report.modelReportSalesRevenue.订单数量_退款前.times(goodsItem.quantity, 4);
            costItem.商品数量_退款后 = entity_report.modelReportSalesRevenue.订单数量_退款后.times(goodsItem.quantity, 4);
            costItem.商品数量_售前损失 = entity_report.modelReportSalesRevenue.订单数量_售前损失.times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundBefRec).value).times(goodsItem.quantity, 4);
            costItem.商品数量_售中损失 = entity_report.modelReportSalesRevenue.订单数量_售中损失.times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundIngRec).value).times(goodsItem.quantity, 4);
            costItem.商品数量_售后损失 = entity_report.modelReportSalesRevenue.订单数量_售后损失.times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundAftRec).value).times(goodsItem.quantity, 4);

            // 这里没办法判断 退款前-退款后 = 售前损失 + 售中损失 + 售后损失 是否成立。因为损失存在系数。

            costItem.商品成本_退款前 = goodsItem.valueExcTax.times(costItem.商品数量_退款前, 4);
            costItem.商品成本_退款后 = goodsItem.valueExcTax.times(costItem.商品数量_退款后, 4);
            costItem.商品成本_售前损失 = goodsItem.valueExcTax.times(costItem.商品数量_售前损失, 4);
            costItem.商品成本_售中损失 = goodsItem.valueExcTax.times(costItem.商品数量_售中损失, 4);
            costItem.商品成本_售后损失 = goodsItem.valueExcTax.times(costItem.商品数量_售后损失, 4);

            report.明细.push(costItem);

            report.商品成本_退款前 = report.商品成本_退款前.plus(costItem.商品成本_退款前);
            report.商品成本_退款后 = report.商品成本_退款后.plus(costItem.商品成本_退款后);
            report.商品成本_售前损失 = report.商品成本_售前损失.plus(costItem.商品成本_售前损失);
            report.商品成本_售中损失 = report.商品成本_售中损失.plus(costItem.商品成本_售中损失);
            report.商品成本_售后损失 = report.商品成本_售后损失.plus(costItem.商品成本_售后损失);
        });
    }

    /**
     * @param {Entity_PlanParams} entity_params
     * @param {Entity_PlanReport} entity_report
     */
    #getGiftCost(entity_params, entity_report) {
        const report = entity_report.modelReportGiftCost;

        entity_params.modelPlanParamsGift?.forEach((giftItem) => {
            const costItem = new Model_Report_GiftCost_Item();
            costItem.赠品名称 = giftItem.name;
            costItem.赠品成本_含税 = giftItem.valueIncTax;
            costItem.赠品成本_不含税 = giftItem.valueExcTax;
            costItem.进项税率 = giftItem.inputRate;

            costItem.赠品数量_退款前 = entity_report.modelReportSalesRevenue.订单数量_退款前.times(giftItem.quantity, 4);
            costItem.赠品数量_退款后 = entity_report.modelReportSalesRevenue.订单数量_退款后.times(giftItem.quantity, 4);
            costItem.赠品数量_售前损失 = entity_report.modelReportSalesRevenue.订单数量_售前损失.times(Percentage.ONE_HUNDRED_PERCENT.minus(giftItem.refundBefRec).value).times(giftItem.quantity, 4);
            costItem.赠品数量_售中损失 = entity_report.modelReportSalesRevenue.订单数量_售中损失.times(Percentage.ONE_HUNDRED_PERCENT.minus(giftItem.refundIngRec).value).times(giftItem.quantity, 4);
            costItem.赠品数量_售后损失 = entity_report.modelReportSalesRevenue.订单数量_售后损失.times(Percentage.ONE_HUNDRED_PERCENT.minus(giftItem.refundAftRec).value).times(giftItem.quantity, 4);

            // 这里没办法判断 退款前-退款后 = 售前损失 + 售中损失 + 售后损失 是否成立。因为损失存在系数。

            costItem.赠品成本_退款前 = giftItem.valueExcTax.times(costItem.赠品数量_退款前, 4);
            costItem.赠品成本_退款后 = giftItem.valueExcTax.times(costItem.赠品数量_退款后, 4);
            costItem.赠品成本_售前损失 = giftItem.valueExcTax.times(costItem.赠品数量_售前损失, 4);
            costItem.赠品成本_售中损失 = giftItem.valueExcTax.times(costItem.赠品数量_售中损失, 4);
            costItem.赠品成本_售后损失 = giftItem.valueExcTax.times(costItem.赠品数量_售后损失, 4);

            // 判断是否需要额外缴税
            if (giftItem.subjectType === '视同销售') {
                const 税率 = giftItem.outputRate;
                let 应税金额 = new Money(0, 4);
                if (giftItem.fairValue.greaterThan(应税金额)) {
                    // 理论上退款后的那部分不应该开票，因此不算入到税额中。
                    应税金额 = giftItem.fairValue.times(costItem.赠品数量_退款后, 4).minus(costItem.赠品成本_退款后, 4);
                } else {
                    应税金额 = costItem.赠品成本_退款后.times(0.1, 4);
                }
                costItem.赠品成本_额外缴税 = 应税金额.times(税率, 4);
            }

            report.明细.push(costItem);

            report.赠品成本_退款前 = report.赠品成本_退款前.plus(costItem.赠品成本_退款前);
            report.赠品成本_退款后 = report.赠品成本_退款后.plus(costItem.赠品成本_退款后);
            report.赠品成本_售前损失 = report.赠品成本_售前损失.plus(costItem.赠品成本_售前损失);
            report.赠品成本_售中损失 = report.赠品成本_售中损失.plus(costItem.赠品成本_售中损失);
            report.赠品成本_售后损失 = report.赠品成本_售后损失.plus(costItem.赠品成本_售后损失);
            report.赠品成本_额外缴税 = report.赠品成本_额外缴税.plus(costItem.赠品成本_额外缴税);
        });
    }

    /**
     * @param {Entity_PlanParams} entity_params
     * @param {Entity_PlanReport} entity_report
     */
    #getEnpensePerOrder(entity_params, entity_report) {
        const report = entity_report.modelreportEnpensePerOrder;

        entity_params.modelPlanParamsExpensePerOrder?.forEach((goodsItem) => {
            const costItem = new Model_Report_Enpense_PerOrder_Item();
            costItem.费用名称 = goodsItem.name;
            costItem.进项税率 = goodsItem.inputRate;

            let value = goodsItem.valueMoney;
            if (goodsItem.valueType !== 'num') {
                switch (goodsItem.base) {
                    case "售价":
                        if (goodsItem.baseHaveTax) {
                            //基于含税
                            value = entity_params.modelPlanParamsSale.salePrice.times(goodsItem.valuePercentage, 4);
                        }
                        break;

                    default:
                        break;
                }
            }

            costItem.费用成本_含税 = value;
            value = value.dividedBy(Percentage.ONE_HUNDRED_PERCENT.plus(goodsItem.inputRate), 4);
            costItem.费用成本_不含税 = value;


            costItem.费用成本_退款前 = value.times(entity_report.modelReportSalesRevenue.订单数量_退款前, 4);
            costItem.费用成本_退款后 = value.times(entity_report.modelReportSalesRevenue.订单数量_退款后, 4);
            costItem.费用成本_售前损失 = value.times(entity_report.modelReportSalesRevenue.订单数量_售前损失, 4).times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundBefRec), 4);
            costItem.费用成本_售中损失 = value.times(entity_report.modelReportSalesRevenue.订单数量_售中损失, 4).times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundIngRec), 4);
            costItem.费用成本_售后损失 = value.times(entity_report.modelReportSalesRevenue.订单数量_售后损失, 4).times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundAftRec), 4);

            report.明细.push(costItem);

            report.费用成本_退款前 = report.费用成本_退款前.plus(costItem.费用成本_退款前);
            report.费用成本_退款后 = report.费用成本_退款后.plus(costItem.费用成本_退款后);
            report.费用成本_售前损失 = report.费用成本_售前损失.plus(costItem.费用成本_售前损失);
            report.费用成本_售中损失 = report.费用成本_售中损失.plus(costItem.费用成本_售中损失);
            report.费用成本_售后损失 = report.费用成本_售后损失.plus(costItem.费用成本_售后损失);
        });
    }
    /**
     * @param {Entity_PlanParams} entity_params
     * @param {Entity_PlanReport} entity_report
     */
    #getEnpenseMNPerOrder_PayOrderQuantity(entity_params, entity_report) {
        const report = entity_report.modelreportEnpenseMNPerOrder;
        // - 判断使用那一种计算模式模式,大概率只需要在这里判断，其他的地方都一样
        // - 其他地方都是基于订单数量进行计算的，而不是基于退款率。
        // - 可以在做一版基于退款率的看看区别。按理说基于订单数量的更符合实际业务场景。
        // - 部分订单支出的那个项目可能需要额外处理，比如单独计算订单数量和退款率。
        // - 两种模式在大单量的情况下区别可能不是很大。
        entity_params.modelPlanParamsExpenseMNPerOrder?.forEach((goodsItem) => {

            const costItem = new Model_Report_Enpense_MNPerOrder_Item();
            costItem.费用名称 = goodsItem.name;
            costItem.进项税率 = goodsItem.inputRate;

            if (entity_params.modelPlanParamsSale.quantityPattern === 'real') {
                costItem.订单数量_退款前 = entity_params.modelPlanParamsSale.payOrderQuantity.times(goodsItem.orderPer.value, { rounding: Integer.ROUND_UP });
                costItem.订单数量_退款后 = costItem.订单数量_退款前.times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundTotalPer).value, { rounding: Integer.ROUND_DOWN });
                costItem.订单数量_售前损失 = costItem.订单数量_退款前.times(goodsItem.refundBefPer.value);
                costItem.订单数量_售中损失 = costItem.订单数量_退款前.times(goodsItem.refundIngPer.value);
                costItem.订单数量_售后损失 = costItem.订单数量_退款前.times(goodsItem.refundAftPer.value);
                costItem.订单数量_原始差额 = costItem.订单数量_退款前.minus(costItem.订单数量_退款后).minus(costItem.订单数量_售前损失.plus(costItem.订单数量_售中损失).plus(costItem.订单数量_售后损失));
                costItem.订单数量_退款后 = costItem.订单数量_退款后.plus(costItem.订单数量_原始差额);
            }
            else {
                costItem.订单数量_退款前 = new Money(entity_params.modelPlanParamsSale.payOrderQuantity.times(goodsItem.orderPer.value), 4);
                costItem.订单数量_退款后 = costItem.订单数量_退款前.times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundTotalPer), 4);
                costItem.订单数量_售前损失 = costItem.订单数量_退款前.times(goodsItem.refundBefPer, 4)
                costItem.订单数量_售中损失 = costItem.订单数量_退款前.times(goodsItem.refundIngPer, 4)
                costItem.订单数量_售后损失 = costItem.订单数量_退款前.times(goodsItem.refundAftPer, 4)
                costItem.订单数量_原始差额 = costItem.订单数量_退款前.minus(costItem.订单数量_退款后).minus(costItem.订单数量_售前损失.plus(costItem.订单数量_售中损失).plus(costItem.订单数量_售后损失), 4);
                costItem.订单数量_退款后 = costItem.订单数量_退款后.plus(costItem.订单数量_原始差额);
            }

            report.明细.push(costItem);

        });

    }
    /**
     * @param {Entity_PlanParams} entity_params
     * @param {Entity_PlanReport} entity_report
     */
    #getEnpenseMNPerOrder(entity_params, entity_report) {
        this.#getEnpenseMNPerOrder_PayOrderQuantity(entity_params, entity_report);
        const report = entity_report.modelreportEnpenseMNPerOrder;

        entity_params.modelPlanParamsExpenseMNPerOrder?.forEach((goodsItem) => {

            const costItem = report.明细.find(item => item.费用名称 === goodsItem.name);
            costItem.费用名称 = goodsItem.name;
            costItem.进项税率 = goodsItem.inputRate;

            let value = goodsItem.valueMoney;
            if (goodsItem.valueType !== 'num') {
                switch (goodsItem.base) {
                    case "售价":
                        if (goodsItem.baseHaveTax) {
                            //基于含税
                            value = entity_params.modelPlanParamsSale.salePrice.times(goodsItem.valuePercentage, 4);
                        }
                        break;

                    default:
                        break;
                }
            }

            costItem.费用成本_含税 = value;
            value = value.dividedBy(Percentage.ONE_HUNDRED_PERCENT.plus(goodsItem.inputRate), 4);
            costItem.费用成本_不含税 = value;

            costItem.费用成本_退款前 = value.times(costItem.订单数量_退款前, 4);
            costItem.费用成本_退款后 = value.times(costItem.订单数量_退款后, 4);
            costItem.费用成本_售前损失 = value.times(costItem.订单数量_售前损失, 4).times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundBefRec), 4);
            costItem.费用成本_售中损失 = value.times(costItem.订单数量_售中损失, 4).times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundIngRec), 4);
            costItem.费用成本_售后损失 = value.times(costItem.订单数量_售后损失, 4).times(Percentage.ONE_HUNDRED_PERCENT.minus(goodsItem.refundAftRec), 4);

            report.费用成本_退款前 = report.费用成本_退款前.plus(costItem.费用成本_退款前);
            report.费用成本_退款后 = report.费用成本_退款后.plus(costItem.费用成本_退款后);
            report.费用成本_售前损失 = report.费用成本_售前损失.plus(costItem.费用成本_售前损失);
            report.费用成本_售中损失 = report.费用成本_售中损失.plus(costItem.费用成本_售中损失);
            report.费用成本_售后损失 = report.费用成本_售后损失.plus(costItem.费用成本_售后损失);
        });
    }
    /**
     * @param {Entity_PlanParams} entity_params
     * @param {Entity_PlanReport} entity_report
     */
    #getEnpenseFixed(entity_params, entity_report) {
        const report = entity_report.modelReportEnpenseFixed;
        entity_params.modelPlanParamsExpenseFixed?.forEach((goodsItem) => {
            const costItem = new Model_Report_Enpense_Fixed_Item();
            costItem.费用名称 = goodsItem.name;
            costItem.进项税率 = goodsItem.inputRate;
            costItem.费用成本 = goodsItem.value.dividedBy(Percentage.ONE_HUNDRED_PERCENT.plus(goodsItem.inputRate), 4);

            report.明细.push(costItem);

            report.费用成本 = report.费用成本.plus(costItem.费用成本);
        });
    }
    /**
     * @param {Entity_PlanParams} entity_params
     * @param {Entity_PlanReport} entity_report
     */
    #getAdvertisingCost(entity_params, entity_report) {
        const report = entity_report.modelReportAdvertising;
        if (entity_params.modelPlanParamsAdvertising === undefined || entity_params.modelPlanParamsAdvertising === null) {
            return;
        }
        if (entity_params.modelPlanParamsAdvertising.name === undefined || entity_params.modelPlanParamsAdvertising.name === null || entity_params.modelPlanParamsAdvertising.name === '') {
            return;
        }
        if (entity_params.modelPlanParamsAdvertising.roi.equals(0)) {
            return;
        }

        // 通过ROI 计算具体的广告费用,按理说应该按照单价*数量比较合适
        const 单广告费用 = entity_params.modelPlanParamsSale.salePrice.dividedBy(entity_params.modelPlanParamsAdvertising.roi, 4);
        report.广告费用_退款前 = 单广告费用.times(entity_report.modelReportSalesRevenue.订单数量_退款前, 4);
        report.广告费用_退款后 = 单广告费用.times(entity_report.modelReportSalesRevenue.订单数量_退款后, 4);
        report.广告费用_售前损失 = 单广告费用.times(entity_report.modelReportSalesRevenue.订单数量_售前损失, 4);
        report.广告费用_售中损失 = 单广告费用.times(entity_report.modelReportSalesRevenue.订单数量_售中损失, 4);
        report.广告费用_售后损失 = 单广告费用.times(entity_report.modelReportSalesRevenue.订单数量_售后损失, 4);
        report.广告费用_原始差额 = report.广告费用_退款前.minus(report.广告费用_退款后).minus(report.广告费用_售前损失.plus(report.广告费用_售中损失).plus(report.广告费用_售后损失), 4);
        report.广告费用_退款后 = report.广告费用_退款后.plus(report.广告费用_原始差额);
    }
    /**
     * @param {Entity_PlanParams} entity_params
     * @param {Entity_PlanReport} entity_report
     */
    #getExtReport(entity_params, entity_report) {
        const report = entity_report.modelReportExt;
        let 总成本 = new Money(0, 4);
        总成本 = 总成本.plus(entity_report.modelReportGoodsCost.商品成本_有效成本);
        总成本 = 总成本.plus(entity_report.modelReportGiftCost.赠品成本_有效成本);
        总成本 = 总成本.plus(entity_report.modelreportEnpensePerOrder.费用成本_有效成本);
        总成本 = 总成本.plus(entity_report.modelreportEnpenseMNPerOrder.费用成本_有效成本);
        总成本 = 总成本.plus(entity_report.modelReportEnpenseFixed.费用成本);
        总成本 = 总成本.plus(entity_report.modelReportAdvertising.广告费用_有效成本);
        report.总成本 = 总成本;
        report.利润 = entity_report.modelReportSalesRevenue.收入_退款后.minus(总成本, 4);
        report.利润率 = report.利润.dividedBy(entity_report.modelReportSalesRevenue.收入_退款后, 4);
        report.资本回报率 = new Percentage(report.利润.dividedBy(总成本, 4).value);
        if (!entity_report.modelReportAdvertising.广告费用_有效成本.isZero()) {
            report.推广回报率 = new Percentage(report.利润.dividedBy(entity_report.modelReportAdvertising.广告费用_有效成本, 4).value);
        }
    }


    #GF(items, diff) {
        // - items的格式的 { name: 'xxx', value: Decimal } 的数组
        // - total 是 Decimal

        // - 将items的value 分成整数和小数部分
        const its = items.map(item => {
            return {
                name: item.name,
                value: item.value,
                // integerPart: item.value.floor(), // 整数部分目前没什么用，因为我们直接给value调整就行
                remainder: item.value.minus(item.value.floor())
            };
        });

        // - 然后找到小数部分最大的那个进行调整
        its.sort((a, b) => {
            return b.remainder.minus(a.remainder);
        });

        // - 给小数最大的那个integerPart+diff
        its[0].value = its[0].value.plus(diff);

        // - 最后赋值回去
        const result = {};
        its.forEach(item => {
            result[item.name] = item.value;
        });

        return result;
    }

}