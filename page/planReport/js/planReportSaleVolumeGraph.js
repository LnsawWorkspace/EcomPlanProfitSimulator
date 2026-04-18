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
            'saleAndVolume-graph-generate-btn': 'saleAndVolume-graph-generate-btn',
            'saleAndVolume-graph-show-selected-btn': 'saleAndVolume-graph-show-selected-btn',

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
            ["saleAndVolume-graph-generate-btn", () => { this.#refreshReport(); }],
            ["saleAndVolume-graph-show-selected-btn", () => { this.Echarts.setOptions(); }]
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
                            document.getElementById('sale-graph-roi').disabled = true;
                            // this.#showToast.error('请在方案参数中设置ROI值后再调整此值');
                        } else {
                            document.getElementById('sale-graph-roi').disabled = false;
                            document.getElementById('sale-graph-roi').value = this.#planParams.modelPlanParamsAdvertising.roi.toString();
                        }
                        // 售价从1开始，结束值为最初售价的2倍
                        const initialSale = this.#planParams.modelPlanParamsSale.salePrice.toNumber();
                        document.getElementById('sale-graph-start').value = 0;
                        document.getElementById('sale-graph-end').value = Math.max(0.01, initialSale * 2).toString();
                        let saleStep = 0.01;
                        // 根据结束售价的大小调整步长，确保图表有足够的点，但又不会过多导致计算过慢，通常控制在1000个点以内
                        // 另外售价通常大于1元，然后结束的售价可能是几百元甚至几千元，所以步长不能太小，否则点太多了
                        const maxPoints = 100;
                        const range = Math.max(0.01, initialSale * 2) - 1;
                        saleStep = range / maxPoints;
                        // saleStep 必须是0.1、0.2、0.5、1、2、5等这种形式，不能是任意小数，否则图表的X轴标签会非常难看
                        // 所以要对计算出的 saleStep 进行调整，调整为最接近的 1*10^n、2*10^n 或 5*10^n 的形式
                        const magnitude = Math.pow(10, Math.floor(Math.log10(saleStep)));
                        const normalizedStep = saleStep / magnitude;
                        let adjustedStep;
                        if (normalizedStep <= 1) {
                            adjustedStep = 1 * magnitude;
                        } else if (normalizedStep <= 2) {
                            adjustedStep = 2 * magnitude;
                        } else if (normalizedStep <= 5) {
                            adjustedStep = 5 * magnitude;
                        } else if (normalizedStep <= 10) {
                            adjustedStep = 10 * magnitude;
                        } else if (normalizedStep <= 20) {
                            adjustedStep = 20 * magnitude;
                        } else if (normalizedStep <= 50) {
                            adjustedStep = 50 * magnitude;
                        } else {
                            adjustedStep = 100 * magnitude;
                        }
                        document.getElementById('sale-graph-step').value = adjustedStep.toString();

                        // 设置销量相关数据
                        // 销量默认从0开始，步进是100，最大值是1000
                        document.getElementById('volume-graph-start').value = 0;
                        document.getElementById('volume-graph-end').value = 1000;
                        document.getElementById('volume-graph-step').value = 100;

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
            this.#planParams.modelPlanParamsAdvertising.roi = new Decimal(document.getElementById('sale-graph-roi').value);
        }
        // saleStart,必须大于0，最小0.01，
        let saleStart = new Decimal(document.getElementById('sale-graph-start').value);
        if (saleStart.lte(0)) {
            document.getElementById('sale-graph-start').value = 0;
            saleStart = new Decimal(0);
        }
        saleStart = saleStart.toDecimalPlaces(4, Decimal.ROUND_DOWN);
        document.getElementById('sale-graph-start').value = saleStart.toString();
        // saleStep,最小0.01
        let saleStep = new Decimal(document.getElementById('sale-graph-step').value);
        if (saleStep.lt(0.0001)) {
            saleStep = new Decimal(0.0001).toDecimalPlaces(4, Decimal.ROUND_DOWN);
            document.getElementById('sale-graph-step').value = saleStep.toString();
            this.#showToast.error('销售步长必须大于等于0.0001');
            return;
        }
        saleStep = saleStep.toDecimalPlaces(4, Decimal.ROUND_DOWN);
        document.getElementById('sale-graph-step').value = saleStep.toString();
        // saleEnd,必须大于saleStart，
        let saleEnd = new Decimal(document.getElementById('sale-graph-end').value);
        if (saleEnd.lte(saleStart)) {
            document.getElementById('sale-graph-end').value = saleStart.plus(saleStep).toString();
            this.#showToast.error('销售结束值必须大于开始值');
            return;
        }
        saleEnd = saleEnd.toDecimalPlaces(4, Decimal.ROUND_DOWN);
        document.getElementById('sale-graph-end').value = saleEnd.toString();

        // 获取销量相关数据
        let volumeStart = new Decimal(document.getElementById('volume-graph-start').value);
        if (volumeStart.lte(0)) {
            document.getElementById('volume-graph-start').value = 0;
            volumeStart = new Decimal(0);
        }
        volumeStart = volumeStart.toDecimalPlaces(0, Decimal.ROUND_DOWN);
        document.getElementById('volume-graph-start').value = volumeStart.toString();
        let volumeStep = new Decimal(document.getElementById('volume-graph-step').value);
        if (volumeStep.lte(0)) {
            document.getElementById('volume-graph-step').value = 10;
            volumeStep = new Decimal(10);
        }
        volumeStep = volumeStep.toDecimalPlaces(0, Decimal.ROUND_DOWN);
        document.getElementById('volume-graph-step').value = volumeStep.toString();
        let volumeEnd = new Decimal(document.getElementById('volume-graph-end').value);
        if (volumeEnd.lte(volumeStart)) {
            document.getElementById('volume-graph-end').value = volumeStart.plus(volumeStep).toString();
            this.#showToast.error('销量结束值必须大于开始值');
            return;
        }

        const worker = new Worker('js/planReportSaleVolumeGraphWork.js', { type: 'module' });
        worker.postMessage({
            saleStart: saleStart.toString(),
            saleEnd: saleEnd.toString(),
            saleStep: saleStep.toString(),
            volumeStart: volumeStart.toString(),
            volumeEnd: volumeEnd.toString(),
            volumeStep: volumeStep.toString(),
            planParams: this.#planParams.toSerializable()
        });
        worker.onmessage = (e) => {
            // 计算完成
            worker.terminate();
            const results = [];
            for (const resultData of e.data) {
                const planReport = Entity_PlanReport.parse(resultData);
                results.push(planReport);
            }
            console.log('计算完成，结果：', results);

            // 得重新组装结果，将结果中的 planReport 转换为图表需要的数据格式，图表需要的数据格式是一个二维数组，每个元素包含 销售价格、销量和利润,
            const chartData = results.map(planReport => ([
                planReport.planParams.modelPlanParamsSale.salePrice.toString(),
                planReport.planParams.modelPlanParamsSale.payOrderQuantity.toString(),
                Math.round(planReport.modelReportExt.利润.toNumber()),
            ]));
            console.log('图表数据：', chartData);

            this.Echarts.init(chartData);
        };
    }
    Echarts = {
        ECharts: null,
        init: function (data) {
            // 基于准备好的dom，初始化echarts实例
            const that = this;
            // 这行代码忘记是干嘛的了，但是不报错。很神奇，先留着，不要乱动。
            echarts.registerTransform(ecStat.transform.histogram);
            if (this.ECharts === null) {
                this.ECharts = echarts.init(document.getElementById('saleAndVolume-graph-container'));
            }
            // 指定图表的配置项和数据
            let option = {
                tooltip: {
                    position: 'top',
                    formatter: function (params) {
                        return `售价：${params.value[0]} - 单量：${params.value[1]} : 利润：${params.value[2]}`;
                    }
                },
                xAxis: {
                    type: 'category',
                    data: [...new Set(data.map(item => item[0]))],
                    splitArea: { show: true }
                },
                yAxis: {
                    type: 'category',
                    data: [...new Set(data.map(item => item[1]))],
                    splitArea: { show: true }
                },
                series: [
                    {
                        name: '利润',
                        type: 'heatmap',
                        data: data,
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        }
                    }
                ],
                visualMap: {
                    min: Math.min(...data.map(item => item[2])),
                    max: Math.max(...data.map(item => item[2])),
                    // min:1000,
                    // max:2000,
                    calculable: true,
                    realtime: false,
                    precision: 0,
                    handlerSize: 10,
                    inRange: {
                        color: [
                            "#1a237e", // 深蓝
                            "#283593",
                            "#3f51b5",
                            "#5c6bc0",
                            "#7e57c2", // 蓝紫过渡
                            "#8e24aa",
                            "#ab47bc",
                            "#d81b60", // 紫红过渡
                            "#e53935",
                            "#ef5350",
                            "#f44336",
                            "#ff7043", // 橙红
                            "#ff8a65",
                            "#ffab40",
                            "#ffa000",
                            "#ff8f00", // 深橙
                            "#e65100", // 橙红深色
                            "#d84315",
                            "#bf360c",
                            "#b71c1c", // 深红
                            "#871400",
                            "#5d0000"  // 暗红（最深）
                        ]
                    },
                    outOfRange: {
                        color: ['#01010101']
                    },
                },
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
                this.ECharts = echarts.init(document.getElementById('saleAndVolume-graph-container'));
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
        setOptions: function () {
            if (this.ECharts) {
                this.ECharts.setOption({
                    visualMap: {
                        range: [parseFloat(document.getElementById('min-profit').value), parseFloat(document.getElementById('max-profit').value)],
                    }
                });
            }
        }

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