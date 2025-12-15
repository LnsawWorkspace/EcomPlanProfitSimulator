/**
 * 工作区管理器
 * 负责工作区的增删改查和数据管理等功能
 */
import { Entity_Workspace } from '../../../domain/Entity_Workspace.js';
import { Repository_Workspace } from '../../../repository/Repository_Workspace.js';

class WorkspaceManager {
	// 工作区仓库
	#Repository_Workspace;
	// DOM元素引用映射
	#elements = {};
	// Bootstrap模态框实例映射
	#modals = {};
	// 工作台数据对象
	#workbenchData = {};
	// 回调函数映射
	#callbacks = {};
	// 显示提示信息函数
	#showToast = {};

	// 所有工作区数组
	#allWorkspaces = [];
	// 打开编辑模态框类型
	#openEditModalType = 'create';
	// 更新工作区ID
	#updateid = null;
	// 删除工作区ID
	#removeid = null;
	// 搜索关键词
	#searchKeyword = '';

	/**
	 * 构造函数
	 * @param {Object} options - 配置选项
	 * @param {Object} options.elements - DOM元素引用映射
	 * @param {Object} options.modals - Bootstrap模态框实例映射
	 * @param {Object} options.workbenchData - 工作台数据对象
	 * @param {Object} options.callbacks - 回调函数映射
	 */
	constructor({ elements = {}, modals = {}, workbenchData = {}, callbacks = {}, showToast = {} }) {
		// 初始化数据仓库
		this.#Repository_Workspace = new Repository_Workspace();
		// 设置DOM元素引用
		this.#elements = elements;
		// 设置模态框实例
		this.#modals = modals;
		// 设置工作台数据
		this.#workbenchData = workbenchData;
		// 设置回调函数
		this.#callbacks = callbacks;
		// 设置显示提示信息函数
		this.#showToast = showToast;
	}
	async requestPersistence() {
		if (navigator.storage && navigator.storage.persist) {

			const isPersisted = await navigator.storage.persist();
			const storageEstimate = await navigator.storage.estimate();
			let storageQuota = storageEstimate.quota / 1024 / 1024;
			let storageQuotaUnit = 'MB';
			let storageUsed = storageEstimate.usage / 1024 / 1024;
			let storageUsedUnit = 'MB';

			let rate = storageUsed / storageQuota * 100;

			if (storageQuota > 1024) {
				storageQuota = storageQuota / 1024;
				storageQuotaUnit = 'GB';
			}
			if (storageUsed > 1024) {
				storageUsed = storageUsed / 1024;
				storageUsedUnit = 'GB';
			}

			// 更新空间管理元素
			if (this.#elements.storageQuota) {
				this.#elements.storageQuota.textContent = `${storageQuota.toFixed(2)} ${storageQuotaUnit}`;
			}
			if (this.#elements.storageUsed) {
				this.#elements.storageUsed.textContent = `${storageUsed.toFixed(2)} ${storageUsedUnit} / ${rate.toFixed(4)}%`;
			}
			if (this.#elements.persistence) {
				this.#elements.persistence.textContent = isPersisted ? '已启用' : '未启用';
			}

			return isPersisted;
		}
		return false;
	}
	/**
	 * 初始化工作区管理器
	 */
	async initialize() {
		try {
			console.log('%c  workspace init start', 'color: #00ff00', performance.now());
			// 初始化数据库
			await this.#Repository_Workspace.initDatabase();
			// 加载所有工作区
			await this.loadAllWorkspaces();
			return true;
		} catch (error) {
			console.error('Failed to initialize workspace manager:', error);
			this.#showToast.error('工作区管理器初始化失败');
			return false;
		}
	}

	/**
	 * 加载所有工作区
	 */
	async loadAllWorkspaces() {
		try {
			const workspaces = await this.#Repository_Workspace.getAllWorkspaces();
			if (!workspaces || workspaces.length === 0) {
				// 至少需要一个工作区。
				// 创建默认工作区
				const defaultWorkspace = new Entity_Workspace({
					id: crypto.randomUUID(),
					name: '默认工作区',
					description: '这是默认创建的工作区',
					enabled: true
				});
				await this.#Repository_Workspace.saveWorkspace(defaultWorkspace);
				this.#allWorkspaces = [defaultWorkspace];
				this.#setEnabledWorkspaces();
				this.#filterAndRenderWorkspaces();
			} else {
				this.#allWorkspaces = workspaces;
				this.#setEnabledWorkspaces();
				this.#filterAndRenderWorkspaces();
			}
			return workspaces;
		} catch (error) {
			console.error('Failed to load workspaces:', error);
			this.#showToast.error('加载工作区失败');
			return [];
		}
	}

