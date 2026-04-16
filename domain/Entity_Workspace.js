import Entity_Base from './Entity_Base.js';
import { DateTimeUtils } from './utils/DateTimeUitls.js';
import { ValidateUtils } from '../infrastructure/ValidateUtils.js';
/**
 * 工作空间实体类
 * @class Entity_Workspace
 */
export class Entity_Workspace extends Entity_Base {
    #backupAt; // 最后一次备份时间,格式为YYYY-MM-DD HH:mm:ss,默认null
    #name;      // 空间名称 必须有
    #description; // 空间描述，可以为空字符串
    #enabled; // 是否启用，默认true,只允许启用一个
    #deleteing; // 是否正在删除中，默认false,由于IndexedDB即便删除失败也有可能会导致数据被清空，因此，如果删除失败，deleteing设置为true，每当次打开应用时，都会尝试重新删除。


    /**
     * 创建PlanModel实例
     * @param {Object} dto - 初始化计划的数据对象
     * @param {string} dto.id - 方案ID（必填）
     * @param {string} [dto.createdAt] - 创建时间，格式为YYYY-MM-DD HH:mm:ss，默认自动生成
     * @param {string} [dto.updatedAt] - 更新时间，格式为YYYY-MM-DD HH:mm:ss，默认自动生成
     * @param {string} [dto.backupAt] - 备份时间，格式为YYYY-MM-DD HH:mm:ss，默认null
     * @param {string} dto.name - 方案名称（必填）
     * @param {string} [dto.description=''] - 方案描述，默认为空字符串
     * 
     */
    constructor(dto) {
        super(dto.id, dto.createdAt, dto.updatedAt);

        this.#name = ValidateUtils.stringNotEmptyAndWhitespace(dto.name);
        this.#description = dto.description ?? ''; // 默认为空字符串
        this.#backupAt = dto.backupAt || null; // 默认为null
        this.#enabled = ValidateUtils.extendedBooleanConverter(dto.enabled ?? false); // 默认为true
    }

    get backupAt() { return this.#backupAt; }
    get name() { return this.#name; }
    get description() { return this.#description; }
    get enabled() { return this.#enabled; }
    get deleteing() { return this.#deleteing; }

    set name(newName) {
        this.#name = ValidateUtils.stringNotEmptyAndWhitespace(newName);
        super.updateTime();
    }
    set description(newDesc) {
        this.#description = newDesc ?? '';
        super.updateTime();
    }
    set enabled(newEnabled) {
        this.#enabled = ValidateUtils.extendedBooleanConverter(newEnabled);
    }
    set backupAt(newBackupAt) {
        this.#backupAt = DateTimeUtils.to_yyyymmdd_hhmmss(newBackupAt);
    }
    set deleteing(newDeleteing) {
        this.#deleteing = ValidateUtils.extendedBooleanConverter(newDeleteing);
    }
}