/**
 * IndexedDBHelper - 通用的IndexedDB辅助类
 * 使用ES2025最新特性实现
 */
export class IndexedDBHelper {
  #dbName;
  #version;
  #db = null;
  #dbOpenPromise = null;

  /**
   * 构造函数
   * @param {string} dbName 数据库名称
   * @param {number} version 数据库版本号
   */
  constructor(dbName, version) {
    this.#dbName = dbName;
    this.#version = version;
  }

  get version() {
    return this.#version;
  }

  /**
   * 打开数据库连接
   * @param {(db: IDBDatabase, oldVersion: number, newVersion: number) => void} [onUpgradeNeeded]
   * @returns {Promise<void>}
   */
  open(onUpgradeNeeded) {
    // 防止重复打开连接
    if (this.#dbOpenPromise) return this.#dbOpenPromise;

    this.#dbOpenPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#dbName, this.#version);

      request.onerror = (event) => {
        this.#dbOpenPromise = null;
        reject(new Error(`Failed to open database: ${event.target?.error?.message ?? 'Unknown error'}`));
      };

      request.onsuccess = (event) => {
        this.#db = event.target.result;
        this.#version = this.#db.version;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion ?? this.#version;

        onUpgradeNeeded?.(db, oldVersion, newVersion);
      };
    });

    return this.#dbOpenPromise;
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.#db) {
      await this.#db.close();
      this.#db = null;
      this.#dbOpenPromise = null;
    }
  }

  /**
   * 删除数据库
   * @returns {Promise<void>}
   */
  removeDatabase() {
    this.close();

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.#dbName);

      request.onerror = (event) => {
        reject(new Error(`Failed to delete database: ${event.target?.error?.message ?? 'Unknown error'}`));
      };

      request.onsuccess = () => resolve();
    });
  }

  /**
   * 执行事务操作
   * @param {string|string[]} storeNames 存储对象名称列表
   * @param {IDBTransactionMode} mode 事务模式
   * @param {(transaction: IDBTransaction) => Promise<any>} callback 在事务中执行的回调函数
   * @returns {Promise<any>}
   */
  async transaction(storeNames, mode, callback) {
    await this.#ensureDbIsOpen();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction(storeNames, mode);

      transaction.onerror = (event) => {
        reject(new Error(`Transaction error: ${event.target?.error?.message ?? 'Unknown error'}`));
      };

      // 执行回调函数，获取返回值
      Promise.resolve(callback(transaction))
        .then((result) => {
          // 确保事务完成
          transaction.oncomplete = () => resolve(result);
        })
        .catch(reject);
    });
  }
  /**
   * 添加数据到对象存储
   * @param {string} storeName 存储对象名称
   * @param {any} value 要添加的数据
   * @param {IDBValidKey} [key] 可选的键值
   * @returns {Promise<IDBValidKey>}
   */
  async add(storeName, value, key) {
    return this.transaction(storeName, 'readwrite', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const request = key !== undefined ? store.add(value, key) : store.add(value);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Failed to add item: ${request.error?.message ?? 'Unknown error'}`));
      });
    });
  }
  /**
   * 更新对象存储中的数据
   * @param {string} storeName 存储对象名称
   * @param {any} value 要更新的数据
   * @param {IDBValidKey} [key] 可选的键值
   * @returns {Promise<IDBValidKey>}
   */
  async put(storeName, value, key) {
    return this.transaction(storeName, 'readwrite', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const request = key !== undefined ? store.put(value, key) : store.put(value);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Failed to update item: ${request.error?.message ?? 'Unknown error'}`));
      });
    });
  }
  /**
   * 根据键获取对象存储中的数据
   * @param {string} storeName 存储对象名称
   * @param {IDBValidKey} key 键值
   * @returns {Promise<any>}
   */
  async get(storeName, key) {
    return this.transaction(storeName, 'readonly', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Failed to get item: ${request.error?.message ?? 'Unknown error'}`));
      });
    });
  }
  /**
   * 使用索引获取数据
   * @param {string} storeName 存储对象名称
   * @param {string} indexName 索引名称
   * @param {IDBValidKey} value 索引值
   * @returns {Promise<Array>}
   */
  async getByIndex(storeName, indexName, indexValue) {
    return this.transaction(storeName, 'readonly', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(indexValue);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Failed to get items by index: ${request.error?.message ?? 'Unknown error'}`));
      });
    });
  }
  /**
   * 获取对象存储中的所有数据
   * @param {string} storeName 存储对象名称
   * @returns {Promise<Array>}
   */
  async getAll(storeName) {
    return this.transaction(storeName, 'readonly', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Failed to get all items: ${request.error?.message ?? 'Unknown error'}`));
      });
    });
  }
  /**
   * 使用索引获取对象存储中的所有数据
   * @param {string} storeName 存储对象名称
   * @param {string} indexName 索引名称
   * @param {string} [direction='asc'] 排序方向，'asc' 或 'desc'
   * @param {IDBKeyRange} [range=null] 可选的键范围
   * @returns {Promise<Array>}
   */
  async getAllByIndex(storeName, indexName, direction = 'asc', range = null) {
    return this.transaction(storeName, 'readonly', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);

      if (direction === 'asc') {
        // 升序
        const request = range ? index.getAll(range) : index.getAll();

        return new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error(`Failed to get all items by index: ${request.error?.message ?? 'Unknown error'}`));
        });
      } else {
        // 降序
        const request = index.openCursor(range, 'prev');
        const results = [];

        return new Promise((resolve, reject) => {
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          request.onerror = () => reject(new Error(`Failed to get all items by index: ${request.error?.message ?? 'Unknown error'}`));
        });
      }
    });
  }
  /**
   * 根据键删除对象存储中的数据
   * @param {string} storeName 存储对象名称
   * @param {IDBValidKey} key 键值
   * @returns {Promise<void>}
   */
  async delete(storeName, key) {
    return this.transaction(storeName, 'readwrite', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to delete item: ${request.error?.message ?? 'Unknown error'}`));
      });
    });
  }
  /**
   * 清空对象存储
   * @param {string} storeName 存储对象名称
   * @returns {Promise<void>}
   */
  async clear(storeName) {
    return this.transaction(storeName, 'readwrite', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to clear store: ${request.error?.message ?? 'Unknown error'}`));
      });
    });
  }
  /**
   * 检查数据库是否已打开
   * @private
   * @returns {Promise<void>}
   */
  async #ensureDbIsOpen() {
    if (!this.#db) {
      throw new Error('Database is not open. Call open() first.');
    }
  }
}