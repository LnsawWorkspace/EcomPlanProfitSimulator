/**
 * 方案元数据仓储类
 * 负责方案元数据的增删改查操作
 */
import { DBFactory } from './db/DBFactory.js';
import { Entity_PlanMeta } from '../domain/Entity_PlanMeta.js';

export class Repository_PlanMeta {
	static PLAN_META_STORE = 'planMetas';

	#DB_NAME = null;
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
	async initDatabase() {
		console.log('%c  + start initDatabase for Entity_PlanMeta:', "color: green", performance.now());
		this.#dbHelper = await DBFactory.getDB(this.#DB_NAME);
		console.log('%c  + start initDatabase for Entity_PlanMeta:', "color: green", performance.now());
	}

	/**
	 * 保存方案元数据
	 * @param {Entity_PlanMeta} Entity_PlanMeta - 方案元数据实例
	 * @returns {Promise<Entity_PlanMeta>} 保存后的方案元数据实例
	 */
	async savePlanMeta(entity) {
		if (!(entity instanceof Entity_PlanMeta)) {
			throw new Error('参数必须是Entity_PlanMeta实例');
		}
		if (!entity.id) {
			throw new Error('缺少id');
		}
		// 检查方案名称是否已存在
		if (await this.isPlanMetaNameExists(entity.groupId, entity.name, entity.id)) {
			throw new Error('方案名称已存在');
		}

		const plainObject = entity.toSerializable();
		await this.#dbHelper.put(Repository_PlanMeta.PLAN_META_STORE, plainObject);

		return entity;
	}

	/**
	 * 删除方案元数据
	 * @param {string} id - 方案ID
	 * @returns {Promise<boolean>} 是否删除成功
	 */
	async deletePlanMeta(id) {
		// 检查方案元数据是否存在
		const existing = await this.getPlanMetaById(id);
		if (!existing) {
			return false;
		}

		await this.#dbHelper.delete(Repository_PlanMeta.PLAN_META_STORE, id);
		return true;
	}

	/**
	 * 删除方案组中的所有方案元数据
	 * @param {string} groupId - 方案组ID
	 * @returns {Promise<number>} 删除的方案元数据数量
	 */
	async deletePlanMetasByGroupId(groupId) {
		const planMetas = await this.getPlanMetasByGroupId(groupId);
		let deletedCount = 0;

		for (const Entity_PlanMeta of planMetas) {
			const deleted = await this.deletePlanMeta(Entity_PlanMeta.id);
			if (deleted) deletedCount++;
		}

		return deletedCount;
	}

	/**
	 * 根据ID获取方案元数据
	 * @param {string} id - 方案ID
	 * @returns {Promise<Entity_PlanMeta|null>} 方案元数据实例或null
	 */
	async getPlanMetaById(id) {
		const data = await this.#dbHelper.get(Repository_PlanMeta.PLAN_META_STORE, id);
		if (!data) return null;

		return new Entity_PlanMeta({
			id: data.id,
			groupId: data.groupId,
			name: data.name,
			description: data.description,
			enabled: data.enabled,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		});
	}

	/**
	 * 根据方案组ID获取方案元数据列表
	 * @param {string} groupId - 方案组ID
	 * @returns {Promise<Entity_PlanMeta[]>} 方案元数据列表
	 */
	async getPlanMetasByGroupId(groupId) {
		if (!groupId) {
			throw new Error('方案组ID不能为空');
		}

		const dataList = await this.#dbHelper.getByIndex(
			Repository_PlanMeta.PLAN_META_STORE,
			'groupId',
			groupId
		);
		return dataList.map(data => new Entity_PlanMeta({
			id: data.id,
			groupId: data.groupId,
			name: data.name,
			description: data.description,
			enabled: data.enabled,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		}));
	}


	async isPlanMetaNameExists(groupid, name, excludeId = null) {
		const allPlanMetas = await this.getPlanMetasByGroupId(groupid);
		return allPlanMetas.some(Entity_PlanMeta =>
			Entity_PlanMeta.name === name && Entity_PlanMeta.id !== excludeId
		);
	}

}