import Entity_Base from './Entity_Base.js';
import { ValidateUtils } from '../infrastructure/ValidateUtils.js';
/**
 * 计划元数据实体类
 * @class Entity_PlanMeta
 */
export class Entity_PlanMeta extends Entity_Base {
    #groupId;   // 方案组ID，外键，必须有
    #name;      // 方案名称 必须有
    #description; // 方案描述，可以为空字符串
    #enabled;   // 是否启用，布尔值：false（禁用），true（启用）


    /**
     * 创建PlanModel实例
     * @param {Object} dto - 初始化计划的数据对象
     * @param {string} dto.id - 方案ID（必填）
     * @param {string} dto.groupId - 方案组ID（必填）
     * @param {string} [dto.createdAt] - 创建时间，格式为YYYY-MM-DD HH:mm:ss，默认自动生成
     * @param {string} [dto.updatedAt] - 更新时间，格式为YYYY-MM-DD HH:mm:ss，默认自动生成
     * @param {string} dto.name - 方案名称（必填）
     * @param {string} [dto.description=''] - 方案描述，默认为空字符串
     * @param {boolean} [dto.enabled=true] - 是否启用，默认true（启用）
     */
    constructor(dto) {
        super(dto.id, dto.createdAt, dto.updatedAt);

        this.#groupId = ValidateUtils.stringIsStandardUUID(dto.groupId);
        this.#name = ValidateUtils.stringNotEmptyAndWhitespace(dto.name);
        this.#description = dto.description ?? ''; // 默认为空字符串
        this.#enabled = ValidateUtils.extendedBooleanConverter(dto.enabled ?? false); // 默认不启用
    }

    get groupId() { return this.#groupId; }
    get name() { return this.#name; }
    get description() { return this.#description; }
    get enabled() { return this.#enabled; }

    set name(newName) {
        this.#name = ValidateUtils.stringNotEmptyAndWhitespace(newName, '方案名称（name）是必填项');
        super.updateTime();
    }
    set description(newDesc) {
        this.#description = newDesc ?? '';
        super.updateTime();
    }
    set enabled(isEnabled) {
        this.#enabled = ValidateUtils.extendedBooleanConverter(isEnabled);
    }
}