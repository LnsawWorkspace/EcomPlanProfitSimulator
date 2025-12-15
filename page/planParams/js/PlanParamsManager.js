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
class PlanParamsManager {

    #showToast = {};
    #elements = {};
    #modals = {};
    #repositoryWorkspace = undefined;
    #repositoryPlanGroup = undefined;
    #repositoryPlanMeta = undefined;
    #repositoryPlanParams = undefined;
    #workspace = undefined;
    #planGroup = undefined;
    #planMeta = undefined;
    /**
     * 构造函数
     */
    constructor() {
        console.log("%c PlanParamsManager构造函数被调用 ", "color: green; font-weight: bold;", performance.now());

        this.#initializeShowToast();
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

    // 私有方法：规范数字字符串（移除 ¥ ￥ % 中英文逗号 空白，支持括号负号）
    // 实际上被大量使用，只是被封装在 GetParams 等块里的方式使用，IDE可能看不到引用。
    #sanitizeNumberString(input) {
        if (input === null || input === undefined) return '';
        let s = String(input).trim();

        // 处理括号表示的负数 (123.45) => -123.45
        const paren = s.match(/^\((.*)\)$/);
        if (paren) s = '-' + paren[1].trim();

        // 删除货币符号、百分号、中英文逗号、以及各种空白（包括 NBSP）
        s = s.replace(/[¥￥%\u00A0\s,，]+/g, '');

        // 仅保留数字、小数点和前导符号
        s = s.replace(/[^0-9.+\-]/g, '');

        // 若有多个小数点，仅保留第一个
        const parts = s.split('.');
        if (parts.length > 2) {
            s = parts.shift() + '.' + parts.join('');
        }

        // 规整多个符号为单个前导符号
        s = s.replace(/^(?:[+-])+/g, (m) => m.slice(-1));

        return s;
    }

    /**
   * 初始化工作台
   */
    async initialize() {
        console.log("%c PlanParamsManager初始化开始 ", "color: green; font-weight: bold;", performance.now());
        this.#initializeElements();
        console.log("%c 元素初始化完成 ", "color: green; font-weight: bold;", performance.now());
        this.#initializeModals();
        console.log("%c 模态框初始化完成 ", "color: green; font-weight: bold;", performance.now());
        this.#initializeEventListeners();
        console.log("%c 事件监听初始化完成 ", "color: green; font-weight: bold;", performance.now());
        await this.#initPlanParams();
        console.log("%c PlanParamsManager初始化完成 ", "color: green; font-weight: bold;", performance.now());

        const navigationEntry = performance.getEntriesByType('navigation')[0];
        console.log('导航开始时间:', navigationEntry.startTime);
        console.log('DOMContentLoaded 事件触发时间:', navigationEntry.domContentLoadedEventStart);
        console.log('页面加载完成时间:', navigationEntry.loadEventStart);
    }
    /**
     * 将DOM元素转为DOM对象
     */
    #initializeElements() {
        const elements_id = {
            savePlanParams: 'savePlanParams',
            submitBtn: 'submitBtn',


            goodsContainer: 'goodsContainer',
            addGoodsBtn: 'addGoodsBtn',
            giftContainer: 'giftContainer',
            addGiftBtn: 'addGiftBtn',
            expensePerOrderContainer: 'expensePerOrderContainer',
            addexpensePerOrderBtn: 'addexpensePerOrderBtn',
            expenseMNPerOrderContainer: 'expenseMNPerOrderContainer',
            addexpenseMNPerOrderBtn: 'addexpenseMNPerOrderBtn',
            expenseFixedContainer: 'expenseFixedContainer',
            addexpenseFixedBtn: 'addexpenseFixedBtn',

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
     * 初始化Bootstrap模态框
     */
    #initializeModals() {
        // 使用Bootstrap 5的Modal类初始化所有模态框
        const modalIds = [
            'paramsModal_Goods',
            'paramsModal_Gift',
            'paramsModal_ExpensePerOrder',
            'paramsModal_ExpenseMNPerOrder',
            'paramsModal_ExpenseFixed',
        ];

        for (const id of modalIds) {
            const element = document.getElementById(id);
            if (element) {
                this.#modals[id] = new bootstrap.Modal(element);

                element.addEventListener('hide.bs.modal', () => {
                    //清理焦点
                    document.activeElement.blur();

                    this.Goods.editingRow = null;
                    this.Gift.editingRow = null;
                    this.Expense_PerOrder.editingRow = null;
                });

                element.addEventListener('hidden.bs.modal', () => {
                    //重置表单
                    element.querySelector('form').reset();
                });

                element.addEventListener('shown.bs.modal', () => {
                    //聚焦第一个输入框
                    const firstInput = element.querySelector('form input, form select, form textarea');
                    if (firstInput) {
                        firstInput.focus();
                    }

                    //如果element是paramsModal_ExpensePerOrder,调用this.Expense_PerOrder.initSelectOptions()
                    if (id === 'paramsModal_ExpensePerOrder') {
                        this.Expense_PerOrder.initSelectOptions(this);
                    }

                    //如果element是paramsModal_ExpenseMNPerOrder,调用this.Expense_MNPerOrder.initSelectOptions()
                    if (id === 'paramsModal_ExpenseMNPerOrder') {
                        this.Expense_MNPerOrder.initSelectOptions(this);
                    }
                });
            }
        }
    }
    /**
     * 设置事件监听
     */
    #initializeEventListeners() {
        // 使用Map和forEach优化事件监听设置
        const clickListeners = new Map([
            ['savePlanParams', () => this.#saveParamsData()],
            ['submitBtn', () => this.#saveParamsData()],

            ['addGoodsBtn', () => this.Goods.addRow(this)],
            ['addGiftBtn', () => this.Gift.addRow(this)],
            ['addexpensePerOrderBtn', () => this.Expense_PerOrder.addRow(this)],
            ['addexpenseMNPerOrderBtn', () => this.Expense_MNPerOrder.addRow(this)],
            ['addexpenseFixedBtn', () => this.Expense_Fixed.addRow(this)],


        ]);

        for (const [elementKey, handler] of clickListeners) {
            this.#elements[elementKey]?.addEventListener('click', handler);
        }
    }

    money(v) {
        return '¥' + LnsawTool.NumberTools.toMoney(Number(v) || 0, 2);
    }

    numFmt(v) {
        return LnsawTool.NumberTools.toFixed(Number(v) || 0, 0);
    }

    pctFmt(v) {
        return LnsawTool.NumberTools.toFixed(Number(v) || 0, 2) + '%';
    }

    async #initPlanParams() {
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
        // 当this.#workspace存在时，初始化其他repository,否则不执行任何操作
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
                    //加载方案数据的逻辑
                    await this.#repositoryPlanParams.getPlanParamsById(this.#planMeta.id)
                        .then((planParams) => {
                            // 修改 .main-title 下的H1的内容
                            const titleElement = document.querySelector('.main-title h1 span');
                            if (titleElement) {
                                titleElement.textContent = `${this.#workspace.name} -> ${this.#planGroup.name} -> ${this.#planMeta.name}`;
                            }
                            if (planParams) {
                                this.#loadPlanParams(planParams);

                            }
                        });
                    console.log("%c 方案参数加载完成：", "color: green; font-weight: bold;", performance.now());
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
        document.body.innerHTML = '<div style="text-align:center; margin-top:50px;"><h2>方案不存在或无法加载，请检查链接或返回上一页。</h2></div>';
    }

