/**
 * 方案组仓储类
 * 负责方案组的增删改查操作
 */
import { DBFactory } from './db/DBFactory.js';
import { Entity_PlanGroup } from '../domain/Entity_PlanGroup.js';

export class Repository_PlanGroup {

	static PLAN_GROUP_STORE = 'planGroups';
	static PLAN_META_STORE = 'planMetas';
	static PLAN_PARAMS_STORE = 'planParams';

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
        console.log('%c  + start initDatabase for Entity_PlanGroup:', "color: green", performance.now());

		let version = undefined;

		// 初始化数据库
		this.#dbHelper = await DBFactory.getDB(this.#DB_NAME, version, (db, oldVersion, newVersion) => {

			if (!db.objectStoreNames.contains('system')) {
				const groupStore = db.createObjectStore('system', {
					keyPath: 'id',
					autoIncrement: false,
				});
				groupStore.createIndex('createdAt', 'createdAt', { unique: false });
			}

			if (!db.objectStoreNames.contains(Repository_PlanGroup.PLAN_GROUP_STORE)) {
				const groupStore = db.createObjectStore(Repository_PlanGroup.PLAN_GROUP_STORE, {
					keyPath: 'id',
					autoIncrement: false,
				});
				groupStore.createIndex('createdAt', 'createdAt', { unique: false });
			}

			if (!db.objectStoreNames.contains(Repository_PlanGroup.PLAN_META_STORE)) {
				const planMetaStore = db.createObjectStore(Repository_PlanGroup.PLAN_META_STORE, {
					keyPath: 'id',
					autoIncrement: false,
				});
				planMetaStore.createIndex('groupId', 'groupId', { unique: false });
				planMetaStore.createIndex('createdAt', 'createdAt', { unique: false });
				planMetaStore.createIndex('updatedAt', 'updatedAt', { unique: false });
				planMetaStore.createIndex('enabled', 'enabled', { unique: false });
			}

			if (!db.objectStoreNames.contains(Repository_PlanGroup.PLAN_PARAMS_STORE)) {
				const plansStore = db.createObjectStore(Repository_PlanGroup.PLAN_PARAMS_STORE, {
					keyPath: 'id',
					autoIncrement: false,
				});
				plansStore.createIndex('createdAt', 'createdAt', { unique: false });
				plansStore.createIndex('updatedAt', 'updatedAt', { unique: false });
			}

			this.#upgradeDatabase();

		});

		console.log('%c  + end initDatabase for Entity_PlanGroup:', "color: green", performance.now());
	}

	/**
	 * 升级数据库
	 * @private
	 */
	async #upgradeDatabase() {
		// 升级的时候，修改这个版本号就行了
		if (this.#dbHelper?.version != undefined && this.#dbHelper?.version != null && this.#dbHelper?.version < 0) {
			// 关闭旧数据库连接
			await this.#dbHelper.close();
			DBFactory.deleteDB(this.#DB_NAME);

			this.#dbHelper = await DBFactory.getDB(this.#DB_NAME, this.#dbHelper.version + 1, (db, oldVersion, newVersion) => {
				// 新版本数据库的相关代码
			});
		}
	}

	/**
	 * 保存方案组
	 * @param {Entity_PlanGroup} planGroup - 方案组实例
	 * @returns {Promise<Entity_PlanGroup>} 保存后的方案组实例
	 */
	async savePlanGroup(entity) {
		if (!(entity instanceof Entity_PlanGroup)) {
			throw new Error('参数必须是PlanGroup实例');
		}
		if (!entity.id) {
			throw new Error('缺少id');
		}
		// 检查方案组名称是否已存在
		if (await this.isPlanGroupNameExists(entity.name, entity.id)) {
			throw new Error('方案组名称已存在');
		}

		const plainObject = entity.Serializable();
		await this.#dbHelper.put(Repository_PlanGroup.PLAN_GROUP_STORE, plainObject);

		return entity;
	}

	/**
	 * 删除方案组
	 * @param {number} id - 方案组ID
	 * @returns {Promise<boolean>} 是否删除成功
	 */
	async deletePlanGroup(id) {
		// 检查方案组是否存在
		const existing = await this.getPlanGroupById(id);
		if (!existing) {
			return false;
		}

		await this.#dbHelper.delete(Repository_PlanGroup.PLAN_GROUP_STORE, id);
		return true;
	}

	/**
	 * 获取所有方案组
	 * @returns {Promise<Entity_PlanGroup[]>} 方案组列表
	 */
	async getAllPlanGroups() {
		const dataList = await this.#dbHelper.getAllByIndex(Repository_PlanGroup.PLAN_GROUP_STORE, 'createdAt', 'desc');
		return dataList.map(data => Entity_PlanGroup.parse({
			name: data.name,
			description: data.description,
			id: data.id,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			planCount: data.planCount,
		}));
	}

	/**
	 * 根据ID获取方案组
	 * @param {number} id - 方案组ID
	 * @returns {Promise<Entity_PlanGroup|null>} 方案组实例或null
	 */
	async getPlanGroupById(id) {
		const data = await this.#dbHelper.get(Repository_PlanGroup.PLAN_GROUP_STORE, id);
		if (!data) return null;

		return Entity_PlanGroup.parse({
			name: data.name,
			description: data.description,
			id: data.id,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			planCount: data.planCount
		})
	}

	/**
 * 检查方案组名称是否已存在
 * @param {string} name - 方案组名称
 * @param {string} [excludeId=null] 排除的方案组ID（用于更新时）
 * @returns {Promise<boolean>} 是否存在
 */
	async isPlanGroupNameExists(name, excludeId = null) {
		const allPlanGroups = await this.getAllPlanGroups();
		let exists = allPlanGroups.some(Entity_PlanGroup =>
			Entity_PlanGroup.name === name && Entity_PlanGroup.id !== excludeId
		);
		return exists;
	}
}
