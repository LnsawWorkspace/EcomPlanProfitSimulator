/**
 * DBFactory - 简化的数据库连接管理器
 * 仅使用静态dbHelpers作为单例来管理数据库连接
 */
import { IndexedDBHelper } from './IndexedDBHelper.js';

export class DBFactory {
    // 私有静态字段，作为单例保存所有数据库助手实例
    static #dbHelpers = new Map();

    /**
     * 获取数据库连接助手
     * @param {string} dbName 数据库名称
     * @param {(db: IDBDatabase, oldVersion: number, newVersion: number) => void} [onUpgradeNeeded] 数据库升级回调
     * @returns {Promise<IndexedDBHelper>} IndexedDBHelper实例
     */
    static async getDB(dbName, version, onUpgradeNeeded = null) {
        if (!dbName) {
            throw new Error('Database name and version are required');
        }

        const dbKey = `${dbName}`;

        // 检查是否已有该数据库的助手实例
        if (!this.#dbHelpers.has(dbKey)) {
            // 创建新的助手实例
            const dbHelper = new IndexedDBHelper(dbName, version);
            this.#dbHelpers.set(dbKey, dbHelper);
        }

        const dbHelper = this.#dbHelpers.get(dbKey);

        // 确保数据库已打开
        await dbHelper.open(onUpgradeNeeded);

        return dbHelper;
    }

    /**
     * 指的是从map中移除指定数据库助手实例
     * 会关闭数据库连接
     */
    static async clsDb(dbName) {
        if (!dbName) {
            return;
        }
        const dbKey = `${dbName}`;
        if (this.#dbHelpers.has(dbKey)) {
            // 关闭数据库连接
            await this.#dbHelpers.get(dbKey).close();
            this.#dbHelpers.delete(dbKey);
        }
    }
}