import { DBFactory } from './db/DBFactory.js';
import { Entity_Workspace } from '../domain/Entity_Workspace.js';
/**
 * 工作区仓储类
 * 负责工作区的增删改查操作
 * @class Repository_Workspace
 */
export class Repository_Workspace {
    static DB_NAME = 'profitSimulation_systemDB';
    static WORKSPACE_STORE = 'workspaces';

    #dbHelper;

    /**
     * 构造函数
     */
    constructor() {
        // 构造函数留空，使用前需调用initDatabase初始化数据库
    }

    /**
     * 初始化数据库
     * @returns {Promise<void>}
     */
    async initDatabase() {
        console.log('%c  + start initDatabase for Entity_Workspace:', "color: green", performance.now());
        let version = undefined;
        this.#dbHelper = await DBFactory.getDB(Repository_Workspace.DB_NAME, version, (db, oldVersion, newVersion) => {
            // 创建工作区存储
            if (!db.objectStoreNames.contains(Repository_Workspace.WORKSPACE_STORE)) {
                const workspaceStore = db.createObjectStore(Repository_Workspace.WORKSPACE_STORE, {
                    keyPath: 'id',
                    autoIncrement: false,
                });
                workspaceStore.createIndex('createdAt', 'createdAt', { unique: false });
                workspaceStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
        });
        console.log('%c  + end initDatabase for Entity_Workspace:', "color: green", performance.now());
    }

    /**
     * 保存工作区
     * @param {Entity_Workspace} Entity_Workspace - 工作区实例
     * @returns {Promise<Entity_Workspace>} 保存后的工作区实例
     */
    async saveWorkspace(entity) {
        if (!(entity instanceof Entity_Workspace)) {
            throw new Error('参数必须是Workspace实例');
        }
        if (!entity.id) {
            throw new Error('缺少id');
        }
        // 检查工作区名称是否已存在
        if (await this.isWorkspaceNameExists(entity.name, entity.id)) {
            throw new Error('工作区名称已存在');
        }

        const plainObject = entity.toSerializable();
        await this.#dbHelper.put(Repository_Workspace.WORKSPACE_STORE, plainObject);

        return entity;
    }

    /**
     * 删除工作区
     * @param {string} id - 工作区ID
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteWorkspace(id) {
        // 检查工作区是否存在
        const existing = await this.getWorkspaceById(id);
        if (!existing) {
            return false;
        }
        return new Promise(async (resolve, reject) => {
            try {
                DBFactory.clsDb(id);

                const request = indexedDB.deleteDatabase(id);
                request.onsuccess = async (event) => {
                    await this.#dbHelper.delete(Repository_Workspace.WORKSPACE_STORE, id);
                    resolve(true);
                };
                request.onerror = async (event) => {
                    // 虽然失败了，但是数据肯定是不在了，因此需要修改WORKSPACE_STORE中对应的数据，标记这个库是需要被删掉的。
                    // 然后每当getall方法时，检查这个标记，如果标记为删除,就再次尝试进行删除。
                    const item = await this.getWorkspaceById(id);
                    item.deleteing = true;
                    await this.saveWorkspace(item);
                    reject(event.target.errorCode);
                };
                request.onblocked = async (event) => {
                    // 虽然失败了，但是数据肯定是不在了，因此需要修改WORKSPACE_STORE中对应的数据，标记这个库是需要被删掉的。
                    // 然后每当getall方法时，检查这个标记，如果标记为删除,就再次尝试进行删除。
                    const item = await this.getWorkspaceById(id);
                    item.deleteing = true;
                    await this.saveWorkspace(item);
                    reject('数据库删除被阻塞，请关闭所有连接后重试！');
                };
            } catch (error) {
                reject(false);
            }
        });
    }

    /**
     * 获取所有工作区
     * @returns {Promise<Entity_Workspace[]>} 工作区列表
     */
    async getAllWorkspaces() {
        const dataList = await this.#dbHelper.getAllByIndex(Repository_Workspace.WORKSPACE_STORE, 'createdAt', 'desc');
        const result = dataList.map(data => new Entity_Workspace({
            id: data.id,
            name: data.name,
            description: data.description,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            enabled: data.enabled,
        }));

        // 处理标记为删除的工作区
        for (const workspace of result) {
            if (workspace.deleteing) {
                try {
                    await this.deleteWorkspace(workspace.id);
                } catch (error) {
                    // 忽略错误
                }
            }
            return result;
        }
    }

    /**
     * 根据ID获取工作区
     * @param {string} id - 工作区ID
     * @returns {Promise<Entity_Workspace|null>} 工作区实例或null
     */
    async getWorkspaceById(id) {
        const data = await this.#dbHelper.get(Repository_Workspace.WORKSPACE_STORE, id);
        if (!data) return null;

        return new Entity_Workspace({
            id: data.id,
            name: data.name,
            description: data.description,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            enabled: data.enabled
        });
    }

    /**
     * 启用工作区,由于处于启用状态的工作区，只能存在一个，因此提供一个专门用来启用工作区的方法
     * 该方法内会自动将其他所有工作区的enabled属性设置为false
     * 不要自行修改启用状态，然后用save方法保存，可能会导致存在多个enabled为true的工作区
     * @param {string} id - 工作区ID
     * @returns {Promise<Entity_Workspace>} 启用后的工作区实例
     */
    async enableWorkspace(id) {
        // 检查工作区是否存在
        const existing = await this.getWorkspaceById(id);
        if (!existing) {
            throw new Error(`ID为${id}的工作区不存在`);
        }

        //需要修改其他的工作区为false
        const allWorkspaces = await this.getAllWorkspaces();
        for (const Entity_Workspace of allWorkspaces) {
            if (Entity_Workspace.id !== id) {
                Entity_Workspace.enabled = false;
                await this.saveWorkspace(Entity_Workspace);
            }
        }

        // 更新工作区状态
        existing.enabled = true;
        await this.saveWorkspace(existing);
        return existing;
    }

    /**
     * 检查工作区名称是否已存在
     * @param {string} name - 工作区名称
     * @param {string} [excludeId=null] 排除的工作区ID（用于更新时）
     * @returns {Promise<boolean>} 是否存在
     */
    async isWorkspaceNameExists(name, excludeId = null) {
        const allWorkspaces = await this.getAllWorkspaces();
        if (allWorkspaces) {
            return allWorkspaces.some(Entity_Workspace =>
                Entity_Workspace.name === name && Entity_Workspace.id !== excludeId
            );
        } else {
            return false;
        }
    }

    close() {
        return DBFactory.clsDb(Repository_Workspace.DB_NAME);
    }
}