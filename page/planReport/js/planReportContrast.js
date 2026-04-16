import { Model_PlanParams_Sale } from '../../../domain/plan/Model_PlanParams_Sale.js';
import { Model_PlanParams_Refund } from '../../../domain/plan/Model_PlanParams_Refund.js';
import { Model_PlanParams_Goods } from '../../../domain/plan/Model_PlanParams_Goods.js';
import { Model_PlanParams_Gift } from '../../../domain/plan/Model_PlanParams_Gift.js';

import { Model_PlanParams_Expense_PerOrder } from '../../../domain/plan/Model_PlanParams_Expense_PerOrder.js';
import { Model_PlanParams_Expense_MNPerOrder } from '../../../domain/plan/Model_PlanParams_Expense_MNPerOrder.js';
import { Model_PlanParams_Expense_Fixed } from '../../../domain/plan/Model_PlanParams_Expense_Fixed.js';

import { Model_PlanParams_Advertising } from '../../../domain/plan/Model_PlanParams_Advertising.js';

import { Entity_PlanParams } from '../../../domain/plan/Entity_PlanParams.js';
import { Repository_Workspace } from '../../../repository/Repository_Workspace.js';
import { Repository_PlanGroup } from '../../../repository/Repository_PlanGroup.js';
import { Repository_PlanMeta } from '../../../repository/Repository_PlanMeta.js';
import { Repository_PlanParams } from '../../../repository/Repository_PlanParams.js';
import LnsawTool from '../../../infrastructure/utils/LnsawTool.js';
import Decimal from '../../../infrastructure/decimal.mjs';
import { SimulationCore } from "../../../service/SimulationCore.js";

import Percentage from '../../../infrastructure/Percentage.js';
import Money from '../../../infrastructure/Money.js';

class PlanReportManager {
    #showToast = {};
    #elements = {};

    #simulationCore = null;
    #repositoryWorkspace = null;
    #repositoryPlanGroup = null;
    #repositoryPlanMeta = null;
    #repositoryPlanParams = null;
    #workspace = null;
    #planGroup = null;
    #planMeta = null;
    #planParams = null;
    #reportData = null;

