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

        this.#reportData = this.#simulationCore.runSimulation(this.#planParams);
        console.log("可读性报表：", this.#reportData.toSerializable());
        this.#showReport();
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
        if (workspaceId) {
            this.#repositoryWorkspace = new Repository_Workspace();
            await this.#repositoryWorkspace.initDatabase();
            this.#workspace = await this.#repositoryWorkspace.getWorkspaceById(workspaceId);
            // 可以关闭 repositoryWorkspace了，因为不需要了
            this.#repositoryWorkspace.close();
            // 注意 repositoryPlanGroup, repositoryPlanMeta 和 repositoryPlanParams 用的是同一个链接，都是 workspaceId 对应的链接。 workspaceId 是库的名称。
            this.#repositoryPlanGroup = new Repository_PlanGroup(workspaceId);
            await this.#repositoryPlanGroup.initDatabase();
            this.#repositoryPlanMeta = new Repository_PlanMeta(workspaceId);
            await this.#repositoryPlanMeta.initDatabase();
            this.#repositoryPlanParams = new Repository_PlanParams(workspaceId);
            await this.#repositoryPlanParams.initDatabase();
        }
        if (groupId) {
            this.#planGroup = await this.#repositoryPlanGroup.getPlanGroupById(groupId);
        }
        //如果有planId参数，则加载对应的方案数据
        if (planId) {
            this.#planMeta = await this.#repositoryPlanMeta.getPlanMetaById(planId);
            this.#planParams = await this.#repositoryPlanParams.getPlanParamsById(this.#planMeta.id);
            this.#simulationCore = new SimulationCore();
        }
        // 修改 .main-title 下的H1的内容
        if (this.#planMeta && this.#planMeta.name) {
            const titleElement = document.querySelector('.main-title');
            if (titleElement) {
                titleElement.textContent = `${this.#workspace.name} -> ${this.#planGroup.name} -> ${this.#planMeta.name}`;
            }
        }
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
        const roiBusinessElement = document.getElementById("totalROI_Business");
        if (this.#reportData.modelReportExt.资本回报率.value.greaterThan(0)) {
            roiBusinessElement.style.color = "green";
        } else if (this.#reportData.modelReportExt.资本回报率.value.lessThan(0)) {
            roiBusinessElement.style.color = "red";
        }

        if (this.#reportData.modelReportExt.推广回报率.value.greaterThan(0)) {
            const roiAdvertisingElement = document.getElementById("totalROI_Advertising");
            roiAdvertisingElement.textContent = this.#reportData.modelReportExt.推广回报率.toPercentString(4) || "--";
            // 如果this.#reportData.modelReportExt.推广回报率大于0，则显示绿色，否则显示红色
            if (this.#reportData.modelReportExt.推广回报率.value.greaterThan(0)) {
                roiAdvertisingElement.style.color = "green";
            } else if (this.#reportData.modelReportExt.推广回报率.value.lessThan(0)) {
                roiAdvertisingElement.style.color = "red";
            }
        } else {
            const roiAdvertisingElement = document.getElementById("totalROI_Advertising");
            roiAdvertisingElement.textContent = "--";
        }
    }
    #showEcharts() {
        this.Echarts.showCostStructureChart(this.Echarts.getCostStructureData(this.#reportData));
        this.Echarts.showRefundCostStructureChart(this.Echarts.getRefundCostStructureData(this.#reportData));
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

    Echarts = {
        showCostStructureChart: function (data) {
            // 初始化echarts实例
            var myChart = echarts.init(document.getElementById('costStructureChart'));
            //使用矩形树图
            var option = {
                title: {
                    // text: '成本结构'
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
            var myChart = echarts.init(document.getElementById('refundCostStructureChart'));
            //使用矩形树图
            var option = {
                title: {
                    // text: '成本结构'
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