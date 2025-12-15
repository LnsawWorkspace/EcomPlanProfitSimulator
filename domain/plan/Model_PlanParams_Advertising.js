import Decimal from '../../infrastructure/decimal.mjs';
import ValidateUtils from '../../infrastructure/ValidateUtils.js';
import Percentage from '../../infrastructure/Percentage.js';

// ==================== AdvertisingInfo ====================
/**
 * 广告配置模型
 *
 * 描述：封装单个广告策略的参数（ROI、税率、各阶段退款回收比例等），
 * 内部使用 `Decimal` 存储数值以保证计算精度。所有对外接口接受 `number|string|Decimal`。
 *
 * 约定：
 * - `roi` 含义为 销售额 / 广告成本，`0` 表示无效或未设置的广告（需在上层逻辑判断）
 * - `rate` / `inputRate` 以小数形式表示（例如 0.06 表示 6%）。构造器/设置器会强制范围为 [0, 1]，不在内部做百分比到小数的自动转换，转换应由调用方负责。
 *
 * 使用示例：
 * const dto = { name: '投放A', roi: '2.5', rate: 0.06, refund_bef_rec: 0.2 };
 * const ad = new Model_PlanParams_Advertising(dto);
 *
 * 注意：本模型负责参数解析与边界校验，但不承担业务层面的策略有效性判断（例如：roi === 0 时是否应跳过）。
 *
 * @class Model_PlanParams_Advertising
 */
export class Model_PlanParams_Advertising {
    #name;               // 广告标题
    #roi;                 // 广告ROI（Decimal类型）
    #inputRate;           // 税率（Decimal类型，如6代表6%）
    #refundBefRec;        // 售前退款回收比例（Decimal类型）
    #refundIngRec;        // 售中退款回收比例（Decimal类型）
    #refundAftRec;        // 售后退款回收比例（Decimal类型）

    /**
     * 广告配置构造函数
     * @param {Object} dto - 广告配置参数对象
     * @param {string} dto.name - 广告标题（必填）
     * @param {number|string|Decimal} [dto.roi=0] - 广告ROI（roi=销售额/广告成本，0表示无效广告）
     * @param {number|string|Decimal} [dto.inputRate=0.06] - 税率（小数形式，默认 0.06 表示 6%）
     * @param {number|string|Decimal} [dto.refundBefRec=0] - 售前退款回收比例（小数形式 0-1）
     * @param {number|string|Decimal} [dto.refundIngRec=0] - 售中退款回收比例（小数形式 0-1）
     * @param {number|string|Decimal} [dto.refundAftRec=0] - 售后退款回收比例（小数形式 0-1）
     */
    constructor(dto = {}) {
        // 校验并设置标题（必填）
        this.#name = ValidateUtils.stringNotEmptyAndWhitespace(dto.name);
        // 初始化 ROI、税率、退款回收比例（统一转为 Decimal 类型以便后续高精度计算）
        // 注意：ValidateUtil 的 helper 方法会对输入类型进行兼容解析（number|string|Decimal）并且做范围校验
        // ROI 使用 Decimal 非负校验
        this.#roi = ValidateUtils.decimal(dto.roi ?? 0, { allowNegative: false });
        // rate 的默认值在此处使用 0.06（代表 6%），范围限定为 [0,1]
        // 注意：此处仅接受小数形式（0-1），例如 0.06 表示 6%；若外部以百分比整数传入（例如 6），请在外部先转换为 0.06

        this.#inputRate = new Percentage(dto.inputRate ?? 0.06, { min: 0, max: 1 });
        this.#refundBefRec = new Percentage(dto.refundBefRec ?? 0, { min: 0, max: 1 });
        this.#refundIngRec = new Percentage(dto.refundIngRec ?? 0, { min: 0, max: 1 });
        this.#refundAftRec = new Percentage(dto.refundAftRec ?? 0, { min: 0, max: 1 });
    }

    static parse(dto) {
        return new Model_PlanParams_Advertising({
            name: dto.name,
            roi: dto.roi,
            inputRate: dto.inputRate.value,
            refundBefRec: dto.refundBefRec.value,
            refundIngRec: dto.refundIngRec.value,
            refundAftRec: dto.refundAftRec.value,
        });
    }
    // Getters
    /** 广告标题（string） */
    get name() { return this.#name; }
    /** 广告 ROI（Decimal） — 推荐通过 `.toString()` 或 `toNumber()` 获取展示值。 */
    get roi() { return this.#roi; }
    /** 税率（Decimal，0.06 表示 6%） */
    get inputRate() { return this.#inputRate; }
    /** 售前退款回收比例（Decimal，范围 0-1） */
    get refundBefRec() { return this.#refundBefRec; }
    /** 售中退款回收比例（Decimal，范围 0-1） */
    get refundIngRec() { return this.#refundIngRec; }
    /** 售后退款回收比例（Decimal，范围 0-1） */
    get refundAftRec() { return this.#refundAftRec; }

    // Setters
    set roi(roi) {
        /**
         * 设置 ROI
         * @param {number|string|Decimal} roi
         */
        this.#roi = ValidateUtils.decimal(roi, { allowNegative: false });
    }

    set inputRate(rate) {
        /**
         * 设置税率（仅接受小数形式 0-1，例如 0.06 表示 6%；不会自动把 6 转为 0.06）
         * @param {number|string|Decimal} rate 小数形式的税率，范围 [0,1]
         */
        this.#inputRate = ValidateUtils.decimalRange(rate, { min: 0, max: 1, decimal: true });
    }

    set refundBefRec(value) {
        /** 设置售前退款回收比例（0-1） */
        this.#refundBefRec = ValidateUtils.decimalRange(value, { min: 0, max: 1, decimal: true });
    }

    set refundIngRec(value) {
        /** 设置售中退款回收比例（0-1） */
        this.#refundIngRec = ValidateUtils.decimalRange(value, { min: 0, max: 1, decimal: true });
    }

    set refundAftRec(value) {
        /** 设置售后退款回收比例（0-1） */
        this.#refundAftRec = ValidateUtils.decimalRange(value, { min: 0, max: 1, decimal: true });
    }
}