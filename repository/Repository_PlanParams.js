/**
 * 方案仓储类
 * 负责方案的增删改查操作
 */
import { DBFactory } from './db/DBFactory.js';
import { Entity_PlanParams } from './../domain/plan/Entity_PlanParams.js';


export class Repository_PlanParams {
  #DB_NAME = null;
  static PLAN_PARAMS_STORE = 'planParams';

  #dbHelper;

  /**
   * 构造函数
   */
  constructor(dbName) {
    if (dbName) {
      this.#DB_NAME = dbName;
    }
  }

  /**
   * 初始化数据库
   * @returns {Promise<void>}
   */
  async initDatabase(dbName) {
    console.log('%c  + start initDatabase for Entity_PlanParams:', "color: green", performance.now());
    this.#dbHelper = await DBFactory.getDB(this.#DB_NAME);
    console.log('%c  + end initDatabase for Entity_PlanParams:', "color: green", performance.now());
  }

  /**
   * 保存方案
   * @param {Entity_PlanParams} plan - 方案实例
   * @returns {Promise<Entity_PlanParams>} 保存后的方案实例
   */
  async savePlanParams(plan) {
    if (!(plan instanceof Entity_PlanParams)) {
      throw new Error('参数必须是PlanModel实例');
    }

    const plainObject = plan.toSerializable();
    await this.#dbHelper.put(Repository_PlanParams.PLAN_PARAMS_STORE, plainObject);

    return plan;
  }

  /**
   * 根据ID获取方案
   * @param {string} id - 方案ID
   * @returns {Promise<Entity_PlanParams|null>} 方案实例或null
   */
  async getPlanParamsById(id) {
    const data = await this.#dbHelper.get(Repository_PlanParams.PLAN_PARAMS_STORE, id);
    if (!data) return null;

    return Entity_PlanParams.parse(data);
  }

  /**
   * 删除方案
   * @param {string} id - 方案ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deletePlanParams(id) {
    // 检查方案是否存在
    const existing = await this.getPlanParamsById(id);
    if (!existing) {
      return false;
    }

    await this.#dbHelper.delete(Repository_PlanParams.PLAN_PARAMS_STORE, id);
    return true;
  }
}