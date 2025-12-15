import Decimal from '../../infrastructure/decimal.mjs';
import Integer from '../../infrastructure/Integer.js';
import Money from '../../infrastructure/Money.js';
import Percentage from '../../infrastructure/Percentage.js';
import ValidateUtils from '../../infrastructure/ValidateUtils.js';
import { Model_PlanParams_Goods } from './Model_PlanParams_Goods.js';

// ==================== GiftCost ====================
/**
 * 商品的变种，赠品
 * @class Model_PlanParams_Gift
 * @classdesc 商品的变种，赠品实体类，用于存储赠品的相关信息
 */
export class Model_PlanParams_Gift extends Model_PlanParams_Goods {
    #subjectType;        // 赠品类型：'视同销售'/'销售费用'

    /**
    * @param {Object} dto - 赠品成本配置对象（与GoodsItems入参完全一致，新增2个参数）
    * 
    * @param {string} dto.name - 赠品名称
    * @param {number|string|Decimal} [dto.quantity=1] - 商品数量（正整数）
    * @param {number|string|Decimal} [dto.purchaseAmount=0] - 采购金额（用于计算商品成本）
    * @param {number|string|Decimal} [dto.purchaseQuantity=0] - 采购数量（用于计算商品成本）
    * @param {number|string|Decimal} [dto.valueIncTax=0] - 含税商品成本（采购成本）
    * @param {number|string|Decimal} [dto.valueExcTax=0] - 不含税商品成本（优先级最高）
    * @param {number|string|Decimal} [dto.inputRate=0] - 进项税率（小数形式0-1，如0.13代表13%）
    * @param {number|string|Decimal} [dto.outputRate=0] - 销项税率（小数形式0-1，默认等于进项税率）
    * @param {number|string|Decimal} [dto.fairValue=0] - 商品公允价值（不含税）
    * @param {number|string|Decimal} [dto.refundBefRec=100] - 售前退款回收率（小数形式0-1）
    * @param {number|string|Decimal} [dto.refundIngRec=100] - 售中退款回收率（小数形式0-1）
    * @param {number|string|Decimal} [dto.refundAftRec=100] - 售后退款回收率（小数形式0-1）
    * 
    * @param {('视同销售'|'销售费用')} [dto.subjectType] - 赠品类型（新增，驼峰命名）
    */
    constructor(dto) {
        // 完整传递GoodsItems的所有参数
        super(dto);

        // 新增赠品特有属性
        this.#subjectType = this.#validateAndSetSubjectType(dto.subjectType);
    }

    static parse(dto) {
        return new Model_PlanParams_Gift({
            name: dto.name,
            quantity: dto.quantity.value,
            purchaseAmount: dto.purchaseAmount.value,
            purchaseQuantity: dto.purchaseQuantity.value,
            valueIncTax: dto.valueIncTax.value,
            valueExcTax: dto.valueExcTax.value,
            inputRate: dto.inputRate.value,
            outputRate: dto.outputRate.value,
            fairValue: dto.fairValue.value,
            refundBefRec: dto.refundBefRec.value,
            refundIngRec: dto.refundIngRec.value,
            refundAftRec: dto.refundAftRec.value,
            subjectType: dto.subjectType,
        });
    }

    // 私有方法：校验赠品类型
    #validateAndSetSubjectType(type) {
        const validatedType = ValidateUtils.stringNotEmptyAndWhitespace(type);
        const validTypes = ['视同销售', '销售费用'];
        return validTypes.includes(validatedType) ? validatedType : '销售费用';
    }

    // Getters（新增属性）
    get subjectType() { return this.#subjectType; }
}