    #saveParamsData() {
        try {
            let paramsData = this.#getParams();
            console.log("收集的参数", paramsData);

            this.#repositoryPlanParams.savePlanParams(paramsData).then(() => {
                this.#showToast.success('方案参数保存成功！', 3000);
            }).catch((error) => {
                this.#showToast.error(`保存方案参数时出错：${error.message}`, 5000);
            });

        } catch (error) {

        }
    }

    #getReport() {

    }

    #getParams() {
        try {
            const entity = new Entity_PlanParams({ id: this.#planMeta.id || crypto.randomUUID() });
            entity.modelPlanParamsSale = this.GetParams.getParams_Sale();
            entity.modelPlanParamsRefund = this.GetParams.getParams_Refund();
            entity.modelPlanParamsAdvertising = this.GetParams.getParams_Advertising();

            entity.modelPlanParamsGoods = this.GetParams.getParams_Goods(this);
            entity.modelPlanParamsGift = this.GetParams.getParams_Gift(this);
            entity.modelPlanParamsExpensePerOrder = this.GetParams.getParams_Expense_PerOrder(this);
            entity.modelPlanParamsExpenseMNPerOrder = this.GetParams.getParams_Expense_MNPerOrder(this);
            entity.modelPlanParamsExpenseFixed = this.GetParams.getParams_Expense_Fixed(this);
            return entity;
        } catch (error) {
            this.#showToast.error(`错误：${error.message}`, 5000);
            throw error;
        }
    }

    #loadPlanParams(planParams) {

        // 填充销售参数
        if (planParams.modelPlanParamsSale) {
            document.getElementById("sale_price").value = planParams.modelPlanParamsSale.salePrice.toFixed();
            document.getElementById("sale_method_cost").checked = (planParams.modelPlanParamsSale.method === "cost");
            document.getElementById("sale_method_fair").checked = (planParams.modelPlanParamsSale.method === "fair");
            document.getElementById("sale_Number").value = planParams.modelPlanParamsSale.payOrderQuantity.toString();
        }
        // 填充退款参数
        if (planParams.modelPlanParamsRefund) {
            document.getElementById("refund_bef_per").value = planParams.modelPlanParamsRefund.refundBefPer.times(100).toString();
            document.getElementById("refund_ing_per").value = planParams.modelPlanParamsRefund.refundIngPer.times(100).toString();
            document.getElementById("refund_aft_per").value = planParams.modelPlanParamsRefund.refundAftPer.times(100).toString();
        }
        // 填充广告参数
        if (planParams.modelPlanParamsAdvertising) {
            document.getElementById("advertising_name").value = planParams.modelPlanParamsAdvertising.name;
            document.getElementById("advertising_roi").value = planParams.modelPlanParamsAdvertising.roi.toString();
            document.getElementById("advertising_rate").value = planParams.modelPlanParamsAdvertising.inputRate.times(100).toString();
            document.getElementById("advertising_refund_bef_rec").value = planParams.modelPlanParamsAdvertising.refundBefRec.times(100).toString();
            document.getElementById("advertising_refund_ing_rec").value = planParams.modelPlanParamsAdvertising.refundIngRec.times(100).toString();
            document.getElementById("advertising_refund_aft_rec").value = planParams.modelPlanParamsAdvertising.refundAftRec.times(100).toString();
        }

        // 填充物资参数（传入当前实例作为 owner，以便 loadParams 能使用类方法）
        this.Goods.loadParams(planParams.modelPlanParamsGoods || [], this);
        this.Gift.loadParams(planParams.modelPlanParamsGift || [], this);
        this.Expense_PerOrder.loadParams(planParams.modelPlanParamsExpensePerOrder || [], this);
        this.Expense_MNPerOrder.loadParams(planParams.modelPlanParamsExpenseMNPerOrder || [], this);
        this.Expense_Fixed.loadParams(planParams.modelPlanParamsExpenseFixed || [], this);

    }

    GetParams = {
        getParams_Sale() {
            let 售价 = document.getElementById("sale_price").value;
            let 类型 = document.getElementById("sale_method_cost").checked ? "cost" : "fair";
            let 单量 = document.getElementById("sale_Number").value;

            if (!售价 || isNaN(售价) || Number(售价) <= 0) {
                throw new Error("请输入有效的正数作为售价");
            }

            if (!单量 || isNaN(单量) || !Number.isInteger(Number(单量)) || Number(单量) <= 0) {
                throw new Error("请输入有效的正整数作为单量");
            }

            return new Model_PlanParams_Sale({ salePrice: 售价, method: 类型, payOrderQuantity: 单量 });
        },
        getParams_Refund() {
            let refundBefPer = Decimal(document.getElementById("refund_bef_per").value || 0).div(100);
            let refundIngPer = Decimal(document.getElementById("refund_ing_per").value || 0).div(100);
            let refundAftPer = Decimal(document.getElementById("refund_aft_per").value || 0).div(100);

            if (!refundBefPer.isFinite() || refundBefPer.lessThan(0) || refundBefPer.greaterThan(1)) {
                throw new Error("请输入有效的售前退款比例（0-100%）");
            }
            if (!refundIngPer.isFinite() || refundIngPer.lessThan(0) || refundIngPer.greaterThan(1)) {
                throw new Error("请输入有效的售中退款比例（0-100%）");
            }
            if (!refundAftPer.isFinite() || refundAftPer.lessThan(0) || refundAftPer.greaterThan(1)) {
                throw new Error("请输入有效的售后退款比例（0-100%）");
            }

            if (refundBefPer.plus(refundIngPer).plus(refundAftPer).greaterThan(1)) {
                throw new Error("退款比例总和不能超过100%");
            }

            return new Model_PlanParams_Refund({
                refundBefPer: refundBefPer,
                refundIngPer: refundIngPer,
                refundAftPer: refundAftPer
            });
        },
        getParams_Advertising() {
            let advertisingName = document.getElementById("advertising_name").value;
            let advertisingRoi = document.getElementById("advertising_roi").value;
            let advertisingRate = Decimal(document.getElementById("advertising_rate").value || 0).div(100);
            let advertisingRefundBefRec = Decimal(document.getElementById("advertising_refund_bef_rec").value || 0).div(100);
            let advertisingRefundIngRec = Decimal(document.getElementById("advertising_refund_ing_rec").value || 0).div(100);
            let advertisingRefundAftRec = Decimal(document.getElementById("advertising_refund_aft_rec").value || 0).div(100);

            if (!advertisingName || advertisingName.trim() === '') {
                return null; // 广告名称为空时，返回null表示不使用广告参数
            }
            if (!advertisingRoi || isNaN(advertisingRoi) || Number(advertisingRoi) <= 0) {
                throw new Error("请输入有效的广告ROI");
            }
            if (isNaN(advertisingRate) || Number(advertisingRate) < 0 || Number(advertisingRate) > 100) {
                throw new Error("请输入有效的广告税率（0-100%）");
            }
            if (isNaN(advertisingRefundBefRec) || Number(advertisingRefundBefRec) < 0 || Number(advertisingRefundBefRec) > 1) {
                throw new Error("请输入有效的广告售前回收率（0-100%）");
            }
            if (isNaN(advertisingRefundIngRec) || Number(advertisingRefundIngRec) < 0 || Number(advertisingRefundIngRec) > 1) {
                throw new Error("请输入有效的广告售中回收率（0-100%）");
            }
            if (isNaN(advertisingRefundAftRec) || Number(advertisingRefundAftRec) < 0 || Number(advertisingRefundAftRec) > 1) {
                throw new Error("请输入有效的广告售后回收率（0-100%）");
            }

            return new Model_PlanParams_Advertising({
                name: advertisingName,
                roi: advertisingRoi,
                inputRate: advertisingRate,
                refundBefRec: advertisingRefundBefRec,
                refundIngRec: advertisingRefundIngRec,
                refundAftRec: advertisingRefundAftRec
            });
        },
        getParams_Goods(that) {
            let goods = [];
            that.#elements.goodsContainer.querySelectorAll('tr').forEach(function (item) {
                const cells = item.querySelectorAll('td');
                // 若行不包含有效单元格则跳过（例如表头或空行）
                if (!cells || cells.length < 4) return;

                const text = (i) => (cells[i] && cells[i].textContent) ? cells[i].textContent.trim() : '';

                const name = text(0);
                if (!name) return; // 跳过空名称的行

                const numRaw = that.#sanitizeNumberString(text(1));
                const purchaseAmountRaw = that.#sanitizeNumberString(text(2));
                const purchaseQuantityRaw = that.#sanitizeNumberString(text(3));
                const valueIncTaxRaw = that.#sanitizeNumberString(text(4));
                const valueExcTaxRaw = that.#sanitizeNumberString(text(5));
                const fairValueRaw = that.#sanitizeNumberString(text(6));

                const inputRateRaw = that.#sanitizeNumberString(text(7));
                const outputRateRaw = that.#sanitizeNumberString(text(8));

                const refundBefRaw = that.#sanitizeNumberString(text(9));
                const refundIngRaw = that.#sanitizeNumberString(text(10));
                const refundAftRaw = that.#sanitizeNumberString(text(11));

                // 构建 DTO，保留原始字符串或解析为 Decimal（Model 会使用 ValidateUtils.decimal/decimalRange 进行最终校验）
                const dto = {
                    name: name,
                    quantity: numRaw || 1,
                    purchaseAmount: purchaseAmountRaw || 0,
                    purchaseQuantity: purchaseQuantityRaw || 0,
                    valueIncTax: valueIncTaxRaw || 0,
                    valueExcTax: valueExcTaxRaw || 0,
                    // 税率与回收率统一以 0-1 小数表示（如果单元格为空则不传，Model 会使用默认值）
                    inputRate: inputRateRaw ? (new Decimal(inputRateRaw)).div(100) : undefined,
                    outputRate: outputRateRaw ? (new Decimal(outputRateRaw)).div(100) : inputRateRaw ? (new Decimal(inputRateRaw)).div(100) : undefined,
                    fairValue: fairValueRaw || 0,
                    refundBefRec: refundBefRaw ? (new Decimal(refundBefRaw)).div(100) : undefined,
                    refundIngRec: refundIngRaw ? (new Decimal(refundIngRaw)).div(100) : undefined,
                    refundAftRec: refundAftRaw ? (new Decimal(refundAftRaw)).div(100) : undefined,
                };

                try {
                    const rowData = new Model_PlanParams_Goods(dto);
                    goods.push(rowData);
                } catch (e) {
                    // 若某行数据构建实体失败，则记录提示并跳过该行
                    that.#showToast.warning(`跳过商品行（${name}）：${e.message}`, 5000);
                }
            });
            return goods;
        },
        getParams_Gift(that) {
            let gifts = [];
            that.#elements.giftContainer.querySelectorAll('tr').forEach(function (item) {
                const cells = item.querySelectorAll('td');
                // 若行不包含有效单元格则跳过（例如表头或空行）
                if (!cells || cells.length < 4) return;

                const text = (i) => (cells[i] && cells[i].textContent) ? cells[i].textContent.trim() : '';

                const name = text(0);
                if (!name) return; // 跳过空名称的行

                const numRaw = that.#sanitizeNumberString(text(1));
                const purchaseAmountRaw = that.#sanitizeNumberString(text(2));
                const purchaseQuantityRaw = that.#sanitizeNumberString(text(3));
                const valueIncTaxRaw = that.#sanitizeNumberString(text(4));
                const valueExcTaxRaw = that.#sanitizeNumberString(text(5));
                const fairValueRaw = that.#sanitizeNumberString(text(6));

                const inputRateRaw = that.#sanitizeNumberString(text(7));
                const outputRateRaw = that.#sanitizeNumberString(text(8));

                const refundBefRaw = that.#sanitizeNumberString(text(9));
                const refundIngRaw = that.#sanitizeNumberString(text(10));
                const refundAftRaw = that.#sanitizeNumberString(text(11));

                const subjectTypeRaw = text(12);

                // 构建 DTO，保留原始字符串或解析为 Decimal（Model 会使用 ValidateUtils.decimal/decimalRange 进行最终校验）
                const dto = {
                    name: name,
                    quantity: numRaw || 1,
                    purchaseAmount: purchaseAmountRaw || 0,
                    purchaseQuantity: purchaseQuantityRaw || 0,
                    valueIncTax: valueIncTaxRaw || 0,
                    valueExcTax: valueExcTaxRaw || 0,
                    // 税率与回收率统一以 0-1 小数表示（如果单元格为空则不传，Model 会使用默认值）
                    inputRate: inputRateRaw ? (new Decimal(inputRateRaw)).div(100) : undefined,
                    outputRate: outputRateRaw ? (new Decimal(outputRateRaw)).div(100) : undefined,
                    fairValue: fairValueRaw || 0,
                    refundBefRec: refundBefRaw ? (new Decimal(refundBefRaw)).div(100) : undefined,
                    refundIngRec: refundIngRaw ? (new Decimal(refundIngRaw)).div(100) : undefined,
                    refundAftRec: refundAftRaw ? (new Decimal(refundAftRaw)).div(100) : undefined,
                    subjectType: subjectTypeRaw || '其他',
                };

                try {
                    const rowData = new Model_PlanParams_Gift(dto);
                    gifts.push(rowData);
                } catch (e) {
                    // 若某行数据构建实体失败，则记录提示并跳过该行
                    that.#showToast.warning(`跳过礼品行（${name}）：${e.message}`, 5000);
                }
            });
            return gifts;
        },
        getParams_Expense_PerOrder(that) {
            let expenses = [];
            that.#elements.expensePerOrderContainer.querySelectorAll('tr').forEach(function (item) {
                const cells = item.querySelectorAll('td');
                // 若行不包含有效单元格则跳过（例如表头或空行）
                if (!cells || cells.length < 2) return;
                const text = (i) => (cells[i] && cells[i].textContent) ? cells[i].textContent.trim() : '';

                const name = text(0);
                if (!name) return; // 跳过空名称的行
                const amountRaw = that.#sanitizeNumberString(text(1));
                const inputRateRaw = that.#sanitizeNumberString(text(2));
                const typeText = text(3);
                const baseRaw = text(4);
                const baseHaveTaxText = text(5);
                const refundBefRaw = that.#sanitizeNumberString(text(6));
                const refundIngRaw = that.#sanitizeNumberString(text(7));
                const refundAftRaw = that.#sanitizeNumberString(text(8));

                // 解析计费类型：显示文本到内部值 ('num'|'per')
                const valueType = (typeText === '固定金额') ? 'num' : 'per';

                const baseHaveTax = (baseHaveTaxText === '含税');

                // 构建 DTO，按 Model_PlanParams_Expense_PerOrder 的字段要求传递
                const dto = {
                    name: name,
                    // value: 金额原值或百分比（如果是百分比则传 0-1 的 Decimal）
                    valueMoney: (valueType === 'num') ? (amountRaw || 0) : 0,
                    valuePercentage: (valueType === 'per') ? (amountRaw ? (new Decimal(amountRaw)).div(100) : 0) : 0,
                    valueType: valueType,
                    inputRate: inputRateRaw ? (new Decimal(inputRateRaw)).div(100) : undefined,
                    base: baseRaw,
                    baseHaveTax: baseHaveTax,
                    refundBefRec: refundBefRaw ? (new Decimal(refundBefRaw)).div(100) : undefined,
                    refundIngRec: refundIngRaw ? (new Decimal(refundIngRaw)).div(100) : undefined,
                    refundAftRec: refundAftRaw ? (new Decimal(refundAftRaw)).div(100) : undefined,
                };
                try {
                    const rowData = new Model_PlanParams_Expense_PerOrder(dto);
                    expenses.push(rowData);
                } catch (e) {
                    // 若某行数据构建实体失败，则记录提示并跳过该行
                    that.#showToast.warning(`跳过单订单费用行（${name}）：${e.message}`, 5000);
                }
            });
            return expenses;
        },
        getParams_Expense_MNPerOrder(that) {
            let expenses = [];
            that.#elements.expenseMNPerOrderContainer.querySelectorAll('tr').forEach(function (item) {
                const cells = item.querySelectorAll('td');
                // 若行不包含有效单元格则跳过（例如表头或空行）
                if (!cells || cells.length < 2) return;
                const text = (i) => (cells[i] && cells[i].textContent) ? cells[i].textContent.trim() : '';
                const name = text(0);
                if (!name) return; // 跳过空名称的行
                const orderPerRaw = that.#sanitizeNumberString(text(1));
                const amountRaw = that.#sanitizeNumberString(text(2));
                const inputRateRaw = that.#sanitizeNumberString(text(3));
                const typeText = text(4);
                const baseRaw = text(5);
                const baseHaveTaxText = text(6);
                const refundBefPerRaw = that.#sanitizeNumberString(text(7));
                const refundIngPerRaw = that.#sanitizeNumberString(text(8));
                const refundAftPerRaw = that.#sanitizeNumberString(text(9));
                const refundBefRecRaw = that.#sanitizeNumberString(text(10));
                const refundIngRecRaw = that.#sanitizeNumberString(text(11));
                const refundAftRecRaw = that.#sanitizeNumberString(text(12));

                // 解析计费类型：显示文本到内部值 ('num'|'per')
                const valueType = (typeText === '固定金额') ? 'num' : 'per';
                const baseHaveTax = (baseHaveTaxText === '含税');
                // 构建 DTO，按 Model_PlanParams_Expense_MNPerOrder 的字段要求传递
                const dto = {
                    name: name,
                    orderPer: orderPerRaw ? (new Decimal(orderPerRaw)).div(100) : 0,
                    // value: 金额原值或百分比（如果是百分比则传 0-1 的 Decimal）
                    valueMoney: (valueType === 'num') ? (amountRaw || 0) : 0,
                    valuePercentage: (valueType === 'per') ? (amountRaw ? (new Decimal(amountRaw)).div(100) : 0) : 0,
                    valueType: valueType,
                    inputRate: inputRateRaw ? (new Decimal(inputRateRaw)).div(100) : undefined,
                    base: baseRaw,
                    baseHaveTax: baseHaveTax,
                    refundBefPer: refundBefPerRaw ? (new Decimal(refundBefPerRaw)).div(100) : undefined,
                    refundIngPer: refundIngPerRaw ? (new Decimal(refundIngPerRaw)).div(100) : undefined,
                    refundAftPer: refundAftPerRaw ? (new Decimal(refundAftPerRaw)).div(100) : undefined,
                    refundBefRec: refundBefRecRaw ? (new Decimal(refundBefRecRaw)).div(100) : undefined,
                    refundIngRec: refundIngRecRaw ? (new Decimal(refundIngRecRaw)).div(100) : undefined,
                    refundAftRec: refundAftRecRaw ? (new Decimal(refundAftRecRaw)).div(100) : undefined,
                };
                try {
                    const rowData = new Model_PlanParams_Expense_MNPerOrder(dto);
                    expenses.push(rowData);
                } catch (e) {
                    // 若某行数据构建实体失败，则记录提示并跳过该行
                    that.#showToast.warning(`跳过每万单费用行（${name}）：${e.message}`, 5000);
                }
            });
            return expenses;
        },
        getParams_Expense_Fixed(that) {
            let expenses = [];
            that.#elements.expenseFixedContainer.querySelectorAll('tr').forEach(function (item) {
                const cells = item.querySelectorAll('td');
                // 若行不包含有效单元格则跳过（例如表头或空行）
                if (!cells || cells.length < 2) return;
                const text = (i) => (cells[i] && cells[i].textContent) ? cells[i].textContent.trim() : '';
                const name = text(0);
                if (!name) return;
                const amountRaw = that.#sanitizeNumberString(text(1));
                const inputRateRaw = that.#sanitizeNumberString(text(2));

                // 构建 DTO，按 Model_PlanParams_Expense_Fixed 的字段要求传递
                const dto = {
                    name: name,
                    value: amountRaw || 0,
                    inputRate: inputRateRaw ? (new Decimal(inputRateRaw)).div(100) : undefined,
                };
                try {
                    const rowData = new Model_PlanParams_Expense_Fixed(dto);
                    expenses.push(rowData);
                } catch (e) {
                    // 若某行数据构建实体失败，则记录提示并跳过该行
                    that.#showToast.warning(`跳过固定费用行（${name}）：${e.message}`, 5000);
                }
            });
            return expenses;
        },
    }

    Goods = {
        editingRow: null,
        goodsCounter: 0,
        addRow: function (that) {
            //获取数据
            let 商品名称 = document.getElementById("goods-name").value;
            if (!商品名称 || 商品名称.trim() === '') { that.#showToast.error("商品名称不能为空"); return; }
            // 原始输入
            const rawNum = document.getElementById("goods-num").value;
            const rawPurchaseAmount = document.getElementById("goods-purchase_amount").value;
            const rawPurchaseQuantity = document.getElementById("goods-purchase_quantity").value;
            const rawCostWithTax = document.getElementById("goods-cost_withtax").value;
            const rawCostNoTax = document.getElementById("goods-cost_notax").value;
            const rawInputRate = document.getElementById("goods-input_rate").value;
            const rawOutputRate = document.getElementById("goods-output_rate").value;
            const rawFairValue = document.getElementById("goods-fair_value").value;
            const rawRefundBef = document.getElementById("goods-refund_bef_rec").value;
            const rawRefundIng = document.getElementById("goods-refund_ing_rec").value;
            const rawRefundAft = document.getElementById("goods-refund_aft_rec").value;

            // 格式化后的展示值
            let 商品数量 = that.numFmt(rawNum);
            let 采购金额 = that.money(rawPurchaseAmount);
            // 采购数量为数量类，应为纯数值而非货币
            let 采购数量 = that.numFmt(rawPurchaseQuantity);
            let 含税成本 = that.money(rawCostWithTax);
            let 不含税成本 = that.money(rawCostNoTax);
            let 进项税率 = that.pctFmt(rawInputRate);
            let 销项税率 = that.pctFmt((rawOutputRate === undefined || rawOutputRate === null || rawOutputRate === '') ? rawInputRate : rawOutputRate);
            let 公允价值 = that.money(rawFairValue);
            let 售前回收 = that.pctFmt(rawRefundBef);
            let 售中回收 = that.pctFmt(rawRefundIng);
            let 售后回收 = that.pctFmt(rawRefundAft);

            if (this.editingRow === null) {
                this.goodsCounter++;
                //构建一行tr
                const newRow = document.createElement('tr');
                newRow.innerHTML =
                    `
                            <th scope="row" class="text-center">${this.goodsCounter}</th>
                            <td class="fw-semibold item-name">${商品名称}</td>
                            <td class="text-end">${商品数量}</td>
                            <td class="text-end">${采购金额}</td>
                            <td class="text-end">${采购数量}</td>                            
                            <td class="text-end">${含税成本}</td>
                            <td class="text-end">${不含税成本}</td>
                            <td class="text-end">${公允价值}</td>
                            <td class="text-center">${进项税率}</td>
                            <td class="text-center">${销项税率}</td>
                            <td class="text-center">${售前回收}</td>
                            <td class="text-center">${售中回收}</td>
                            <td class="text-center">${售后回收}</td>
                            <td class="text-center">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary modify">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-outline-danger remove">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </td>              
                        `
                const tbody = document.getElementById('goodsContainer');

                //添加事件监听（传入页面管理实例 that）
                newRow.querySelector('.modify').addEventListener('click', (e) => {
                    this.modifyRow(e, that);
                });
                newRow.querySelector('.remove').addEventListener('click', (e) => {
                    this.removeRow(e, that);
                });

                tbody.appendChild(newRow);
            } else {
                const cells = this.editingRow.querySelectorAll('td');
                cells[0].textContent = 商品名称;
                cells[1].textContent = 商品数量;
                cells[2].textContent = 采购金额;
                cells[3].textContent = 采购数量;
                cells[4].textContent = 含税成本;
                cells[5].textContent = 不含税成本;
                cells[6].textContent = 公允价值;
                cells[7].textContent = 进项税率;
                cells[8].textContent = 销项税率;
                cells[9].textContent = 售前回收;
                cells[10].textContent = 售中回收;
                cells[11].textContent = 售后回收;
            }

            //关闭模态窗
            that.#modals["paramsModal_Goods"].hide();
        },
        modifyRow: function (e, that) {
            this.editingRow = e.target.closest('tr');
            const tds = e.target.closest('tr').querySelectorAll('td');;
            document.getElementById("goods-name").value = tds[0].textContent;
            document.getElementById("goods-num").value = tds[1].textContent;
            document.getElementById("goods-purchase_amount").value = that.#sanitizeNumberString(tds[2].textContent);
            document.getElementById("goods-purchase_quantity").value = that.#sanitizeNumberString(tds[3].textContent);
            document.getElementById("goods-cost_withtax").value = that.#sanitizeNumberString(tds[4].textContent);
            document.getElementById("goods-cost_notax").value = that.#sanitizeNumberString(tds[5].textContent);
            document.getElementById("goods-fair_value").value = that.#sanitizeNumberString(tds[6].textContent);
            document.getElementById("goods-input_rate").value = that.#sanitizeNumberString(tds[7].textContent);
            document.getElementById("goods-output_rate").value = that.#sanitizeNumberString(tds[8].textContent);
            document.getElementById("goods-refund_bef_rec").value = that.#sanitizeNumberString(tds[9].textContent);
            document.getElementById("goods-refund_ing_rec").value = that.#sanitizeNumberString(tds[10].textContent);
            document.getElementById("goods-refund_aft_rec").value = that.#sanitizeNumberString(tds[11].textContent);

            that.#modals["paramsModal_Goods"].show();
        },
        removeRow: function (e, that) {
            const tr = e.target.closest('tr');
            tr.remove();
            this.modifyTrNum(that);
        },
        modifyTrNum: function (that) {
            // 重新计算序号并更新计数器
            const rows = that.#elements.goodsContainer.querySelectorAll('tr');
            rows.forEach(function (row, index) {
                row.querySelector('th').textContent = index + 1;
            });
            // 更新总行数
            this.goodsCounter = rows.length;
        },
        loadParams: function (data, owner) {
            // 直接将数组项写入表格，移除全局计数器与复杂处理
            const tbody = owner.#elements.goodsContainer;
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!Array.isArray(data)) return;

            for (const [index, item] of data.entries()) {
                if (!item) continue;

                const name = item.name || '';
                if (!name || String(name).trim() === '') continue;

                // 直接读取属性并格式化
                const quantity = (item.quantity.toLocaleString() ?? 1);
                const purchaseAmount = (item.purchaseAmount.options.prefix + item.purchaseAmount.toLocaleFixed() ?? 0);
                const purchaseQuantity = (item.purchaseQuantity.toLocaleString() + item.purchaseQuantity.options.suffix ?? 0);
                const valueIncTax = (item.valueExcTax.options.prefix + item.valueIncTax.toLocaleFixed() ?? 0);
                const valueExcTax = (item.valueExcTax.options.prefix + item.valueExcTax.toLocaleFixed() ?? 0);
                const fairValue = (item.fairValue.options.prefix + item.fairValue.toLocaleFixed() ?? 0);

                const inputRate = (item.inputRate.toPercentString(2) ?? '');
                const outputRate = (item.outputRate.toPercentString(2) ?? '');
                const refundBefRec = (item.refundBefRec.toPercentString(2) ?? '');
                const refundIngRec = (item.refundIngRec.toPercentString(2) ?? '');
                const refundAftRec = (item.refundAftRec.toPercentString(2) ?? '');

                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <th scope="row" class="text-center">${index + 1}</th>
                        <td class="fw-semibold item-name">${name}</td>
                        <td class="text-end">${quantity}</td>
                        <td class="text-end">${purchaseAmount}</td>
                        <td class="text-end">${purchaseQuantity}</td>
                        <td class="text-end">${valueIncTax}</td>
                        <td class="text-end">${valueExcTax}</td>
                        <td class="text-end">${fairValue}</td>
                        <td class="text-center">${inputRate}</td>
                        <td class="text-center">${outputRate}</td>
                        <td class="text-center">${refundBefRec}</td>
                        <td class="text-center">${refundIngRec}</td>
                        <td class="text-center">${refundAftRec}</td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary modify"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-outline-danger remove"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                `;

                newRow.querySelector('.modify')?.addEventListener('click', (e) => { this.modifyRow(e, owner); });
                newRow.querySelector('.remove')?.addEventListener('click', (e) => { this.removeRow(e, owner); });

                tbody.appendChild(newRow);
            }

            // 更新 goodsCounter，保证后续 addRow 使用正确的序号
            try {
                this.goodsCounter = tbody.querySelectorAll('tr').length;
            } catch (err) {
                // 保守回退：若查询失败不影响主流程
                this.goodsCounter = data.length || 0;
            }
        },
    }

    Gift = {
        editingRow: null,
        giftCounter: 0,
        addRow: function (that) {
            //获取数据
            let 礼品名称 = document.getElementById("gift-name").value;
            if (!礼品名称 || 礼品名称.trim() === '') { that.#showToast.error("礼品名称不能为空"); return; }
            // 原始输入
            const rawNum = document.getElementById("gift-num").value;
            const rawPurchaseAmount = document.getElementById("gift-purchase_amount").value;
            const rawPurchaseQuantity = document.getElementById("gift-purchase_quantity").value;
            const rawCostWithTax = document.getElementById("gift-cost_withtax").value;
            const rawCostNoTax = document.getElementById("gift-cost_notax").value;
            const rawInputRate = document.getElementById("gift-input_rate").value;
            const rawOutputRate = document.getElementById("gift-output_rate").value;
            const rawFairValue = document.getElementById("gift-fair_value").value;
            const rawRefundBef = document.getElementById("gift-refund_bef_rec").value;
            const rawRefundIng = document.getElementById("gift-refund_ing_rec").value;
            const rawRefundAft = document.getElementById("gift-refund_aft_rec").value;
            const rawSubjectType = document.getElementById("gift-deemedSale").checked ? "视同销售" : "销售费用";

            // 格式化后的展示值
            let 礼品数量 = that.numFmt(rawNum);
            let 采购金额 = that.money(rawPurchaseAmount);
            // 采购数量为数量类，应为纯数值而非货币
            let 采购数量 = that.numFmt(rawPurchaseQuantity);
            let 含税成本 = that.money(rawCostWithTax);
            let 不含税成本 = that.money(rawCostNoTax);
            let 进项税率 = that.pctFmt(rawInputRate);
            let 销项税率 = that.pctFmt((rawOutputRate === undefined || rawOutputRate === null || rawOutputRate === '') ? rawInputRate : rawOutputRate);
            let 公允价值 = that.money(rawFairValue);
            let 售前回收 = that.pctFmt(rawRefundBef);
            let 售中回收 = that.pctFmt(rawRefundIng);
            let 售后回收 = that.pctFmt(rawRefundAft);
            let 科目类型 = rawSubjectType;

            const subjectColor = 科目类型 === "视同销售" ? 'text-danger' : 'text-success';

            if (this.editingRow === null) {
                this.giftCounter++;
                //构建一行tr
                const newRow = document.createElement('tr');
                newRow.innerHTML =
                    `
                            <th scope="row" class="text-center">${this.giftCounter}</th>
                            <td class="fw-semibold item-name">${礼品名称}</td>
                            <td class="text-end">${礼品数量}</td>
                            <td class="text-end">${采购金额}</td>
                            <td class="text-end">${采购数量}</td>                            
                            <td class="text-end">${含税成本}</td>
                            <td class="text-end">${不含税成本}</td>
                            <td class="text-end">${公允价值}</td>
                            <td class="text-center">${进项税率}</td>
                            <td class="text-center">${销项税率}</td>
                            <td class="text-center">${售前回收}</td>
                            <td class="text-center">${售中回收}</td>
                            <td class="text-center">${售后回收}</td>
                            <td class="text-center fw-semibold ${subjectColor}">${科目类型}</td>
                            <td class="text-center">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary modify">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-outline-danger remove">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </td>              
                        `
                const tbody = document.getElementById('giftContainer');

                //添加事件监听（传入页面管理实例 that）
                newRow.querySelector('.modify').addEventListener('click', (e) => {
                    this.modifyRow(e, that);
                });
                newRow.querySelector('.remove').addEventListener('click', (e) => {
                    this.removeRow(e, that);
                });

                tbody.appendChild(newRow);
            } else {
                const cells = this.editingRow.querySelectorAll('td');
                cells[0].textContent = 礼品名称;
                cells[1].textContent = 礼品数量;
                cells[2].textContent = 采购金额;
                cells[3].textContent = 采购数量;
                cells[4].textContent = 含税成本;
                cells[5].textContent = 不含税成本;
                cells[6].textContent = 公允价值;
                cells[7].textContent = 进项税率;
                cells[8].textContent = 销项税率;
                cells[9].textContent = 售前回收;
                cells[10].textContent = 售中回收;
                cells[11].textContent = 售后回收;
                cells[12].textContent = 科目类型;
                if (科目类型 === "视同销售") {
                    cells[12].classList.remove('text-success');
                    cells[12].classList.add('text-danger');
                } else {
                    cells[12].classList.remove('text-danger');
                    cells[12].classList.add('text-success');
                }
            }

            //关闭模态窗
            that.#modals["paramsModal_Gift"].hide();
        },
        modifyRow: function (e, that) {
            this.editingRow = e.target.closest('tr');
            const tds = e.target.closest('tr').querySelectorAll('td');;
            document.getElementById("gift-name").value = tds[0].textContent;
            document.getElementById("gift-num").value = tds[1].textContent;
            document.getElementById("gift-purchase_amount").value = that.#sanitizeNumberString(tds[2].textContent);
            document.getElementById("gift-purchase_quantity").value = that.#sanitizeNumberString(tds[3].textContent);
            document.getElementById("gift-cost_withtax").value = that.#sanitizeNumberString(tds[4].textContent);
            document.getElementById("gift-cost_notax").value = that.#sanitizeNumberString(tds[5].textContent);
            document.getElementById("gift-fair_value").value = that.#sanitizeNumberString(tds[6].textContent);
            document.getElementById("gift-input_rate").value = that.#sanitizeNumberString(tds[7].textContent);
            document.getElementById("gift-output_rate").value = that.#sanitizeNumberString(tds[8].textContent);
            document.getElementById("gift-refund_bef_rec").value = that.#sanitizeNumberString(tds[9].textContent);
            document.getElementById("gift-refund_ing_rec").value = that.#sanitizeNumberString(tds[10].textContent);
            document.getElementById("gift-refund_aft_rec").value = that.#sanitizeNumberString(tds[11].textContent);
            document.getElementById("gift-deemedSale").checked = (tds[12].textContent === "视同销售");
            that.#modals["paramsModal_Gift"].show();
        },
        removeRow: function (e, that) {
            const tr = e.target.closest('tr');
            tr.remove();
            this.modifyTrNum(that);
        },
        modifyTrNum: function (that) {
            // 重新计算序号并更新计数器
            const rows = that.#elements.giftContainer.querySelectorAll('tr');
            rows.forEach(function (row, index) {
                row.querySelector('th').textContent = index + 1;
            });
            // 更新总行数
            this.giftCounter = rows.length;
        },
        loadParams: function (data, owner) {
            // 直接将数组项写入表格，移除全局计数器与复杂处理
            const tbody = owner.#elements.giftContainer;
            if (!tbody) return;
            tbody.innerHTML = '';
            if (!Array.isArray(data)) return;

            for (const [index, item] of data.entries()) {
                if (!item) continue;
                const name = item.name || '';
                if (!name || String(name).trim() === '') continue;
                // 直接读取属性并格式化
                // 直接读取属性并格式化
                const quantity = (item.quantity.toLocaleString() ?? 1);
                const purchaseAmount = (item.purchaseAmount.options.prefix + item.purchaseAmount.toLocaleFixed() ?? 0);
                const purchaseQuantity = (item.purchaseQuantity.toLocaleString() + item.purchaseQuantity.options.suffix ?? 0);
                const valueIncTax = (item.valueExcTax.options.prefix + item.valueIncTax.toLocaleFixed() ?? 0);
                const valueExcTax = (item.valueExcTax.options.prefix + item.valueExcTax.toLocaleFixed() ?? 0);
                const fairValue = (item.fairValue.options.prefix + item.fairValue.toLocaleFixed() ?? 0);

                const inputRate = (item.inputRate.toPercentString(2) ?? '');
                const outputRate = (item.outputRate.toPercentString(2) ?? '');
                const refundBefRec = (item.refundBefRec.toPercentString(2) ?? '');
                const refundIngRec = (item.refundIngRec.toPercentString(2) ?? '');
                const refundAftRec = (item.refundAftRec.toPercentString(2) ?? '');
                const subjectType = item.subjectType || '销售费用';

                const subjectColor = subjectType === "视同销售" ? 'text-danger' : 'text-success';

                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <th scope="row" class="text-center">${index + 1}</th>
                        <td class="fw-semibold item-name">${name}</td>
                        <td class="text-end">${quantity}</td>
                        <td class="text-end">${purchaseAmount}</td>
                        <td class="text-end">${purchaseQuantity}</td>
                        <td class="text-end">${valueIncTax}</td>
                        <td class="text-end">${valueExcTax}</td>
                        <td class="text-end">${fairValue}</td>
                        <td class="text-center">${inputRate}</td>
                        <td class="text-center">${outputRate}</td>
                        <td class="text-center">${refundBefRec}</td>
                        <td class="text-center">${refundIngRec}</td>
                        <td class="text-center">${refundAftRec}</td>
                        <td class="text-center fw-semibold ${subjectColor}">${subjectType}</td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary modify"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-outline-danger remove"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                `;
                newRow.querySelector('.modify')?.addEventListener('click', (e) => { this.modifyRow(e, owner); });
                newRow.querySelector('.remove')?.addEventListener('click', (e) => { this.removeRow(e, owner); });
                tbody.appendChild(newRow);
            }
            // 更新 giftCounter，保证后续 addRow 使用正确的序号
            try {
                this.giftCounter = tbody.querySelectorAll('tr').length;
            } catch (err) {
                // 保守回退：若查询失败不影响主流程
                this.giftCounter = data.length || 0;
            }
        },
    }

    Expense_PerOrder = {
        editingRow: null,
        expenseCounter: 0,
        setSelectValue: null,
        initSelectOptions: function (that) {
            const selectElement = document.getElementById("expensePerOrder-base");
            let options = [];
            // 获取商品名称列表：遍历每个 tr，优先取 `td.item-name`（商品名列），
            // 若不存在则尝试第二个单元格（children[1]），最后过滤空值并去重
            const rows = Array.from(that.#elements.goodsContainer.querySelectorAll('tr'));
            // 单次遍历收集并直接添加前缀，避免多次分配临时数组
            const goodsNamesSet = new Set();
            for (const row of rows) {
                const nameCell = row.querySelector('td.item-name') || row.querySelectorAll('td')[0] || row.children[1];
                const txt = nameCell ? String(nameCell.textContent || '').trim() : '';
                if (txt) goodsNamesSet.add('商品：' + txt);
            }
            options = ["-", "售价", ...goodsNamesSet];
            // 清空现有选项
            selectElement.innerHTML = '';
            // 添加新选项
            options.forEach(optionText => {
                const option = document.createElement('option');
                option.value = optionText;
                option.textContent = optionText;
                selectElement.appendChild(option);
            });
            // 设置默认选中值为 "-"
            selectElement.value = "-";
            // 如果this.setSelectValue不为null，则设置为该值
            if (this.setSelectValue !== null) {
                selectElement.value = this.setSelectValue;
                this.setSelectValue = null; // 重置为null，避免影响下次调用
            }
        },
        addRow: function (that) {
            //获取数据
            let 费用名称 = document.getElementById("expensePerOrder-name").value;
            if (!费用名称 || 费用名称.trim() === '') { that.#showToast.error("费用名称不能为空"); return; }
            // 原始输入
            const rawCost = document.getElementById("expensePerOrder-value").value;
            const rawInputRate = document.getElementById("expensePerOrder-input_rate").value;
            const rawCostType = document.getElementById("expensePerOrder-cost_type_money").checked;
            const rawBase = document.getElementById("expensePerOrder-base").value;
            const rawBaseTax = document.getElementById("expensePerOrder-with_tax").checked;
            const rawRefundBefRec = document.getElementById("expensePerOrder-refund_bef_rec").value;
            const rawRefundIngRec = document.getElementById("expensePerOrder-refund_ing_rec").value;
            const rawRefundAftRec = document.getElementById("expensePerOrder-refund_aft_rec").value;

            // 格式化后的展示值
            let 费用金额 = rawCostType ? that.money(rawCost) : that.pctFmt(rawCost);
            let 进项税率 = that.pctFmt(rawInputRate);
            let 计费类型 = rawCostType ? "num" : "per";
            let 计费基数 = 计费类型 === "num" ? "-" : rawBase; // 固定金额时强制为 "-"
            let 计费基数含税 = 计费类型 === "num" ? false : rawBaseTax ? true : false;
            let 售前回收 = that.pctFmt(rawRefundBefRec);
            let 售中回收 = that.pctFmt(rawRefundIngRec);
            let 售后回收 = that.pctFmt(rawRefundAftRec);

            if (this.editingRow === null) {
                this.expenseCounter++;
                //构建一行tr
                const newRow = document.createElement('tr');
                newRow.innerHTML =
                    `
                            <th scope="row" class="text-center">${this.expenseCounter}</th>
                            <td class="fw-semibold item-name">${费用名称}</td>
                            <td class="text-end">${费用金额}</td>
                            <td class="text-center">${进项税率}</td>
                            <td class="text-center">${计费类型 === "num" ? "固定金额" : "指定比例"}</td>
                            <td class="text-end">${计费基数}</td>
                            <td class="text-center">${计费类型 === "num" ? "-" : 计费基数含税 ? "含税" : "不含税"}</td>
                            <td class="text-center">${售前回收}</td>
                            <td class="text-center">${售中回收}</td>
                            <td class="text-center">${售后回收}</td>
                            <td class="text-center">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary modify">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-outline-danger remove">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </td>              
                        `
                const tbody = document.getElementById('expensePerOrderContainer');
                //添加事件监听（传入页面管理实例 that）
                newRow.querySelector('.modify').addEventListener('click', (e) => {
                    this.modifyRow(e, that);
                });
                newRow.querySelector('.remove').addEventListener('click', (e) => {
                    this.removeRow(e, that);
                });

                tbody.appendChild(newRow);
            } else {
                const cells = this.editingRow.querySelectorAll('td');
                cells[0].textContent = 费用名称;
                cells[1].textContent = 费用金额;
                cells[2].textContent = 进项税率;
                cells[3].textContent = 计费类型 === "num" ? "固定金额" : "指定比例";
                cells[4].textContent = 计费基数;
                cells[5].textContent = 计费类型 === "num" ? "-" : 计费基数含税 ? "含税" : "不含税";
                cells[6].textContent = 售前回收;
                cells[7].textContent = 售中回收;
                cells[8].textContent = 售后回收;
            }
            //关闭模态窗
            that.#modals["paramsModal_ExpensePerOrder"].hide();
        },
        modifyRow: function (e, that) {
            this.editingRow = e.target.closest('tr');
            const tds = e.target.closest('tr').querySelectorAll('td');
            document.getElementById("expensePerOrder-name").value = tds[0].textContent;
            document.getElementById("expensePerOrder-value").value = that.#sanitizeNumberString(tds[1].textContent);
            document.getElementById("expensePerOrder-input_rate").value = that.#sanitizeNumberString(tds[2].textContent);
            document.getElementById("expensePerOrder-cost_type_money").checked = (tds[3].textContent === "固定金额");
            document.getElementById("expensePerOrder-cost_type_percent").checked = (tds[3].textContent === "指定比例");
            document.getElementById("expensePerOrder-base").value = that.#sanitizeNumberString(tds[4].textContent);
            this.setSelectValue = tds[4].textContent;
            document.getElementById("expensePerOrder-with_tax").checked = (tds[5].textContent === "含税");
            document.getElementById("expensePerOrder-no_tax").checked = (tds[5].textContent === "不含税");
            document.getElementById("expensePerOrder-refund_bef_rec").value = that.#sanitizeNumberString(tds[6].textContent);
            document.getElementById("expensePerOrder-refund_ing_rec").value = that.#sanitizeNumberString(tds[7].textContent);
            document.getElementById("expensePerOrder-refund_aft_rec").value = that.#sanitizeNumberString(tds[8].textContent);
            that.#modals["paramsModal_ExpensePerOrder"].show();
        },
        removeRow: function (e, that) {
            const tr = e.target.closest('tr');
            tr.remove();
            this.modifyTrNum(that);
        },
        modifyTrNum: function (that) {
            // 重新计算序号并更新计数器
            const rows = that.#elements.expensePerOrderContainer.querySelectorAll('tr');
            rows.forEach(function (row, index) {
                row.querySelector('th').textContent = index + 1;
            });
            // 更新总行数
            this.expenseCounter = rows.length;
        },
        loadParams: function (data, owner) {
            // 直接将数组项写入表格，移除全局计数器与复杂处理
            const tbody = owner.#elements.expensePerOrderContainer;
            if (!tbody) return;
            tbody.innerHTML = '';
            if (!Array.isArray(data)) return;
            for (const [index, item] of data.entries()) {
                if (!item) continue;
                const name = item.name || '';
                if (!name || String(name).trim() === '') continue;
                // 直接读取属性并格式化
                const value = item.valueType === 'num' ? (item.valueMoney.options.prefix + item.valueMoney.toLocaleFixed() ?? 0) : (item.valuePercentage.toPercentString(2) ?? '');
                const inputRate = (item.inputRate.toPercentString(2) ?? '');
                const valueType = item.valueType || 'num';
                const base = item.base || '-';
                const baseHaveTax = item.baseHaveTax ? true : false;
                const refundBefRec = (item.refundBefRec.toPercentString(2) ?? '');
                const refundIngRec = (item.refundIngRec.toPercentString(2) ?? '');
                const refundAftRec = (item.refundAftRec.toPercentString(2) ?? '');
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <th scope="row" class="text-center">${index + 1}</th>
                        <td class="fw-semibold item-name">${name}</td>
                        <td class="text-end">${value}</td>
                        <td class="text-center">${inputRate}</td>
                        <td class="text-center">${valueType === 'num' ? '固定金额' : '指定比例'}</td>
                        <td class="text-end">${base}</td>
                        <td class="text-center">${valueType === "num" ? "-" : baseHaveTax ? '含税' : '不含税'}</td>
                        <td class="text-center">${refundBefRec}</td>
                        <td class="text-center">${refundIngRec}</td>
                        <td class="text-center">${refundAftRec}</td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary modify"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-outline-danger remove"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                `;
                newRow.querySelector('.modify')?.addEventListener('click', (e) => { this.modifyRow(e, owner); });
                newRow.querySelector('.remove')?.addEventListener('click', (e) => { this.removeRow(e, owner); });
                tbody.appendChild(newRow);
            }
            // 更新 expenseCounter，保证后续 addRow 使用正确的序号
            try {
                this.expenseCounter = tbody.querySelectorAll('tr').length;
            } catch (err) {
                // 保守回退：若查询失败不影响主流程
                this.expenseCounter = data.length || 0;
            }
        },
    }

    Expense_MNPerOrder = {
        editingRow: null,
        expenseCounter: 0,
        setSelectValue: null,
        initSelectOptions: function (that) {
            const selectElement = document.getElementById("expenseMNPerOrder-base");
            let options = [];
            // 获取商品名称列表：遍历每个 tr，优先取 `td.item-name`（商品名列），
            // 若不存在则尝试第二个单元格（children[1]），最后过滤空值并去重
            const rows = Array.from(that.#elements.goodsContainer.querySelectorAll('tr'));
            // 单次遍历收集并直接添加前缀，避免多次分配临时数组
            const goodsNamesSet = new Set();
            for (const row of rows) {
                const nameCell = row.querySelector('td.item-name') || row.querySelectorAll('td')[0] || row.children[1];
                const txt = nameCell ? String(nameCell.textContent || '').trim() : '';
                if (txt) goodsNamesSet.add('商品：' + txt);
            }
            options = ["-", "售价", ...goodsNamesSet];
            // 清空现有选项
            selectElement.innerHTML = '';
            // 添加新选项
            options.forEach(optionText => {
                const option = document.createElement('option');
                option.value = optionText;
                option.textContent = optionText;
                selectElement.appendChild(option);
            });
            // 设置默认选中值为 "-"
            selectElement.value = "-";
            // 如果this.setSelectValue不为null，则设置为该值
            if (this.setSelectValue !== null) {
                selectElement.value = this.setSelectValue;
                this.setSelectValue = null; // 重置为null，避免影响下次调用
            }
        },
        addRow: function (that) {
            //获取数据
            let 费用名称 = document.getElementById("expenseMNPerOrder-name").value;
            if (!费用名称 || 费用名称.trim() === '') { that.#showToast.error("费用名称不能为空"); return; }
            // 原始输入
            const rawOrderPer = document.getElementById("expenseMNPerOrder-order_per").value;
            const rawCost = document.getElementById("expenseMNPerOrder-value").value;
            const rawInputRate = document.getElementById("expenseMNPerOrder-input_rate").value;
            const rawCostType = document.getElementById("expenseMNPerOrder-cost_type_money").checked;

            const rawBase = document.getElementById("expenseMNPerOrder-base").value;
            const rawBaseTax = document.getElementById("expenseMNPerOrder-with_tax").checked;

            const rawRefundBefPer = document.getElementById("expenseMNPerOrder-refund_bef_per").value;
            const rawRefundIngPer = document.getElementById("expenseMNPerOrder-refund_ing_per").value;
            const rawRefundAftPer = document.getElementById("expenseMNPerOrder-refund_aft_per").value;
            const rawRefundBefRec = document.getElementById("expenseMNPerOrder-refund_bef_rec").value;
            const rawRefundIngRec = document.getElementById("expenseMNPerOrder-refund_ing_rec").value;
            const rawRefundAftRec = document.getElementById("expenseMNPerOrder-refund_aft_rec").value;

            // 格式化后的展示值
            let 每单费用比例 = that.pctFmt(rawOrderPer);
            let 费用金额 = rawCostType ? that.money(rawCost) : that.pctFmt(rawCost);
            let 进项税率 = that.pctFmt(rawInputRate);
            let 计费类型 = rawCostType ? "num" : "per";
            let 计费基数 = 计费类型 === "num" ? "-" : rawBase; // 固定金额时强制为 "-"
            let 计费基数含税 = 计费类型 === "num" ? false : rawBaseTax ? true : false;
            let 售前退款 = that.pctFmt(rawRefundBefPer);
            let 售中退款 = that.pctFmt(rawRefundIngPer);
            let 售后退款 = that.pctFmt(rawRefundAftPer);
            let 售前回收 = that.pctFmt(rawRefundBefRec);
            let 售中回收 = that.pctFmt(rawRefundIngRec);
            let 售后回收 = that.pctFmt(rawRefundAftRec);

            if (this.editingRow === null) {
                this.expenseCounter++;
                //构建一行tr
                const newRow = document.createElement('tr');
                newRow.innerHTML =
                    `
                            <th scope="row" class="text-center">${this.expenseCounter}</th>
                            <td class="fw-semibold item-name">${费用名称}</td>
                            <td class="text-end">${每单费用比例}</td>
                            <td class="text-end">${费用金额}</td>
                            <td class="text-center">${进项税率}</td>
                            <td class="text-center">${计费类型 === "num" ? "固定金额" : "指定比例"}</td>
                            <td class="text-end">${计费基数}</td>
                            <td class="text-end">${计费类型 === "num" ? "-" : 计费基数含税 ? "含税" : "不含税"}</td>
                            <td class="text-end">${售前退款}</td>
                            <td class="text-end">${售中退款}</td>
                            <td class="text-end">${售后退款}</td>
                            <td class="text-end">${售前回收}</td>
                            <td class="text-end">${售中回收}</td>
                            <td class="text-end">${售后回收}</td>
                            <td class="text-center">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary modify">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-outline-danger remove">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </td>
                        `
                const tbody = document.getElementById('expenseMNPerOrderContainer');
                //添加事件监听（传入页面管理实例 that）
                newRow.querySelector('.modify').addEventListener('click', (e) => {
                    this.modifyRow(e, that);
                });
                newRow.querySelector('.remove').addEventListener('click', (e) => {
                    this.removeRow(e, that);
                });

                tbody.appendChild(newRow);
            } else {
                const cells = this.editingRow.querySelectorAll('td');
                cells[0].textContent = 费用名称;
                cells[1].textContent = 每单费用比例;
                cells[2].textContent = 费用金额;
                cells[3].textContent = 进项税率;
                cells[4].textContent = 计费类型 === "num" ? "固定金额" : "指定比例";
                cells[5].textContent = 计费基数;
                cells[6].textContent = 计费基数含税 ? "含税" : "不含税";
                cells[7].textContent = 售前退款;
                cells[8].textContent = 售中退款;
                cells[9].textContent = 售后退款;
                cells[10].textContent = 售前回收;
                cells[11].textContent = 售中回收;
                cells[12].textContent = 售后回收;
            }
            //关闭模态窗
            that.#modals["paramsModal_ExpenseMNPerOrder"].hide();
        },
        modifyRow: function (e, that) {
            this.editingRow = e.target.closest('tr');
            const tds = e.target.closest('tr').querySelectorAll('td');
            document.getElementById("expenseMNPerOrder-name").value = tds[0].textContent;
            document.getElementById("expenseMNPerOrder-order_per").value = that.#sanitizeNumberString(tds[1].textContent);
            document.getElementById("expenseMNPerOrder-value").value = that.#sanitizeNumberString(tds[2].textContent);
            document.getElementById("expenseMNPerOrder-input_rate").value = that.#sanitizeNumberString(tds[3].textContent);
            document.getElementById("expenseMNPerOrder-cost_type_money").checked = (tds[4].textContent === "固定金额");
            document.getElementById("expenseMNPerOrder-cost_type_percent").checked = (tds[4].textContent === "指定比例");
            document.getElementById("expenseMNPerOrder-base").value = that.#sanitizeNumberString(tds[5].textContent);
            this.setSelectValue = tds[5].textContent;
            document.getElementById("expenseMNPerOrder-with_tax").checked = (tds[6].textContent === "含税");
            document.getElementById("expenseMNPerOrder-no_tax").checked = (tds[6].textContent === "不含税");
            document.getElementById("expenseMNPerOrder-refund_bef_per").value = that.#sanitizeNumberString(tds[7].textContent);
            document.getElementById("expenseMNPerOrder-refund_ing_per").value = that.#sanitizeNumberString(tds[8].textContent);
            document.getElementById("expenseMNPerOrder-refund_aft_per").value = that.#sanitizeNumberString(tds[9].textContent);
            document.getElementById("expenseMNPerOrder-refund_bef_rec").value = that.#sanitizeNumberString(tds[10].textContent);
            document.getElementById("expenseMNPerOrder-refund_ing_rec").value = that.#sanitizeNumberString(tds[11].textContent);
            document.getElementById("expenseMNPerOrder-refund_aft_rec").value = that.#sanitizeNumberString(tds[12].textContent);
            that.#modals["paramsModal_ExpenseMNPerOrder"].show();
        },
        removeRow: function (e, that) {
            const tr = e.target.closest('tr');
            tr.remove();
            this.modifyTrNum(that);
        },
        modifyTrNum: function (that) {
            // 重新计算序号并更新计数器
            const rows = that.#elements.expenseMNPerOrderContainer.querySelectorAll('tr');
            rows.forEach(function (row, index) {
                row.querySelector('th').textContent = index + 1;
            });
            // 更新总行数
            this.expenseCounter = rows.length;
        },
        loadParams: function (data, owner) {
            // 直接将数组项写入表格，移除全局计数器与复杂处理
            const tbody = owner.#elements.expenseMNPerOrderContainer;
            if (!tbody) return;
            tbody.innerHTML = '';
            if (!Array.isArray(data)) return;
            for (const [index, item] of data.entries()) {
                if (!item) continue;
                const name = item.name || '';
                if (!name || String(name).trim() === '') continue;
                // 直接读取属性并格式化
                const orderPer = (item.orderPer.toPercentString(2) ?? '');
                const value = item.valueType === 'num' ? (item.valueMoney.options.prefix + item.valueMoney.toLocaleFixed() ?? 0) : (item.valuePercentage.toPercentString(2) ?? '');
                const inputRate = (item.inputRate.toPercentString(2) ?? '');
                const valueType = item.valueType || 'num';
                const base = item.base || '-';
                const baseHaveTax = item.baseHaveTax ? true : false;
                const refundBefRec = (item.refundBefRec.toPercentString(2) ?? '');
                const refundIngRec = (item.refundIngRec.toPercentString(2) ?? '');
                const refundAftRec = (item.refundAftRec.toPercentString(2) ?? '');
                const refundBefPer = (item.refundBefPer.toPercentString(2) ?? '');
                const refundIngPer = (item.refundIngPer.toPercentString(2) ?? '');
                const refundAftPer = (item.refundAftPer.toPercentString(2) ?? '');
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <th scope="row" class="text-center">${index + 1}</th>
                        <td class="fw-semibold item-name">${name}</td>
                        <td class="text-end">${orderPer}</td>
                        <td class="text-end">${value}</td>
                        <td class="text-center">${inputRate}</td>
                        <td class="text-center">${valueType === 'num' ? '固定金额' : '指定比例'}</td>
                        <td class="text-end">${base}</td>
                        <td class="text-end">${valueType === "num" ? "-" : baseHaveTax ? '含税' : '不含税'}</td>
                        <td class="text-end">${refundBefPer}</td>
                        <td class="text-end">${refundIngPer}</td>
                        <td class="text-end">${refundAftPer}</td>
                        <td class="text-end">${refundBefRec}</td>
                        <td class="text-end">${refundIngRec}</td>
                        <td class="text-end">${refundAftRec}</td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary modify"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-outline-danger remove"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                `;
                newRow.querySelector('.modify')?.addEventListener('click', (e) => { this.modifyRow(e, owner); });
                newRow.querySelector('.remove')?.addEventListener('click', (e) => { this.removeRow(e, owner); });
                tbody.appendChild(newRow);
            }
            // 更新 expenseCounter，保证后续 addRow 使用正确的序号
            try {
                this.expenseCounter = tbody.querySelectorAll('tr').length;
            } catch (err) {
                // 保守回退：若查询失败不影响主流程
                this.expenseCounter = data.length || 0;
            }
        },
    }

    Expense_Fixed = {
        editingRow: null,
        expenseCounter: 0,
        addRow: function (that) {
            //获取数据
            let 费用名称 = document.getElementById("expenseFixed-name").value;
            if (!费用名称 || 费用名称.trim() === '') { that.#showToast.error("费用名称不能为空"); return; }
            // 原始输入
            const rawCost = document.getElementById("expenseFixed-value").value;
            const rawInputRate = document.getElementById("expenseFixed-input_rate").value;
            // 格式化后的展示值
            let 费用金额 = that.money(rawCost);
            let 进项税率 = that.pctFmt(rawInputRate);
            if (this.editingRow === null) {
                this.expenseCounter++;
                //构建一行tr    
                const newRow = document.createElement('tr');
                newRow.innerHTML =
                    `
                            <th scope="row" class="text-center">${this.expenseCounter}</th>
                            <td class="fw-semibold item-name">${费用名称}</td>
                            <td class="text-center">${费用金额}</td>
                            <td class="text-center">${进项税率}</td>
                            <td class="text-center">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary modify">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-outline-danger remove">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </td>
                        `
                const tbody = document.getElementById('expenseFixedContainer');
                //添加事件监听（传入页面管理实例 that）
                newRow.querySelector('.modify').addEventListener('click', (e) => {
                    this.modifyRow(e, that);
                });
                newRow.querySelector('.remove').addEventListener('click', (e) => {
                    this.removeRow(e, that);
                }
                );

                tbody.appendChild(newRow);
            } else {
                const cells = this.editingRow.querySelectorAll('td');
                cells[0].textContent = 费用名称;
                cells[1].textContent = 费用金额;
                cells[2].textContent = 进项税率;
            }
            //关闭模态窗
            that.#modals["paramsModal_ExpenseFixed"].hide();
        },
        modifyRow: function (e, that) {
            this.editingRow = e.target.closest('tr');
            const tds = e.target.closest('tr').querySelectorAll('td');
            document.getElementById("expenseFixed-name").value = tds[0].textContent;
            document.getElementById("expenseFixed-value").value = that.#sanitizeNumberString(tds[1].textContent);
            document.getElementById("expenseFixed-input_rate").value = that.#sanitizeNumberString(tds[2].textContent);
            that.#modals["paramsModal_ExpenseFixed"].show();
        },
        removeRow: function (e, that) {
            const tr = e.target.closest('tr');
            tr.remove();
            this.modifyTrNum(that);
        },
        modifyTrNum: function (that) {
            // 重新计算序号并更新计数器
            const rows = that.#elements.expenseFixedContainer.querySelectorAll('tr');
            rows.forEach(function (row, index) {
                row.querySelector('th').textContent = index + 1;
            });
            // 更新总行数
            this.expenseCounter = rows.length;
        },
        loadParams: function (data, owner) {
            // 直接将数组项写入表格，移除全局计数器与复杂处理
            const tbody = owner.#elements.expenseFixedContainer;
            if (!tbody) return;
            tbody.innerHTML = '';
            if (!Array.isArray(data)) return;
            for (const [index, item] of data.entries()) {
                if (!item) continue;
                const name = item.name || '';
                if (!name || String(name).trim() === '') continue;
                // 直接读取属性并格式化
                const value = (item.value.options.prefix + item.value.toLocaleFixed() ?? 0);
                const inputRate = (item.inputRate.toPercentString(2) ?? '');
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <th scope="row" class="text-center">${index + 1}</th>
                        <td class="fw-semibold item-name">${name}</td>
                        <td class="text-center">${value}</td>
                        <td class="text-center">${inputRate}</td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary modify"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-outline-danger remove"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                `;
                newRow.querySelector('.modify')?.addEventListener('click', (e) => { this.modifyRow(e, owner); });
                newRow.querySelector('.remove')?.addEventListener('click', (e) => { this.removeRow(e, owner); });
                tbody.appendChild(newRow);
            }
            // 更新 expenseCounter，保证后续 addRow 使用正确的序号
            try {
                this.expenseCounter = tbody.querySelectorAll('tr').length;
            } catch (err) {
                // 保守回退：若查询失败不影响主流程
                this.expenseCounter = data.length || 0;
            }
        }
    }

}

// 页面加载完成后初始化工作台
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // 创建并初始化工作台
        const planParams = new PlanParamsManager();
        await planParams.initialize();

        // 将实例暴露到全局，方便调试
        window.planParams = planParams;
    } catch (error) {
        console.error('Failed to initialize planParams:', error);
        alert('方案参数页面初始化失败，请刷新页面重试-2');
    }
});