	/**
	 * 找到启用的工作区并且设置为当前工作区
	 */
	#setEnabledWorkspaces() {
		this.#workbenchData.currentWorkspace = this.#allWorkspaces.filter(workspace => workspace.enabled === true)[0];

		// 如果没有启用的工作区,设置第一个为当前工作区
		if (!this.#workbenchData.currentWorkspace) {
			this.#workbenchData.currentWorkspace = this.#allWorkspaces[0];
		}

		// 更新当前工作区名称
		if (this.#elements.currentWorkspaceName) {
			// 延迟 10毫秒更新当前工作区名称
			// 如果不延迟，死活找不到这个名称刷新闪烁的原因，难道是速度太快了？
			// 动画样式不能完全解决，到底是哪里的问题，非得延迟10毫秒才能避免闪烁？
			setTimeout(() => {
				this.#elements.currentWorkspaceName.textContent = `当前空间：${this.#workbenchData.currentWorkspace.name}`;
			}, 50);
		}
	}

	/**
	 * 开始搜索
	 * @param {string} key - 搜索关键词
	 */
	startSearch(key) {
		console.log('search keyword:', key);
		this.#searchKeyword = key;
		this.#filterAndRenderWorkspaces();
	}

	/**
	 * 过滤并渲染工作区列表
	 */
	#filterAndRenderWorkspaces() {
		// 根据搜索关键词过滤
		let filteredWorkspaces = [...this.#allWorkspaces];

		if (this.#searchKeyword) {
			const keyword = this.#searchKeyword.toLowerCase();
			filteredWorkspaces = filteredWorkspaces.filter(workspace =>
				workspace.name.toLowerCase().includes(keyword) ||
				(workspace.description && workspace.description.toLowerCase().includes(keyword))
			);
		}

		// 渲染列表
		this.#renderWorkspacesList(filteredWorkspaces);
	}

	/**
	 * 渲染工作区列表
	 * @param {Workspace[]} filteredWorkspaces - 过滤后的工作区列表
	 */
	#renderWorkspacesList(filteredWorkspaces) {
		const { workspaceTableBody } = this.#elements;
		if (!workspaceTableBody) return;

		// 清空列表
		workspaceTableBody.innerHTML = '';

		filteredWorkspaces.forEach(workspace => {
			// 创建工作区卡片元素
			const workspaceItem = document.createElement('tr');
			workspaceItem.innerHTML = `
                <td>${workspace.name}</td>
                <td>${workspace.description || '-'}</td>
                <td>${workspace.updatedAt}</td>
                <td>${workspace.backupAt || '-'}</td>
                    <td class="workspace-btn-group">
						<button class="btn btn-primary workspace-btn workspace-backup-btn">备份</button>
                        <button class="btn btn-warning workspace-btn workspace-edit-btn">修改</button>
                        <button class="btn btn-danger workspace-btn workspace-remove-btn">删除</button>
                        <button class="btn btn-success workspace-btn workspace-activate-btn">激活</button>
                    </td>
            `;
			workspaceTableBody.appendChild(workspaceItem);

			workspaceItem.querySelector('.workspace-edit-btn').addEventListener('click', () => this.#openEditWorkspaceModal_Modify(workspace.id));
			workspaceItem.querySelector('.workspace-remove-btn').addEventListener('click', () => this.openRemoveWorkspaceModal(workspace.id, workspace.name));
			workspaceItem.querySelector('.workspace-activate-btn').addEventListener('click', () => this.#enableWorkspace(workspace.id));
		});
	}

	/**
	 * 打开新建工作区模态框
	 */
	openEditWorkspaceModal_Create() {
		console.log("%c 打开新建工作区模态框", "color: #007bff; font-size: 16px; font-weight: bold;");
		this.#openEditModalType = 'create';
		this.#elements.workspaceNameInput.value = '';
		this.#elements.workspaceNameInput.focus();
		this.#elements.workspaceDescriptionInput.value = '';
		this.#elements.workspaceEditModalTitle.textContent = '新建工作区';
		this.#modals['workspace-edit-modal'].show();
	}

	/**
	 * 打开编辑工作区模态框
	 * @param {string} id - 工作区ID
	 */
	async #openEditWorkspaceModal_Modify(id) {
		try {
			this.#updateid = id;
			console.log("%c 打开编辑工作区模态框", "color: #007bff; font-size: 16px; font-weight: bold;");
			// 获取工作区详情
			const workspace = await this.#Repository_Workspace.getWorkspaceById(id);
			if (workspace) {
				this.#openEditModalType = 'modify';
				this.#elements.workspaceNameInput.value = workspace.name;
				this.#elements.workspaceDescriptionInput.value = workspace.description || '';
				this.#elements.workspaceEditModalTitle.textContent = '编辑工作区';
				// 显示模态框
				this.#modals['workspace-edit-modal'].show();
			}
		} catch (error) {
			console.error('Failed to load workspace for editing:', error);
			this.#showToast.error('加载工作区信息失败');
		}
	}

	/**
	 * 保存工作区
	 */
	async saveWorkspace() {
		try {
			let workspace = null;
			console.log("%c 保存工作区", "color: #007bff; font-size: 16px; font-weight: bold;", this);

			// 验证名称是否重复
			const name = this.#elements.workspaceNameInput.value.trim();
			const isNameExists = await this.#Repository_Workspace.isWorkspaceNameExists(
				name,
				this.#openEditModalType === 'modify' ? this.#updateid : null
			);

			if (isNameExists) {
				this.#showToast.error('工作区名称已存在');
				return false;
			}

			if (this.#openEditModalType === 'create') {
				console.log("%c 创建工作区", "color: #007bff; font-size: 16px; font-weight: bold;", name);
				workspace = new Entity_Workspace({
					id: crypto.randomUUID(),
					name: name,
					description: this.#elements.workspaceDescriptionInput.value.trim() || '',
					enabled: false
				});
				await this.#Repository_Workspace.saveWorkspace(workspace);
			} else if (this.#openEditModalType === 'modify') {
				const existingWorkspace = await this.#Repository_Workspace.getWorkspaceById(this.#updateid);
				if (existingWorkspace) {
					// 更新工作区属性
					existingWorkspace.name = name;
					existingWorkspace.description = this.#elements.workspaceDescriptionInput.value.trim() || '';
					await this.#Repository_Workspace.saveWorkspace(existingWorkspace);
					workspace = existingWorkspace;
				}
			}

			// 关闭模态框
			this.#modals['workspace-edit-modal'].hide();
			// 刷新工作区列表
			await this.loadAllWorkspaces();
			// 显示成功消息
			this.#showToast.success(workspace ? '工作区保存成功' : '工作区创建成功');

			// 触发保存回调
			this.#callbacks.onWorkspaceSaved?.(this.#openEditModalType, workspace);

			return workspace;
		} catch (error) {
			console.error('Failed to save workspace:', error);
			this.#showToast.error('保存工作区失败');
			return false;
		}
	}

	/**
	 * 启用工作区
	 * @param {string} id - 工作区ID
	 */
	async #enableWorkspace(id) {
		try {
			await this.#Repository_Workspace.enableWorkspace(id);
			// 刷新工作区列表
			await this.loadAllWorkspaces();

			// 显示成功消息
			this.#showToast.success('工作区启用成功');
			// 触发启用回调
			this.#callbacks.onWorkspaceEnabled?.(id);
		} catch (error) {
			console.error('Failed to enable workspace:', error);
			this.#showToast.error(error.message || '启用工作区失败');
		}
	}

	/**
	 * 准备删除
	 */
	openRemoveWorkspaceModal(id, name) {
		// 存储要删除的工作区ID
		this.#removeid = id;

		// 更新删除确认文本
		if (this.#elements.removeWorkspaceConfirmText) {
			this.#elements.removeWorkspaceConfirmText.textContent =
				`确定要删除工作区"${name}"吗？此操作不可撤销。`;
		}
		// 显示删除确认模态框
		this.#modals['remove-workspace-confirm-modal'].show();
	}

	openRemoveWorkspaceModalAgin() {

		this.#modals['remove-workspace-confirm-modal'].hide();

		// 更新删除确认文本
		if (this.#elements.removeWorkspaceConfirmTextAgin) {
			this.#elements.removeWorkspaceConfirmTextAgin.textContent =
				`这是一个高危操作，会清空该工作区下的所有数据，请再次确认！`;
		}

		// 显示删除确认模态框
		this.#modals['remove-workspace-confirm-modal-agin'].show();
	}

	/**
	 * 确认删除
	 */
	async confirmDelete() {
		try {

			if (this.#removeid === this.#workbenchData.currentWorkspace.id) {
				this.#showToast.error('无法删除当前启用的工作区，请先切换到其他工作区再删除！');
			} else {
				await this.#Repository_Workspace.deleteWorkspace(this.#removeid).then(async (deleted) => {
					this.#showToast.success('删除工作区成功');
				});
			}

			// 关闭删除模态框
			this.#modals['remove-workspace-confirm-modal-agin'].hide();
			// 刷新工作区列表
			await this.loadAllWorkspaces();

		} catch (error) {
			console.error('Failed to delete workspace:', error);
			this.#showToast.error('删除工作区失败');
			return false;
		}
	}

}

export default WorkspaceManager;