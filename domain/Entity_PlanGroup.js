import Entity_Base from './Entity_Base.js';
import Integer from '../infrastructure/Integer.js';
import { ValidateUtils } from '../infrastructure/ValidateUtils.js';

/**
 * 计划组模型类，封装计划组的所有属性和行为
 * @class Entity_PlanGroup
 * @classdesc 计划组元数据模型类，封装计划组的所有属性和内部自身的一些行为
 */
export class Entity_PlanGroup extends Entity_Base {
    #name;      // 方案组名称 必填
    #planCount; // 方案组下的方案数量，默认0
    #description; // 方案组描述，可以为空字符串

    /**
     * 创建PlanGroupModel实例
     * @param {Object} dto - 初始化计划组的数据对象
     * @param {string} dto.id - 方案组ID（必填）
     * @param {string} [dto.createdAt] - 创建时间，格式为YYYY-MM-DD HH:mm:ss，默认自动生成
     * @param {string} [dto.updatedAt] - 更新时间，格式为YYYY-MM-DD HH:mm:ss，默认自动生成
     * @param {string} dto.name - 方案组名称（必填）
     * @param {number|string|Decimal|Integer} [dto.planCount=0] - 方案组下的方案数量，默认0
     * @param {string} [dto.description=''] - 方案组描述，默认为空字符串
     * @throws {Error} 当id或name缺失时抛出错误
     */
    constructor(dto) {
        super(dto.id, dto.createdAt, dto.updatedAt);

        this.#name = ValidateUtils.stringNotEmptyAndWhitespace(dto.name);
        this.#planCount = new Integer(dto.planCount || 0, { allowNegative: false });
        this.#description = dto.description ?? '';
    }

    static parse(dto) {
        return new Entity_PlanGroup({
            id: dto.id,
            createdAt: dto.createdAt,
            updatedAt: dto.updatedAt,
            name: ValidateUtils.stringNotEmptyAndWhitespace(dto.name),
            planCount: new Integer(dto.planCount.value, dto.planCount.options),
            description: dto.description ?? '',
        });
    }

    // Getter方法
    get name() { return this.#name; }
    get planCount() { return this.#planCount; }
    get description() { return this.#description; }

    // Setter方法
    set name(newName) {
        this.#name = ValidateUtils.stringNotEmptyAndWhitespace(newName);
        super.updateTime();
    }

    set planCount(newPlansNum) {
        this.#planCount = new Integer(newPlansNum, { allowNegative: false });
        super.updateTime();
    }
    set description(newDesc) {
        this.#description = newDesc ?? '';
        super.updateTime();
    }

}