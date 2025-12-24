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

class PlanReportRoiGraphManager {
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
            'roi-graph-generate-btn': 'roi-graph-generate-btn',

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
            ["roi-graph-generate-btn", () => { this.#initPlanReport(); }],
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
        // roiStart,必须大于0，最小0.01，
        let roiStart = new Decimal(document.getElementById('roi-graph-start').value);
        if (roiStart.lte(0)) {
            document.getElementById('roi-graph-start').value = 0;
            roiStart = new Decimal(0);
        }
        roiStart = roiStart.toDecimalPlaces(2, Decimal.ROUND_DOWN);
        document.getElementById('roi-graph-start').value = roiStart.toString();
        // roiStep,最小0.01
        let roiStep = new Decimal(document.getElementById('roi-graph-step').value);
        if (roiStep.lt(0.0001)) {
            roiStep = new Decimal(0.0001).toDecimalPlaces(4, Decimal.ROUND_DOWN);
            document.getElementById('roi-graph-step').value = roiStep.toString();
            this.#showToast.error('ROI 步长必须大于等于0.0001'); 
            return;
        }
        roiStep = roiStep.toDecimalPlaces(3, Decimal.ROUND_DOWN);
        document.getElementById('roi-graph-step').value = roiStep.toString();
        // roiEnd,必须大于roiStart，
        let roiEnd = new Decimal(document.getElementById('roi-graph-end').value);
        if (roiEnd.lte(roiStart)) {
            document.getElementById('roi-graph-end').value = roiStart.plus(roiStep).toString();
            this.#showToast.error('ROI 结束值必须大于开始值');
            return;
        }
        roiEnd = roiEnd.toDecimalPlaces(2, Decimal.ROUND_DOWN);
        document.getElementById('roi-graph-end').value = roiEnd.toString();

        const worker = new Worker('js/planReportRoiGraphWork.js', { type: 'module' });
        worker.postMessage({ roiStart: roiStart.toString(), roiEnd: roiEnd.toString(), roiStep: roiStep.toString(), planParams: this.#planParams.toSerializable() });
        worker.onmessage = (e) => {
            // 计算完成
            worker.terminate();
            console.log('%c  + Simulation Completed:', "color: green", e.data);
            const results = [];
            for (const resultData of e.data) {
                const planReport = Entity_PlanReport.parse(resultData);
                results.push(planReport);
            }
            this.Echarts.init(results);
        };
    }

    Echarts = {
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
                this.legend.selected[adName] = false;
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
            ];
            return s;
        },
        init: function (data) {
            // 基于准备好的dom，初始化echarts实例
            const that = this;
            let myChart = echarts.init(document.getElementById('roi-graph-container'));
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
                dataset: {

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
                    data: data.map(item => item.planParams.modelPlanParamsAdvertising.roi.toFixed(4)),
                },
                yAxis: {
                    type: 'value',
                    scale: true,
                },
                series: this.series(data),
            };

            myChart.on('legendselectchanged', function (params) {
                that.legend.selected = params.selected;
            });
            // 使用刚指定的配置项和数据显示图表。
            myChart.setOption(option);
        },
    }
}
// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // 创建并初始化
        const planReportRoiGraph = new PlanReportRoiGraphManager();
        await planReportRoiGraph.initialize();

        // // 将实例暴露到全局，方便调试
        // window.planReportRoiGraph = planReportRoiGraph;
    } catch (error) {
        console.error('Failed to initialize planParams:', error);
        alert('方案报告页面初始化失败，请刷新页面重试-2');
    }
});