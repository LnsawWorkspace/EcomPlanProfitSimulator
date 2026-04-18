import { Model_PlanParams_Sale } from '../../../domain/plan/Model_PlanParams_Sale.js';
import { Model_PlanParams_Refund } from '../../../domain/plan/Model_PlanParams_Refund.js';
import { Model_PlanParams_Goods } from '../../../domain/plan/Model_PlanParams_Goods.js';
import { Model_PlanParams_Gift } from '../../../domain/plan/Model_PlanParams_Gift.js';

import { Model_PlanParams_Expense_PerOrder } from '../../../domain/plan/Model_PlanParams_Expense_PerOrder.js';
import { Model_PlanParams_Expense_MNPerOrder } from '../../../domain/plan/Model_PlanParams_Expense_MNPerOrder.js';
import { Model_PlanParams_Expense_Fixed } from '../../../domain/plan/Model_PlanParams_Expense_Fixed.js';

import { Model_PlanParams_Advertising } from '../../../domain/plan/Model_PlanParams_Advertising.js';

import { Entity_PlanReport } from '../../../domain/report/Entity_PlanReport.js';

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
class PlanReportSaleGraphManager {
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
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el))
        Decimal.set({ precision: 40 });
    }
    /**
     * 初始化提示信息函数
     */
    #initializeShowToast() {
        this.#showToast = {
            success: async (message, delay = 2000) => LnsawTool.showToast(message, 'success', delay),
            warning: async (message, delay = 2000) => LnsawTool.showToast(message, 'warning', delay),
            error: async (message, delay = 2000) => LnsawTool.showToast(message, 'danger', delay),
            info: async (message, delay = 2000) => LnsawTool.showToast(message, 'info', delay),
        };
    }

    /**
     * 将DOM元素转为DOM对象
     */
    #initializeElements() {
        const elements_id = {
            'volume-graph-generate-btn': 'volume-graph-generate-btn',

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
            // 没用showReport 而是用的 initPlanReport 是为了避免方案参数发生变化，因此需要重新获取方案参数
            // 不过这里需要用到url，如果url被编辑，会导致无法获取方案参数
            ["volume-graph-generate-btn", () => { this.#refreshReport(); }],
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
                        // 未必能拿到这个roi，如果拿不到, 需要直接锁定这个输入框，设置为0，并且提示用户在方案参数中设置roi才可以调整这个值
                        if (!this.#planParams.modelPlanParamsAdvertising) {
                            document.getElementById('volume-graph-roi').disabled = true;
                            // this.#showToast.error('请在方案参数中设置ROI值后再调整此值');
                        } else {
                            document.getElementById('volume-graph-roi').disabled = false;
                            document.getElementById('volume-graph-roi').value = this.#planParams.modelPlanParamsAdvertising.roi.toString();
                        }
                        document.getElementById('volume-graph-salePrice').value = this.#planParams.modelPlanParamsSale.salePrice.toString();
                        // 单量的步进必须是整数
                        document.getElementById('volume-graph-step').value = '1';
                        // 默认开始是1，结束是1000
                        document.getElementById('volume-graph-start').value = '10';
                        document.getElementById('volume-graph-end').value = '1000';

                        this.#simulationCore = new SimulationCore();
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

    async #refreshReport() {
        this.#workspace = await this.#repositoryWorkspace.getWorkspaceById(this.#workspace.id);
        if (this.#workspace) {
            this.#planGroup = await this.#repositoryPlanGroup.getPlanGroupById(this.#planGroup.id);
            if (this.#planGroup) {
                this.#planMeta = await this.#repositoryPlanMeta.getPlanMetaById(this.#planMeta.id);
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
        this.Echarts.Loading();
        if (this.#planParams.modelPlanParamsAdvertising) {
            this.#planParams.modelPlanParamsAdvertising.roi = new Decimal(document.getElementById('volume-graph-roi').value);
        }
        this.#planParams.modelPlanParamsSale.salePrice = new Decimal(document.getElementById('volume-graph-salePrice').value);
        // saleStart,必须大于0，最小0.01，
        let saleStart = new Decimal(document.getElementById('volume-graph-start').value);
        if (saleStart.lte(0)) {
            document.getElementById('volume-graph-start').value = 0;
            saleStart = new Decimal(0);
        }
        saleStart = saleStart.toDecimalPlaces(4, Decimal.ROUND_DOWN);
        document.getElementById('volume-graph-start').value = saleStart.toString();
        // saleStep,最小1
        let saleStep = new Decimal(document.getElementById('volume-graph-step').value);
        if (saleStep.lt(1)) {
            saleStep = new Decimal(1).toDecimalPlaces(4, Decimal.ROUND_DOWN);
            document.getElementById('volume-graph-step').value = saleStep.toString();
            this.#showToast.error('单量步长必须大于等于1');
            return;
        }
        saleStep = saleStep.toDecimalPlaces(4, Decimal.ROUND_DOWN);
        document.getElementById('volume-graph-step').value = saleStep.toString();
        // saleEnd,必须大于saleStart，
        let saleEnd = new Decimal(document.getElementById('volume-graph-end').value);
        if (saleEnd.lte(saleStart)) {
            document.getElementById('volume-graph-end').value = saleStart.plus(saleStep).toString();
            this.#showToast.error('单量结束值必须大于开始值');
            return;
        }
        saleEnd = saleEnd.toDecimalPlaces(4, Decimal.ROUND_DOWN);
        document.getElementById('volume-graph-end').value = saleEnd.toString();

        const worker = new Worker('js/planReportVolumeGraphWork.js', { type: 'module' });
        worker.postMessage({ saleStart: saleStart.toString(), saleEnd: saleEnd.toString(), saleStep: saleStep.toString(), planParams: this.#planParams.toSerializable() });
        worker.onmessage = (e) => {
            // 计算完成
            worker.terminate();
            const results = [];
            for (const resultData of e.data) {
                const planReport = Entity_PlanReport.parse(resultData);
                results.push(planReport);
            }
            console.log('计算完成，结果：', results);
            this.Echarts.init(results);
        };
    }
    Echarts = {
        ECharts: null,
        // 这个方法是干嘛的，忘记了？
        // 计算R平方，oldY是真实值，newY是预测值
        computeRSquaredFromY(oldY, newY) {
            if (!Array.isArray(oldY) || !Array.isArray(newY) ||
                oldY.length !== newY.length || oldY.length === 0) {
                throw new Error('oldY 和 newY 必须是等长非空数组');
            }
            const n = oldY.length;
            const meanY = oldY.reduce((sum, y) => sum + y, 0) / n;
            const ssTot = oldY.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
            const ssRes = oldY.reduce((sum, y, i) => sum + Math.pow(y - newY[i], 2), 0);
            return 1 - ssRes / ssTot;

            // const rSquared = this.computeRSquaredFromY(
            //     data.map(item => item.modelReportExt.利润.toNumber()),
            //     lh.points.map(point => point[1])
            // );

            // const lh = ecStat.regression('polynomial', data.map(item => [
            //     item.planParams.modelPlanParamsAdvertising.roi.toNumber(),
            //     item.modelReportExt.利润.toNumber()
            // ]));
        },
        legend: {
            type: "plain",
            width: "100%",
            top: "0%",
            data: [
                '利润',
                '利润率',
                '资本回报率',
            ],
            selected: {
                '利润': true,
                '利润率': false,
                '资本回报率': false,
            }
        },
        legendAdd: function (data) {
            // 如果广告名称不在 legend.data 中，则添加
            const adName = "广告：" + data[0].modelReportAdvertising.广告名称;
            if (!this.legend.data.includes(adName)) {
                this.legend.data.push(adName);
                this.legend.selected[adName] = true;
            }
        },
        series: function (data) {
            const s = [
                {
                    name: '利润',
                    type: 'line',
                    smooth: true,
                    data: data.map(item => item.modelReportExt.利润.toNumber()),
                    tooltip: { // 单独配置该系列的tooltip
                        valueFormatter: function (value) {
                            const v = new Money(value, 4);
                            v.options.suffix = ' 元';
                            return v.toLocaleFixed(2) + v.options.suffix;
                        },
                    },
                },
                {
                    name: "广告：" + data[0].modelReportAdvertising.广告名称,
                    type: 'line',
                    smooth: true,
                    data: data.map(item => item.modelReportAdvertising.广告费用_有效成本.toNumber()),
                    tooltip: { // 单独配置该系列的tooltip
                        valueFormatter: function (value) {
                            const v = new Money(value, 4);
                            v.options.suffix = ' 元';
                            return v.toLocaleFixed(2) + v.options.suffix;
                        },
                    },
                },
                {
                    name: '利润率',
                    type: 'line',
                    smooth: true,
                    data: data.map(item => item.modelReportExt.利润率.toNumber()),
                    tooltip: { // 单独配置该系列的tooltip
                        valueFormatter: function (value) {
                            return new Percentage(value).toPercentString(2);
                        },
                    },
                },
                {
                    name: '资本回报率',
                    type: 'line',
                    smooth: true,
                    data: data.map(item => item.modelReportExt.资本回报率.toNumber()),
                    tooltip: { // 单独配置该系列的tooltip
                        valueFormatter: function (value) {
                            return new Percentage(value).toPercentString(2);
                        },
                    },
                },
                // {
                //     name: '运费',
                //     type: 'line',
                //     smooth: true,
                //     data: data.map(item => {
                //         const shippingExpense = item.modelreportEnpensePerOrder.明细.find(expense =>
                //             expense.费用名称 === "运费"
                //         );
                //         return shippingExpense ? shippingExpense.费用成本_有效成本.toNumber() : 0;
                //     }),
                //     tooltip: { // 单独配置该系列的tooltip
                //         valueFormatter: function (value) {
                //             const v = new Money(value, 4);
                //             v.options.suffix = ' 元';
                //             return v.toLocaleFixed(2) + v.options.suffix;
                //         },
                //     },
                // },
            ];
            return s;
        },
        init: function (data) {
            // 基于准备好的dom，初始化echarts实例
            const that = this;
            echarts.registerTransform(ecStat.transform.histogram);
            if (this.ECharts === null) {
                this.ECharts = echarts.init(document.getElementById('volume-graph-container'));
            }

            this.legendAdd(data);
            // 指定图表的配置项和数据
            let option = {
                title: {
                },
                tooltip: {
                    trigger: 'axis',  // 关键！显示同一X轴的所有Y值
                    axisPointer: {
                        type: 'line'  // 显示垂直参考线
                    }
                },
                toolbox: {
                    show: true,
                    feature: {
                        magicType: {
                            title: {
                                line: '折线图',
                                bar: '柱状图'
                            },
                            type: ['line', 'bar']
                        },
                    },
                    top: '0%',
                },
                grid: {
                    top: '10%',
                    left: '2%',
                    right: '2%',
                },
                legend: this.legend,
                dataZoom: [
                    {
                        id: 'dataZoomX',
                        type: 'slider',
                        xAxisIndex: [0],
                        filterMode: 'filter',
                        start: 0,
                        end: 100,
                    },
                ],
                xAxis: {
                    type: 'category',
                    data: data.map(item => item.planParams.modelPlanParamsSale.payOrderQuantity.toNumber()),
                },
                yAxis: {
                    type: 'value',
                    scale: true,
                },
                series: this.series(data),
            };

            this.ECharts.on('legendselectchanged', function (params) {
                that.legend.selected = params.selected;
            });
            // 使用刚指定的配置项和数据显示图表。
            this.ECharts.clear();
            this.ECharts.setOption(option);
        },
        Loading: function () {
            if (this.ECharts === null) {
                this.ECharts = echarts.init(document.getElementById('volume-graph-container'));
            }
            // 指定图表的配置项和数据
            let option = {
                graphic: {
                    id: 'loading-rect',
                    elements: [
                        {
                            type: 'group',
                            left: 'center',
                            top: 'center',
                            children: new Array(7).fill(0).map((val, i) => ({
                                type: 'rect',
                                x: i * 20,
                                shape: {
                                    x: 0,
                                    y: -40,
                                    width: 10,
                                    height: 80
                                },
                                style: {
                                    fill: '#5470c6'
                                },
                                keyframeAnimation: {
                                    duration: 1000,
                                    delay: i * 200,
                                    loop: true,
                                    keyframes: [
                                        {
                                            percent: 0.5,
                                            scaleY: 0.3,
                                            easing: 'cubicIn'
                                        },
                                        {
                                            percent: 1,
                                            scaleY: 1,
                                            easing: 'cubicOut'
                                        }
                                    ]
                                }
                            }))
                        }
                    ]
                }
            };
            // 使用刚指定的配置项和数据显示图表。
            this.ECharts.clear();
            this.ECharts.setOption(option);
        },
    }
}
// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // 创建并初始化
        const planReportRoiGraph = new PlanReportSaleGraphManager();
        await planReportRoiGraph.initialize();

        // // 将实例暴露到全局，方便调试
        // window.planReportRoiGraph = planReportRoiGraph;
    } catch (error) {
        console.error('Failed to initialize planParams:', error);
        alert('方案报告页面初始化失败，请刷新页面重试-2');
    }
});