    constructor() {
        this.#initializeShowToast();
    }
    async initialize() {
        this.#initializeElements();
        this.#initializeEventListeners();
        await this.#initPlanReport();
        Decimal.set({ precision: 40 });
    }
    /**
     * 初始化提示信息函数
     */
    #initializeShowToast() {
        this.#showToast = {
            success: (message, delay = 2000) => LnsawTool.showToast(message, 'success', delay),
            warning: (message, delay = 2000) => LnsawTool.showToast(message, 'warning', delay),
            error: (message, delay = 2000) => LnsawTool.showToast(message, 'danger', delay),
            info: (message, delay = 2000) => LnsawTool.showToast(message, 'info', delay),
        };
    }

    /**
     * 将DOM元素转为DOM对象
     */
    #initializeElements() {
        const elements_id = {

        };
        const element_class = {

        };
        // 使用Object.entries和解构赋值
        for (const [key, id] of Object.entries(elements_id)) {
            this.#elements[key] = document.getElementById(id);
        }
        for (const [key, class_name] of Object.entries(element_class)) {
            this.#elements[key] = document.querySelectorAll(class_name);
        }
    }
    /**
     * 设置事件监听
     */
    #initializeEventListeners() {
        // 使用Map和forEach优化事件监听设置
        const clickListeners = new Map([
        ]);

        for (const [elementKey, handler] of clickListeners) {
            this.#elements[elementKey]?.addEventListener('click', handler);
        }
    }
    /**
     * 初始化方案报告
     */
    async #initPlanReport() {
        //从url获取planId参数
        const urlParams = new URLSearchParams(window.location.search);
        const planId = urlParams.get('planId');
        const workspaceId = urlParams.get('workspaceId');
        const groupId = urlParams.get('groupId');
        if (workspaceId === undefined || workspaceId === null || workspaceId === ''
            || groupId === undefined || groupId === null || groupId === ''
            || planId === undefined || planId === null || planId === ''
        ) { this.#hidePage(); return; }
        this.#repositoryWorkspace = new Repository_Workspace();
        await this.#repositoryWorkspace.initDatabase();
        this.#workspace = await this.#repositoryWorkspace.getWorkspaceById(workspaceId);
        // 可以关闭 repositoryWorkspace了，因为不需要了
        this.#repositoryWorkspace.close();
        if (this.#workspace) {
            // 注意 repositoryPlanGroup, repositoryPlanMeta 和 repositoryPlanParams 用的是同一个链接，都是 workspaceId 对应的链接。 workspaceId 是库的名称。
            this.#repositoryPlanGroup = new Repository_PlanGroup(workspaceId);
            await this.#repositoryPlanGroup.initDatabase();
            this.#repositoryPlanMeta = new Repository_PlanMeta(workspaceId);
            await this.#repositoryPlanMeta.initDatabase();
            this.#repositoryPlanParams = new Repository_PlanParams(workspaceId);
            await this.#repositoryPlanParams.initDatabase();
            this.#planGroup = await this.#repositoryPlanGroup.getPlanGroupById(groupId);
            if (this.#planGroup) {
                this.#planMeta = await this.#repositoryPlanMeta.getPlanMetaById(planId);
                if (this.#planMeta) {
                    this.#planParams = await this.#repositoryPlanParams.getPlanParamsById(this.#planMeta.id);
                    if (this.#planParams) {
                        // 修改 .main-title 下的H1的内容
                        if (this.#planMeta && this.#planMeta.name) {
                            const titleElement = document.querySelector('.main-title');
                            if (titleElement) {
                                titleElement.textContent = `${this.#workspace.name} -> ${this.#planGroup.name} -> ${this.#planMeta.name}`;
                            }
                        }
                        this.#simulationCore = new SimulationCore();
                        this.#reportData = this.#simulationCore.runSimulation(this.#planParams);
                        console.log("可读性报表：", this.#reportData.toSerializable());
                        this.#showReport();
                    } else {
                        this.#hidePage();
                    }
                } else {
                    this.#hidePage();
                }
            } else {
                this.#hidePage();
            }
        } else {
            this.#hidePage();
        }
    }
    #hidePage() {
        // 隐藏整个页面，提示该方案不存在。
        document.body.innerHTML = '<div style="text-align:center; margin-top:50px;"><h2>方案或方案参数不存在。</h2></div>';
    }

    #showReport() {
        if (!this.#reportData) {
            this.#showToast.error('没有可显示的报告数据');
            return;
        }
        this.#showReport_Main();
        this.#showEcharts();
        this.#showGoodsTable();
        this.#showGiftTable();
        this.#showEnpenseTable();
    }
    #showReport_Main() {
        document.getElementById("totalOrderCount").textContent = this.#reportData.modelReportSalesRevenue.订单数量_退款前.toString() || "--";
        document.getElementById("totalValidOrderCount").textContent = this.#reportData.modelReportSalesRevenue.订单数量_退款后.toString() || "--";

        document.getElementById("totalGMV").textContent = this.#reportData.modelReportSalesRevenue.GMV_退款前.toLocaleFixed(4) || "--";
        document.getElementById("totalRevenue").textContent = this.#reportData.modelReportSalesRevenue.收入_退款后.toLocaleFixed(4) || "--";
        document.getElementById("totalCost").textContent = this.#reportData.modelReportExt.总成本.toLocaleFixed(4) || "--";
        document.getElementById("totalProfit").textContent = this.#reportData.modelReportExt.利润.toLocaleFixed(4) || "--";

        document.getElementById("totalROI_Business").textContent = this.#reportData.modelReportExt.资本回报率.toPercentString(4) || "--";
        // 如果this.#reportData.modelReportExt.资本回报率大于0，则显示绿色，否则显示红色
        this.#cardLeftStytle(this.#reportData.modelReportExt.资本回报率.value, document.getElementById("totalROI_Business"));

        if (!this.#reportData.modelReportExt.推广回报率.value.equals(0)) {
            const roiAdvertisingElement = document.getElementById("totalROI_Advertising");
            roiAdvertisingElement.textContent = this.#reportData.modelReportExt.推广回报率.toPercentString(4) || "--";
            this.#cardLeftStytle(this.#reportData.modelReportExt.推广回报率.value, roiAdvertisingElement);
        } else {
            const roiAdvertisingElement = document.getElementById("totalROI_Advertising");
            roiAdvertisingElement.textContent = "--";
        }

        document.getElementById("totalProfit_Per").textContent = this.#reportData.modelReportExt.利润率.toPercentString(4) || "--";
        this.#cardLeftStytle(this.#reportData.modelReportExt.利润率.value, document.getElementById("totalProfit_Per"));
        document.getElementById("totalRefundCost").textContent = this.#reportData.modelReportExt.因退款造成的成本损失.toLocaleFixed(4) || "--";
        document.getElementById("totalRefundProfit").textContent = this.#reportData.modelReportExt.因退款造成的利润损失.toLocaleFixed(4) || "--";

        document.getElementById("totalAdvertisingMoney").textContent = this.#reportData.modelReportAdvertising.广告费用_有效成本.toLocaleFixed(4) || "--";
    }
    #showEcharts() {
        this.Echarts.showCostStructureChart(this.Echarts.getCostStructureData(this.#reportData));
        this.Echarts.showRefundCostStructureChart(this.Echarts.getRefundCostStructureData(this.#reportData));
        this.D3.showrevenueAndCostWaterfallChart(this.D3.getrevenueAndCostWaterfallData(this.#reportData));
    }
    #showGoodsTable() {
        //清空tbody
        document.getElementById('Report_Container_Goods').innerHTML = '';
        this.#reportData.modelReportGoodsCost.明细.forEach(item => {
            // 声明tr，用create
            const tr = document.createElement('tr');
            tr.innerHTML = `
                        <td class="product-col">${item.商品名称}</td>
                        <td class="text-end">${item.商品成本_有效成本.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.商品成本_退款后.toLocaleFixed(4)}</td>

                        <td class="text-end">${item.商品成本_总退款损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.商品成本_售前损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.商品成本_售中损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.商品成本_售后损失.toLocaleFixed(4)}</td>
                                                
                        <td class="text-end">${new Percentage(item.商品成本_总退款损失.dividedBy(item.商品成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.商品成本_售前损失.dividedBy(item.商品成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.商品成本_售中损失.dividedBy(item.商品成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.商品成本_售后损失.dividedBy(item.商品成本_有效成本).value).toPercentString(4)}</td>
                        `;
            // 添加到tbody中
            document.getElementById('Report_Container_Goods').appendChild(tr);
        });
        // 声明tr，用create
        const tr = document.createElement('tr');
        tr.innerHTML = `
                    <td class="fw-bold product-col">总计</td>
                    <td class="text-end">${this.#reportData.modelReportGoodsCost.商品成本_有效成本.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGoodsCost.商品成本_退款后.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGoodsCost.商品成本_总退款损失.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGoodsCost.商品成本_售前损失.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGoodsCost.商品成本_售中损失.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGoodsCost.商品成本_售后损失.toLocaleFixed(4)}</td>
                    <td class="text-end">${new Percentage(this.#reportData.modelReportGoodsCost.商品成本_总退款损失.dividedBy(this.#reportData.modelReportGoodsCost.商品成本_有效成本).value).toPercentString(4)}</td>
                    <td class="text-end">${new Percentage(this.#reportData.modelReportGoodsCost.商品成本_售前损失.dividedBy(this.#reportData.modelReportGoodsCost.商品成本_有效成本).value).toPercentString(4)}</td>
                    <td class="text-end">${new Percentage(this.#reportData.modelReportGoodsCost.商品成本_售中损失.dividedBy(this.#reportData.modelReportGoodsCost.商品成本_有效成本).value).toPercentString(4)}</td>
                    <td class="text-end">${new Percentage(this.#reportData.modelReportGoodsCost.商品成本_售后损失.dividedBy(this.#reportData.modelReportGoodsCost.商品成本_有效成本).value).toPercentString(4)}</td>
                    `;
        //先清空
        document.getElementById('Report_Container_Goods_Foot').innerHTML = '';
        // 添加到tbody中,
        document.getElementById('Report_Container_Goods_Foot').appendChild(tr);
    }
    #showGiftTable() {
        //清空tbody
        document.getElementById('Report_Container_Gift').innerHTML = '';
        this.#reportData.modelReportGiftCost.明细.forEach(item => {
            // 声明tr，用create
            const tr = document.createElement('tr');
            tr.innerHTML = `
                        <td class="product-col">${item.赠品名称}</td>
                        <td class="text-end">${item.赠品成本_有效成本.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.赠品成本_额外缴税.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.赠品成本_退款后.toLocaleFixed(4)}</td>
                        
                        <td class="text-end">${item.赠品成本_总退款损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.赠品成本_售前损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.赠品成本_售中损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.赠品成本_售后损失.toLocaleFixed(4)}</td>
                                                
                        <td class="text-end">${new Percentage(item.赠品成本_总退款损失.dividedBy(item.赠品成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.赠品成本_售前损失.dividedBy(item.赠品成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.赠品成本_售中损失.dividedBy(item.赠品成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.赠品成本_售后损失.dividedBy(item.赠品成本_有效成本).value).toPercentString(4)}</td>
                        `;
            // 添加到tbody中
            document.getElementById('Report_Container_Gift').appendChild(tr);
        });

        // 声明tr，用create
        const tr = document.createElement('tr');
        tr.innerHTML = `
                    <td class="fw-bold product-col">总计</td>
                    <td class="text-end">${this.#reportData.modelReportGiftCost.赠品成本_有效成本.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGiftCost.赠品成本_额外缴税.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGiftCost.赠品成本_退款后.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGiftCost.赠品成本_总退款损失.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGiftCost.赠品成本_售前损失.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGiftCost.赠品成本_售中损失.toLocaleFixed(4)}</td>
                    <td class="text-end">${this.#reportData.modelReportGiftCost.赠品成本_售后损失.toLocaleFixed(4)}</td>
                    <td class="text-end">${new Percentage(this.#reportData.modelReportGiftCost.赠品成本_总退款损失.dividedBy(this.#reportData.modelReportGiftCost.赠品成本_有效成本).value).toPercentString(4)}</td>
                    <td class="text-end">${new Percentage(this.#reportData.modelReportGiftCost.赠品成本_售前损失.dividedBy(this.#reportData.modelReportGiftCost.赠品成本_有效成本).value).toPercentString(4)}</td>
                    <td class="text-end">${new Percentage(this.#reportData.modelReportGiftCost.赠品成本_售中损失.dividedBy(this.#reportData.modelReportGiftCost.赠品成本_有效成本).value).toPercentString(4)}</td>
                    <td class="text-end">${new Percentage(this.#reportData.modelReportGiftCost.赠品成本_售后损失.dividedBy(this.#reportData.modelReportGiftCost.赠品成本_有效成本).value).toPercentString(4)}</td>
                    `;
        //先清空
        document.getElementById('Report_Container_Gift_Foot').innerHTML = '';
        // 添加到tbody中,
        document.getElementById('Report_Container_Gift_Foot').appendChild(tr);
    }
    #showEnpenseTable() {
        //清空tbody
        document.getElementById('Report_Container_Expense').innerHTML = '';
        this.#reportData.modelreportEnpensePerOrder.明细.forEach(item => {
            // 声明tr，用create
            const tr = document.createElement('tr');
            tr.innerHTML = `
                        <td class="product-col">${item.费用名称}</td>
                        <td class="text-end">${item.费用成本_有效成本.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.费用成本_退款后.toLocaleFixed(4)}</td>

                        <td class="text-end">${item.费用成本_总退款损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.费用成本_售前损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.费用成本_售中损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.费用成本_售后损失.toLocaleFixed(4)}</td>
                                                
                        <td class="text-end">${new Percentage(item.费用成本_总退款损失.dividedBy(item.费用成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.费用成本_售前损失.dividedBy(item.费用成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.费用成本_售中损失.dividedBy(item.费用成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.费用成本_售后损失.dividedBy(item.费用成本_有效成本).value).toPercentString(4)}</td>
                        `;
            // 添加到tbody中
            document.getElementById('Report_Container_Expense').appendChild(tr);
        });
        this.#reportData.modelreportEnpenseMNPerOrder.明细.forEach(item => {
            // 声明tr，用create
            const tr = document.createElement('tr');
            tr.innerHTML = `
                        <td class="product-col">${item.费用名称}</td>
                        <td class="text-end">${item.费用成本_有效成本.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.费用成本_退款后.toLocaleFixed(4)}</td>

                        <td class="text-end">${item.费用成本_总退款损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.费用成本_售前损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.费用成本_售中损失.toLocaleFixed(4)}</td>
                        <td class="text-end">${item.费用成本_售后损失.toLocaleFixed(4)}</td>
                                                
                        <td class="text-end">${new Percentage(item.费用成本_总退款损失.dividedBy(item.费用成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.费用成本_售前损失.dividedBy(item.费用成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.费用成本_售中损失.dividedBy(item.费用成本_有效成本).value).toPercentString(4)}</td>
                        <td class="text-end">${new Percentage(item.费用成本_售后损失.dividedBy(item.费用成本_有效成本).value).toPercentString(4)}</td>
                        `;
            // 添加到tbody中
            document.getElementById('Report_Container_Expense').appendChild(tr);
        });
        this.#reportData.modelReportEnpenseFixed.明细.forEach(item => {
            // 声明tr，用create
            const tr = document.createElement('tr');
            tr.innerHTML = `
                        <td class="product-col">${item.费用名称}</td>
                        <td class="text-end">${item.费用成本.toLocaleFixed(4)}</td>
                        <td class="text-end">-</td>

                        <td class="text-end">-</td>
                        <td class="text-end">-</td>
                        <td class="text-end">-</td>
                        <td class="text-end">-</td>
                                                
                        <td class="text-end">-</td>
                        <td class="text-end">-</td>
                        <td class="text-end">-</td>
                        <td class="text-end">-</td>
                        `;
            // 添加到tbody中
            document.getElementById('Report_Container_Expense').appendChild(tr);
        });

    }

    #cardLeftStytle(value, element) {
        if (value.greaterThan(0)) {
            element.parentNode.classList.remove("negative", "primary");
            element.parentNode.classList.add("positive");
            element.classList.remove("negative", "primary");
            element.classList.add("positive");
        } else if (value.lessThan(0)) {
            element.parentNode.classList.remove("positive", "primary");
            element.parentNode.classList.add("negative");
            element.classList.remove("positive", "primary");
            element.classList.add("negative");
        }
    }

    Echarts = {
        showCostStructureChart: function (data) {
            // 初始化echarts实例
            const myChart = echarts.init(document.getElementById('costStructureChart'));
            //使用矩形树图
            const option = {
                title: {
                    text: '成本结构'
                },
                tooltip: {
                    trigger: 'item'
                },
                grid: {
                    top: '70%'
                },
                series: [
                    {
                        name: '成本结构',
                        type: 'treemap',
                        data: data.children,
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        }
                    }
                ]
            };
            // 使用配置项显示图表
            myChart.setOption(option);
        },
        getCostStructureData: function (reportData) {
            if (!reportData) return null;

            const root = {
                name: '总成本',
                value: 0,
                children: []
            };

            // 处理商品成本
            if (reportData.modelReportGoodsCost && reportData.modelReportGoodsCost.明细) {
                const goodsCost = {
                    name: '商品成本',
                    value: reportData.modelReportGoodsCost.商品成本_有效成本.toNumber(),
                    children: []
                };

                if (reportData.modelReportGoodsCost.明细) {
                    reportData.modelReportGoodsCost.明细.forEach(item => {
                        goodsCost.children.push({
                            name: "商品：" + item.商品名称,
                            value: item.商品成本_有效成本.toNumber()
                        });
                        //需要
                    });
                }

                root.children.push(goodsCost);
                root.value += goodsCost.value;
            }

            // 处理赠品成本
            if (reportData.modelReportGiftCost && reportData.modelReportGiftCost.明细) {
                const giftCost = {
                    name: '赠品成本',
                    value: reportData.modelReportGiftCost.赠品成本_有效成本.toNumber(),
                    children: []
                };

                if (reportData.modelReportGiftCost.明细) {
                    reportData.modelReportGiftCost.明细.forEach(item => {
                        giftCost.children.push({
                            name: '赠品：' + item.赠品名称,
                            value: item.赠品成本_有效成本.toNumber()
                        });
                    });
                }

                root.children.push(giftCost);
                root.value += giftCost.value;
            }

            // 处理每单支出
            if (reportData.modelreportEnpensePerOrder && reportData.modelreportEnpensePerOrder.明细) {
                const operatingCost = {
                    name: '每单支出',
                    value: reportData.modelreportEnpensePerOrder.费用成本_有效成本.toNumber(),
                    children: []
                };

                if (reportData.modelreportEnpensePerOrder.明细) {
                    reportData.modelreportEnpensePerOrder.明细.forEach(item => {
                        operatingCost.children.push({
                            name: item.费用名称,
                            value: item.费用成本_有效成本.toNumber()
                        });
                    });
                }

                root.children.push(operatingCost);
                root.value += operatingCost.value;
            }

            // 处理比例支出
            if (reportData.modelreportEnpenseMNPerOrder && reportData.modelreportEnpenseMNPerOrder.明细) {
                const proportionalCost = {
                    name: '比例支出',
                    value: reportData.modelreportEnpenseMNPerOrder.费用成本_有效成本.toNumber(),
                    children: []
                };

                if (reportData.modelreportEnpenseMNPerOrder.明细) {
                    reportData.modelreportEnpenseMNPerOrder.明细.forEach(item => {
                        proportionalCost.children.push({
                            name: item.费用名称,
                            value: item.费用成本_有效成本.toNumber()
                        });
                    });
                }

                root.children.push(proportionalCost);
                root.value += proportionalCost.value;
            }

            // 处理固定支出
            if (reportData.modelreportEnpenseMNPerOrder && reportData.modelreportEnpenseMNPerOrder.明细) {
                const proportionalCost = {
                    name: '比例支出',
                    value: reportData.modelReportEnpenseFixed.费用成本.toNumber(),
                    children: []
                };

                if (reportData.modelReportEnpenseFixed.明细) {
                    reportData.modelReportEnpenseFixed.明细.forEach(item => {
                        proportionalCost.children.push({
                            name: item.费用名称,
                            value: item.费用成本.toNumber()
                        });
                    });
                }

                root.children.push(proportionalCost);
                root.value += proportionalCost.value;
            }

            // 处理营销成本
            if (reportData.modelReportAdvertising) {
                const marketingCost = {
                    name: '推广成本',
                    value: reportData.modelReportAdvertising.广告费用_有效成本.toNumber(),
                    children: []
                };

                root.children.push(marketingCost);
                root.value += marketingCost.value;
            }

            return root;
        },
        showRefundCostStructureChart: function (data) {
            // 初始化echarts实例
            const myChart = echarts.init(document.getElementById('refundCostStructureChart'));
            //使用矩形树图
            const option = {
                title: {
                    text: '退款损失',
                },
                tooltip: {
                    trigger: 'item'
                },
                grid: {
                    top: '70%'
                },
                series: [
                    {
                        name: '退款损失结构',
                        type: 'treemap',
                        data: data.children,
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        }
                    }
                ]
            };
            // 使用配置项显示图表
            myChart.setOption(option);
        },
        getRefundCostStructureData: function (reportData) {
            if (!reportData) return null;

            const root = {
                name: '退款损失',
                value: 0,
                children: []
            };

            // 处理商品成本
            if (reportData.modelReportGoodsCost && reportData.modelReportGoodsCost.明细) {
                const goodsCost = {
                    name: '商品损失',
                    value: reportData.modelReportGoodsCost.商品成本_总退款损失.toNumber(),
                    children: []
                };

                if (reportData.modelReportGoodsCost.明细) {
                    reportData.modelReportGoodsCost.明细.forEach(item => {
                        goodsCost.children.push({
                            name: "商品：" + item.商品名称,
                            value: item.商品成本_总退款损失.toNumber()
                        });
                        //需要
                    });
                }

                root.children.push(goodsCost);
                root.value += goodsCost.value;
            }

            // 处理赠品成本
            if (reportData.modelReportGiftCost && reportData.modelReportGiftCost.明细) {
                const giftCost = {
                    name: '赠品成本',
                    value: reportData.modelReportGiftCost.赠品成本_总退款损失.toNumber(),
                    children: []
                };

                if (reportData.modelReportGiftCost.明细) {
                    reportData.modelReportGiftCost.明细.forEach(item => {
                        giftCost.children.push({
                            name: '赠品：' + item.赠品名称,
                            value: item.赠品成本_总退款损失.toNumber()
                        });
                    });
                }

                root.children.push(giftCost);
                root.value += giftCost.value;
            }

            // 处理每单支出
            if (reportData.modelreportEnpensePerOrder && reportData.modelreportEnpensePerOrder.明细) {
                const operatingCost = {
                    name: '每单支出',
                    value: reportData.modelreportEnpensePerOrder.费用成本_总退款损失.toNumber(),
                    children: []
                };

                if (reportData.modelreportEnpensePerOrder.明细) {
                    reportData.modelreportEnpensePerOrder.明细.forEach(item => {
                        operatingCost.children.push({
                            name: item.费用名称,
                            value: item.费用成本_总退款损失.toNumber()
                        });
                    });
                }

                root.children.push(operatingCost);
                root.value += operatingCost.value;
            }

            // 处理比例支出
            if (reportData.modelreportEnpenseMNPerOrder && reportData.modelreportEnpenseMNPerOrder.明细) {
                const proportionalCost = {
                    name: '比例支出',
                    value: reportData.modelreportEnpenseMNPerOrder.费用成本_总退款损失.toNumber(),
                    children: []
                };

                if (reportData.modelreportEnpenseMNPerOrder.明细) {
                    reportData.modelreportEnpenseMNPerOrder.明细.forEach(item => {
                        proportionalCost.children.push({
                            name: item.费用名称,
                            value: item.费用成本_总退款损失.toNumber()
                        });
                    });
                }

                root.children.push(proportionalCost);
                root.value += proportionalCost.value;
            }

            // 处理营销成本
            if (reportData.modelReportAdvertising) {
                const marketingCost = {
                    name: '推广成本',
                    value: reportData.modelReportAdvertising.广告费用_总退款损失.toNumber(),
                    children: []
                };

                root.children.push(marketingCost);
                root.value += marketingCost.value;
            }

            return root;
        },
    }
    D3 = {
        showrevenueAndCostWaterfallChart: function (data) {
            // const data = [
            //     { label: "收入", start: 0, end: 1000, type: "income" },
            //     { label: "运费", start: 1000, end: 700, type: "freight" },
            //     { label: "成本", start: 700, end: -100, type: "cost" },
            //     { label: "利润", start: 0, end: -100, type: "profit" }
            // ];

            const labels = data.map(d => d.label);

            const svgTest = d3.select("body")
                .append("svg")
                .attr("visibility", "hidden")
                .style("position", "absolute")
                .style("left", "-9999px");

            // 用与y轴字体一致的font
            const testText = svgTest.append("g")
                .attr("class", "y axis")

            let maxWidth = 0;
            labels.forEach(txt => {
                const t = testText.append("text").text(txt);
                const w = t.node().getBBox().width; // 或 getComputedTextLength()
                if (w > maxWidth) maxWidth = w;
                t.remove();
            });
            svgTest.remove();

            // 关键：画布尺寸以viewBox为主，实际显示百分比宽高，自适应
            const viewBoxWidth = 800, viewBoxHeight = data.length * 24;
            const margin = { top: 10, right: 10, bottom: 40, left: maxWidth + 20 };
            const width = viewBoxWidth - margin.left - margin.right;
            const height = viewBoxHeight - margin.top - margin.bottom;

            const svg = d3.select("#revenueAndCostWaterfallChart")
                .attr("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

            const y = d3.scaleBand()
                .domain(data.map(d => d.label))
                .range([0, height])
                .padding(0);

            const xMin = Math.min(0, d3.min(data, d => Math.min(d.start, d.end)));
            const xMax = Math.max(0, d3.max(data, d => Math.max(d.start, d.end)));
            const x = d3.scaleLinear()
                .domain([xMin - 120, xMax + 120])
                .range([0, width]);

            const yAxis = chart.append("g")
                .attr("class", "y axis")
                .call(d3.axisLeft(y).tickSize(0))
            yAxis.select(".domain").remove();
            yAxis.selectAll("text")
                .attr("text-anchor", "start")
                .attr("x", -margin.left + 8);

            const xAxis = chart.append("g")
                .attr("class", "x grid")
                .attr("transform", `translate(0,0)`)
                .call(d3.axisBottom(x)
                    .ticks(10)
                    .tickSize(height)
                    .tickFormat(d => d))
            xAxis.select(".domain").remove();

            chart.selectAll("rect.bar")
                .data(data)
                .join("rect")
                .attr("y", d => y(d.label))
                .attr("height", y.bandwidth())
                .attr("x", d => x(Math.min(d.start, d.end)))
                .attr("width", d => Math.abs(x(d.end) - x(d.start)))
                .attr("fill", d => d.fill)
                .attr("class", "bar");

            // 检查是否有负值
            const hasNegative = data.some(d => d.end < 0 || d.start < 0);
            // 添加辅助线
            if (hasNegative) {
                const alltick = xAxis.selectAll("g.tick");
                alltick.each(function (tick) {
                    const textValue = d3.select(this).select("text").text();
                    if (textValue === "0") {
                        const tickLine = d3.select(this).select("line").remove();
                    }
                });
                chart.append("line")
                    .attr("x1", x(0))
                    .attr("x2", x(0))
                    .attr("y1", 0)
                    .attr("y2", height)
                    .attr("stroke", "red")
                    .attr("stroke-width", 0.5)
            }
        },
        getrevenueAndCostWaterfallData: function (reportData) {
            const data = [];
            // 收入
            const totalRevenue = reportData.modelReportSalesRevenue.收入_退款后.toNumber();
            data.push({ label: "收入", start: 0, end: totalRevenue, fill: "#2979FF" });

            // 商品成本
            reportData.modelReportGoodsCost.明细.forEach(item => {
                const cost = item.商品成本_有效成本.toNumber();
                const lastEnd = data[data.length - 1].end;
                data.push({ label: `商品：${item.商品名称}`, start: lastEnd, end: lastEnd - cost, fill: "#81C784" });
            });
            // 赠品成本
            reportData.modelReportGiftCost.明细.forEach(item => {
                const cost = item.赠品成本_有效成本.toNumber();
                const lastEnd = data[data.length - 1].end;
                data.push({ label: `赠品：${item.赠品名称}`, start: lastEnd, end: lastEnd - cost, fill: "#AED581" });
            });
            // 推广费
            if (reportData.modelReportAdvertising) {
                const advertisingCost = reportData.modelReportAdvertising.广告费用_有效成本.toNumber();
                const lastEnd = data[data.length - 1].end;
                data.push({ label: `广告：${reportData.modelReportAdvertising.广告名称}`, start: lastEnd, end: lastEnd - advertisingCost, fill: "#64B5F6" });
            }
            // 每单支出
            reportData.modelreportEnpensePerOrder.明细.forEach(item => {
                const cost = item.费用成本_有效成本.toNumber();
                const lastEnd = data[data.length - 1].end;
                data.push({ label: `费用：${item.费用名称}`, start: lastEnd, end: lastEnd - cost, fill: "#FFD54F" });
            });
            // 比例支出
            reportData.modelreportEnpenseMNPerOrder.明细.forEach(item => {
                const cost = item.费用成本_有效成本.toNumber();
                const lastEnd = data[data.length - 1].end;
                data.push({ label: `费用：${item.费用名称}`, start: lastEnd, end: lastEnd - cost, fill: "#FFB74D" });
            });
            // 固定支出
            reportData.modelReportEnpenseFixed.明细.forEach(item => {
                const cost = item.费用成本.toNumber();
                const lastEnd = data[data.length - 1].end;
                data.push({ label: `费用：${item.费用名称}`, start: lastEnd, end: lastEnd - cost, fill: "#A1887F" });
            });
            // 利润
            const totalProfit = reportData.modelReportExt.利润.toNumber();
            data.push({ label: "利润", start: 0, end: totalProfit, fill: "#7C4DFF" });

            return data;
        }
    }
}
// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // 创建并初始化
        const planParams = new PlanReportManager();
        await planParams.initialize();

        // 将实例暴露到全局，方便调试
        window.planParams = planParams;
    } catch (error) {
        console.error('Failed to initialize planParams:', error);
        alert('方案报告页面初始化失败，请刷新页面重试-2');
    }
});