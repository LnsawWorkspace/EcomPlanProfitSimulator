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
            ["roi-graph-generate-btn", () => { this.#refreshReport(); }],
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
                        document.getElementById('roi-graph-salePrice').value = this.#planParams.modelPlanParamsSale.salePrice.toString();
                        document.getElementById('roi-graph-orderQuantity').value = this.#planParams.modelPlanParamsSale.payOrderQuantity.toString();
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
        this.#planParams.modelPlanParamsSale.salePrice = new Decimal(document.getElementById('roi-graph-salePrice').value);
        this.#planParams.modelPlanParamsSale.payOrderQuantity = new Decimal(document.getElementById('roi-graph-orderQuantity').value);
        // roiStart,必须大于0，最小0.01，
        let roiStart = new Decimal(document.getElementById('roi-graph-start').value);
        if (roiStart.lte(0)) {
            document.getElementById('roi-graph-start').value = 0;
            roiStart = new Decimal(0);
        }
        roiStart = roiStart.toDecimalPlaces(4, Decimal.ROUND_DOWN);
        document.getElementById('roi-graph-start').value = roiStart.toString();
        // roiStep,最小0.01
        let roiStep = new Decimal(document.getElementById('roi-graph-step').value);
        if (roiStep.lt(0.0001)) {
            roiStep = new Decimal(0.0001).toDecimalPlaces(4, Decimal.ROUND_DOWN);
            document.getElementById('roi-graph-step').value = roiStep.toString();
            this.#showToast.error('ROI 步长必须大于等于0.0001');
            return;
        }
        // roiStep,最大0.1
        if (roiStep.gt(0.1)) {
            roiStep = new Decimal(0.1).toDecimalPlaces(4, Decimal.ROUND_DOWN);
            document.getElementById('roi-graph-step').value = roiStep.toString();
            this.#showToast.error('ROI 步长必须小于等于0.1');
            return;
        }
        roiStep = roiStep.toDecimalPlaces(4, Decimal.ROUND_DOWN);
        document.getElementById('roi-graph-step').value = roiStep.toString();
        // roiEnd,必须大于roiStart，
        let roiEnd = new Decimal(document.getElementById('roi-graph-end').value);
        if (roiEnd.lte(roiStart)) {
            document.getElementById('roi-graph-end').value = roiStart.plus(roiStep).toString();
            this.#showToast.error('ROI 结束值必须大于开始值');
            return;
        }
        roiEnd = roiEnd.toDecimalPlaces(4, Decimal.ROUND_DOWN);
        document.getElementById('roi-graph-end').value = roiEnd.toString();

        this.Echarts.Loading();
        const worker = new Worker('js/planReportRoiGraphWork.js', { type: 'module' });
        worker.postMessage({ roiStart: roiStart.toString(), roiEnd: roiEnd.toString(), roiStep: roiStep.toString(), planParams: this.#planParams.toSerializable() });
        worker.onmessage = (e) => {
            // 计算完成
            worker.terminate();
            const results = [];
            for (const resultData of e.data) {
                const planReport = Entity_PlanReport.parse(resultData);
                results.push(planReport);
            }
            // 做额外的分析
            this.Echarts.ExtendedAnalysis.intervalOrderProfitDemandDecrease(results);
            this.Echarts.init(results);
        };
    }
    Echarts = {
        ExtendedAnalysis: {
            intervalOrderProfitDemandDecrease: function (data) {
                // 先创建一个EchartsExt对象，用于存放扩展分析的结果
                data.EchartsExt = {};
                // 初始化利润增长率区间的下标，-1表示还没有找到这个区间的下标
                data.EchartsExt.intervalOrderProfitDemandDecrease = {
                    利润增长率0: -1,
                    利润增长率2: -1,
                    利润增长率4: -1,
                    利润增长率6: -1,
                    利润增长率8: -1,
                    利润增长率10: -1,
                };
                for (let i = 0; i < data.length; i++) {
                    if (i === 0) {
                        data[i].modelReportExt.利润增长金额 = new Money(0, 4);
                        data[i].modelReportExt.利润增长率 = new Percentage(0, 8);
                    } else {
                        data[i].modelReportExt.利润增长金额 = data[i].modelReportExt.利润.minus(data[i - 1].modelReportExt.利润);
                        data[i].modelReportExt.利润增长率 = new Percentage(Math.abs(data[i].modelReportExt.利润.minus(data[i - 1].modelReportExt.利润).dividedBy(data[i - 1].modelReportExt.利润).toString(), 8));
                        if (data[i].planParams.modelPlanParamsAdvertising?.roi.toNumber() === 3.5) {
                            console.log("ROI 3.5 Index", i);
                            // 怎么算出来的400%呢好奇怪
                            console.log("3.5", data[i].modelReportExt.利润.toNumber())
                            console.log("3.4", data[i - 1].modelReportExt.利润.toNumber())
                            console.log("3.5 - 3.4", data[i].modelReportExt.利润.minus(data[i - 1].modelReportExt.利润).toNumber())
                            console.log("/ 3.4", data[i].modelReportExt.利润.minus(data[i - 1].modelReportExt.利润).dividedBy(data[i - 1].modelReportExt.利润).toNumber())
                        }
                    }
                }

                // 获取要计算的数据列，这里是利润
                data.EchartsExt.Profit = data.map(item => item.modelReportExt.利润);
                console.log('抽样前的利润数据:', data.map(item => item.modelReportExt));
                // 对原始数据进行抽取
                data.EchartsExt.Profit = this.resampleToStep(data.EchartsExt.Profit, parseFloat(document.getElementById('roi-graph-step').value), 0.1);
                console.log('抽样后的利润数据:', data.EchartsExt.Profit);

                // 计算每个ROI利润的下降速度
                for (let index = 0; index < data.EchartsExt.Profit.length; index++) {
                    const item = data.EchartsExt.Profit[index];
                    if (index === 0) {

                    } else {
                        const 利润增长率 = Math.abs(new Percentage(data.EchartsExt.Profit[index][0].minus(data.EchartsExt.Profit[index - 1][0]).dividedBy(data.EchartsExt.Profit[index - 1][0]).toString(), 8).toNumber());

                        if (利润增长率 < 0.10 && 利润增长率 >= 0.06) {
                            if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率10 === -1) {
                                let q = index - 1;
                                if (q < 0) { q = 0; }
                                data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率10 = data.EchartsExt.Profit[q][1]
                                console.log('找到利润增长率10的下标了:', index, '对应的利润值是:', data.EchartsExt.Profit[q][0].toString(), '利润增长率是:', 利润增长率);
                            }
                        }

                        if (利润增长率 < 0.06 && 利润增长率 >= 0.04) {
                            if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率8 === -1) {
                                let q = index - 1;
                                if (q < 0) { q = 0; }
                                data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率8 = data.EchartsExt.Profit[q][1]
                                console.log('找到利润增长率8的下标了:', index, '对应的利润值是:', data.EchartsExt.Profit[q][0].toString(), '利润增长率是:', 利润增长率);
                                if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率10 === -1) {
                                    data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率8 = 0;
                                }
                            }

                        }

                        if (利润增长率 < 0.04 && 利润增长率 >= 0.02) {
                            if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率6 === -1) {
                                let q = index - 1;
                                if (q < 0) { q = 0; }
                                data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率6 = data.EchartsExt.Profit[q][1]
                                console.log('找到利润增长率6的下标了:', index, '对应的利润值是:', data.EchartsExt.Profit[q][0].toString(), '利润增长率是:', 利润增长率);
                                if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率10
                                    && data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率8 === -1) {
                                    data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率6 = 0;
                                }
                            }
                        }

                        if (利润增长率 < 0.02 && 利润增长率 >= 0.01) {
                            if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率4 === -1) {
                                let q = index - 1;
                                if (q < 0) { q = 0; }
                                data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率4 = data.EchartsExt.Profit[q][1]
                                console.log('找到利润增长率4的下标了:', index, '对应的利润值是:', data.EchartsExt.Profit[q][0].toString(), '利润增长率是:', 利润增长率);
                                if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率10
                                    && data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率8
                                    && data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率6 === -1) {
                                    data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率4 = 0;
                                }
                            }
                        }

                        if (利润增长率 < 0.01 && 利润增长率 > 0.0) {
                            if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率2 === -1) {
                                let q = index - 1;
                                if (q < 0) { q = 0; }
                                data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率2 = data.EchartsExt.Profit[q][1]
                                console.log('找到利润增长率2的下标了:', index, '对应的利润值是:', data.EchartsExt.Profit[q][0].toString(), '利润增长率是:', 利润增长率);
                                if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率10
                                    && data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率8
                                    && data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率6
                                    && data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率4 === -1) {
                                    data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率2 = 0;
                                }
                            }
                        }

                        if (利润增长率 === 0) {
                            if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率0 === -1) { data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率0 = data.EchartsExt.Profit[index][1] }
                        }
                    }
                }
                // 这个其实就是收尾，最终的收尾点就是利润增长率0了。
                // 理论上是不会有利润增长率0的点的，因为那意味着利润没有增长了，继续增加投入也没什么意义了。
                // 但是我们需要0这个点位。这样才能在可视化上形成闭环的坐标点。
                // 这个点初始化是-1，因此如果到了这里还是-1，就说明利润增长率一直没有降到0以下，
                // 或者说利润一直在增长，甚至可能出现了利润增长率为0的点，这个时候就把这个点设置为最后一个index。
                if (data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率0 === -1) { data.EchartsExt.intervalOrderProfitDemandDecrease.利润增长率0 = data.EchartsExt.Profit[data.EchartsExt.Profit.length - 1][1]; }
            },
            /**
             * 将数组重采样，使得结果看起来像是用 targetStep 步进生成的
             * @param {Array<number>} arr - 原始数组
             * @param {number} start - 起始值
             * @param {number} end - 结束值
             * @param {number} step - 原始步进 (0.0001 ~ 1)
             * @param {number} targetStep - 目标步进，默认 0.1
             * @returns {Array<number>} 重采样后的数组
             */
            resampleToStep: function (arr, step, targetStep = 0.1) {
                if (!Array.isArray(arr) || arr.length === 0) {
                    return [];
                }

                const n = arr.length;
                if (n === 1) {
                    return [arr[0]];
                }

                // 假设开始0，结束9.9，步进0.1，理论上是100个点，也就是100个下标。
                // 假设实际步进是0.03，那么理论上一共是300个点，也就是300个下标。
                // 相当于 300/100=3，也就是每3个点取一个点，取300个点中的第0、3、6、9...这些点，直到300这个点。
                // 那么，同时也相当于是 0.03/0.01=3，那么相当于我们不需要开始和结束这俩个参数。
                // 但假如实际步进是0.033，那么0.033/0.01=3.3。
                // 但是下标都是整数,所以，使用四舍五入取整，也就是 Math.round(3.3)=3，那么相当于每3个点取一个点，取300个点中的第0、3、6、9...这些点，直到300这个点。
                // 但是如果实际步进是0.037，那么0.037/0.01=3.7，那么 Math.round(3.7)=4，那么相当于每4个点取一个点，取300个点中的第0、4、8、12...这些点，直到300这个点。
                // 这样就能保证不管实际步进是多少，我们都能大致按照目标步进来取点了。
                // 最后一个点，一定是结束点，也就是下标为n-1的点，无论步进如何，都要取这个点。
                const stepRatio = Math.round(targetStep / step);
                console.log(`resampleToStep: step=${step}, targetStep=${targetStep}, stepRatio=${stepRatio}, originalLength=${n}`);
                if (stepRatio <= 1) {
                    // 如果步进已经小于等于目标步进了，就不需要重采样了，直接返回原数组，并且把每个点都加上它的下标，变成二维数组，这样在visualMap中就能用到这些下标来设置颜色了。
                    const resampled = [];
                    for (let i = 0; i < n; i++) {
                        resampled.push([arr[i], i]);
                    }
                    return resampled;
                }

                // resampled是二维数组，除了要记录取的点的值，还要记录取的点的下标，这样才能在visualMap中用到这些下标来设置颜色。
                const resampled = [];
                for (let i = 0; i < n; i += stepRatio) {
                    resampled.push([arr[i], i]);
                }
                if (resampled[resampled.length - 1][0] !== arr[n - 1]) {
                    resampled.push([arr[n - 1], n - 1]);
                }
                return resampled;
            }
        },
        ECharts: null,
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
                '推广回报率',
                '利润增长金额',
                '利润增长率',
            ],
            selected: {
                '利润': true,
                '利润率': false,
                '资本回报率': false,
                '推广回报率': false,
                '利润增长金额': false,
                '利润增长率': true,
            }
        },
        legendAdd: function (data) {
            // 如果广告名称不在 legend.data 中，则添加
            const adName = "广告：" + data[0].modelReportAdvertising.广告名称;
            if (!this.legend.data.includes(adName)) {
                this.legend.data.push(adName);
                this.legend.selected[adName] = false; // 默认不选中
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
                    markArea: {
                        data: this.series_areas(data),
                    }
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
                {
                    name: '推广回报率',
                    type: 'line',
                    smooth: true,
                    data: data.map(item => item.modelReportExt.推广回报率.toNumber()),
                    tooltip: { // 单独配置该系列的tooltip
                        valueFormatter: function (value) {
                            return new Percentage(value).toPercentString(2);
                        },
                    },
                },
                {
                    name: '利润增长金额',
                    type: 'line',
                    smooth: true,
                    data: data.map(item => item.modelReportExt.利润增长金额.toNumber()),
                    tooltip: { // 单独配置该系列的tooltip
                        valueFormatter: function (value) {
                            const v = new Money(value, 4);
                            v.options.suffix = ' 元';
                            return v.toLocaleFixed(2) + v.options.suffix;
                        },
                    },
                    yAxisIndex: 0, // 利润增长金额使用第二个y轴
                },
                {
                    name: '利润增长率',
                    type: 'line',
                    smooth: true,
                    data: data.map(item => item.modelReportExt.利润增长率.toNumber()),
                    tooltip: { // 单独配置该系列的tooltip
                        valueFormatter: function (value) {
                            return new Percentage(value).toPercentString(2);
                        },
                    },
                    yAxisIndex: 1, // 利润增长率使用第二个y轴
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
        visualMap: function (data) {
            const v = {
                show: false,
                dimension: 0,
                pieces: this.visualMpa_areas(data),
                seriesIndex: 0, // 只对第一条线（利润）生效
            }
            return v;
        },
        visualMpa_areas: function (data) {
            console.log('visualMpa_areas data:', data.EchartsExt);
            const d = data.EchartsExt.intervalOrderProfitDemandDecrease;

            // 定义候选段，-1 就整段不要
            const candidates = [
                { key: '利润增长率10', lte: d.利润增长率10, color: 'rgba(255, 0, 0, 1)' },
                { key: '利润增长率8', gt: d.利润增长率10, lte: d.利润增长率8, color: 'rgba(255, 69, 0, 1)' },
                { key: '利润增长率6', gt: d.利润增长率8, lte: d.利润增长率6, color: 'rgba(255, 165, 0, 1)' },
                { key: '利润增长率4', gt: d.利润增长率6, lte: d.利润增长率4, color: 'rgba(255, 215, 0, 1)' },
                { key: '利润增长率2', gt: d.利润增长率4, lte: d.利润增长率2, color: 'rgba(173, 255, 47, 1)' },
                { key: '利润增长率0', gt: d.利润增长率2, lte: d.利润增长率0, color: 'rgba(50, 205, 50, 1)' },
                { key: '利润增长率0', gt: d.利润增长率0, color: 'rgba(0, 128, 0, 1)' }
            ].filter(g => d[g.key] !== -1);   // -1 就整段删
            return candidates;
        },
        series_areas_helper: function (data, d, j) {
            const order = ['利润增长率0', '利润增长率2', '利润增长率4', '利润增长率6', '利润增长率8', '利润增长率10'];

            let end = data.length;
            for (let i = 0; i < order.length - j; i++) {   // 倒着找
                if (d[order[i]] !== -1) {
                    end = d[order[i]];   // 拿到最后一个有效值
                }
            }
            return end;
        },
        series_areas: function (data) {
            // 先取短名，少写一堆字
            const d = data.EchartsExt.intervalOrderProfitDemandDecrease;

            const areas = [
                { key: '利润增长率10+', name: '严重(+10%)', color: 'rgba(255, 0, 0, 0.3)', start: 0, end: this.series_areas_helper(data, d, 0) },
                { key: '利润增长率10', name: '不良(+6%)', color: 'rgba(255, 69, 0, 0.3)', start: d.利润增长率10, end: this.series_areas_helper(data, d, 1) },
                { key: '利润增长率8', name: '待改进(+4%)', color: 'rgba(255, 165, 0, 0.3)', start: d.利润增长率8, end: this.series_areas_helper(data, d, 2) },
                { key: '利润增长率6', name: '一般(+2%)', color: 'rgba(255, 215, 0, 0.3)', start: d.利润增长率6, end: this.series_areas_helper(data, d, 3) },
                { key: '利润增长率4', name: '良好(+1%)', color: 'rgba(173, 255, 47, 0.3)', start: d.利润增长率4, end: this.series_areas_helper(data, d, 4) },
                { key: '利润增长率2', name: '优秀(+0%)', color: 'rgba(50, 205, 50, 0.3)', start: d.利润增长率2, end: this.series_areas_helper(data, d, 5) },
                // 理论上是不会有卓越的存在，但是代码要保留。
                // 因为之前是单量增量的计算，当时是可以出现卓越的。
                // 万一之后要用到，还能看一眼，不然又得费脑子。
                // 本质上它是来收尾的。只不过在这里，优秀的那个就已经在事实上收尾了。
                { key: '利润增长率0', name: '卓越(+0)', color: 'rgba(0, 128, 0, 0.3)', start: d.利润增长率0, end: data.length - 1 }
            ]
                .filter(g => g.start !== -1)                // -1 就整段不要
                .filter(g => g.start < g.end)               // start>=end 就整段不要
                .filter(g => g.start !== g.end);            // 这个过滤条件是为了保证 start 和 end 不相等，因为如果相等了，就说明这个区间没有长度了，也就没有意义了。

            console.log('series_areas areas:', areas);

            const areas_v = areas.map(g => [
                {
                    name: g.name,
                    xAxis: g.start,
                    itemStyle: { color: g.color }
                },
                {
                    xAxis: g.end
                }
            ]);

            return areas_v;
        },
        init: function (data) {
            // 基于准备好的dom，初始化echarts实例
            const that = this;
            echarts.registerTransform(ecStat.transform.histogram);
            if (this.ECharts === null) {
                this.ECharts = echarts.init(document.getElementById('roi-graph-container'));
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
                    data: data.map(item => item.planParams.modelPlanParamsAdvertising.roi.toFixed(4)),
                },
                yAxis: [
                    {
                        type: 'value',
                        scale: true,
                        position: 'left',
                    },
                    {
                        type: 'value',
                        scale: true,
                        position: 'right',
                    }
                ],
                series: this.series(data),
                visualMap: this.visualMap(data),
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
                this.ECharts = echarts.init(document.getElementById('roi-graph-container'));
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
        const planReportRoiGraph = new PlanReportRoiGraphManager();
        await planReportRoiGraph.initialize();

        // // 将实例暴露到全局，方便调试
        // window.planReportRoiGraph = planReportRoiGraph;
    } catch (error) {
        console.error('Failed to initialize planParams:', error);
        alert('方案报告页面初始化失败，请刷新页面重试-2');
    }
});