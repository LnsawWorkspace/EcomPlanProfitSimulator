/**
 * 工作台页面的主类
 * 负责整合数据管理和视图控制
 */
import PlanGroupManager from './PlanGroupManager.js';
import PlanMetaManager from './PlanMetaManager.js';
import WorkspaceManager from './WorkspaceManager.js';
import LnsawTool from '../../../infrastructure/utils/LnsawTool.js';

class Workbench {
	// 空间管理
	#WorkspaceManager
	// 方案组管理
	#PlanGroupManager;
	// 方案管理
	#PlanMetaManager;
	#elements = {};
	#modals = {};
	#workbenchData = {
		currentWorkspace: null,
		currentPlanGroup: null,
		currentPlan: null,
	}
	#showToast = {};

	/**
	 * 构造函数
	 */
	constructor() {
		this.#setHeaderHeight()
	}

	/**
   * 初始化工作台
   */
	async initialize() {

		try {
			console.log('%c+ workbench init start', 'color: green;font-weight: bold;', performance.now(),);
			// 初始化提示信息函数
			this.#initializeShowToast();
			// 初始化DOM元素引用
			this.#initializeElements();
			// 初始化Bootstrap模态框
			this.#initializeModals();
			// 初始化工作区管理器
			this.#initializeWorkspaceManager();
			// 初始化工作区管理器
			await this.#WorkspaceManager.initialize();
			// 初始化方案组管理器
			this.#initializePlanGroupManager();
			// 初始化方案管理器
			this.#initializePlanMetaManager();
			// 初始化方案组管理器
			await this.#PlanGroupManager.initialize();
			// 初始化方案管理器
			await this.#PlanMetaManager.initialize();
			// 设置事件监听
			this.#initializeEventListeners();
			console.log('%c+ workbench init success', 'color: green;font-weight: bold;', performance.now(),);

			const navigationEntry = performance.getEntriesByType('navigation')[0];
			console.log('导航开始时间:', navigationEntry.startTime);
			console.log('DOMContentLoaded 事件触发时间:', navigationEntry.domContentLoadedEventStart);
			console.log('页面加载完成时间:', navigationEntry.loadEventStart);
		}
		catch (error) {
			console.error('Failed to initialize workbench:', error);
			alert('工作台初始化失败，请刷新页面重试-1');
		}
	}

	/**
	 * 将DOM元素转为DOM对象
	 */
	#initializeElements() {
		const elements_id = {
			createGroupBtn: 'create-group-btn',
			modifyGroupBtn: 'modify-group-btn',
			removeGroupBtn: 'remove-group-btn',
			saveGroupBtn: 'save-group-btn',
			removeGroupConfirmBtn: 'remove-group-confirm-btn',

			createPlanBtn: 'create-plan-btn',
			savePlanBtn: 'save-plan-btn',
			removePlanConfirmBtn: 'remove-plan-confirm-btn',



			//放方案组item的地方
			groupContent: 'group-content',
			// 搜索框
			groupSearchInput: 'group-search',
			planSearchInput: 'plan-search',
			workspaceSearchInput: 'workspace-search',
			// 分页控件
			groupPagination: 'group-pagination',
			// 页码信息
			groupPageInfo: 'group-page-info',
			groupStartItem: 'group-start-item',
			groupEndItem: 'group-end-item',
			groupTotalItems: 'group-total-items',
			groupPrevPageBtn: 'group-prev-page',
			groupNextPageBtn: 'group-next-page',

			// 右侧方案组详情
			groupDetail: 'group-detail',
			activeGroupName: 'active-group-name',
			activeGroupUpdatedAt: 'active-group-updated-at',
			activeGroupPlanCount: 'active-group-plan-count',
			activeGroupDescription: 'active-group-description',
			// 放方案的容器
			planContent: 'plan-content',

			// 方案组编辑模态框元素
			groupEditModalTitle: 'group-edit-modal-title',
			groupNameInput: 'group-name-input',
			groupDescriptionInput: 'group-description-input',
			// 方案编辑模态框元素
			planEditModalTitle: 'plan-edit-modal-title',
			planNameInput: 'plan-name-input',
			planDescriptionInput: 'plan-description-input',

			// 删除确认文本
			removeGroupConfirmText: 'remove-group-confirm-text',
			removePlanConfirmText: 'remove-plan-confirm-text',
			removeWorkspaceConfirmText: 'remove-workspace-confirm-text',
			removeWorkspaceConfirmTextAgin: 'remove-workspace-confirm-text-agin',

			//空间管理
			workspaceShowBtn: 'workspace-show-btn',
			workspaceCloseBtn: 'workspace-close-btn',
			workbenchContainer: 'workbench-container',
			workspaceContainer: 'workspace-container',

			createSpaceBtn: 'create-space-btn',
			workspaceTable: 'workspace-table',
			workspaceTableBody: 'workspace-table-body',

			// 空间编辑模态框元素
			workspaceEditModalTitle: 'workspace-edit-modal-title',
			workspaceNameInput: 'workspace-name-input',
			workspaceDescriptionInput: 'workspace-description-input',
			saveWorkspaceBtn: 'save-workspace-btn',

			removeWorkspaceConfirmBtn: 'remove-workspace-confirm-btn',
			removeWorkspaceConfirmBtnAgin: 'remove-workspace-confirm-btn-agin',

			currentWorkspaceName: 'current-workspace-name',

			// 空间管理
			storageQuota: 'storage-quota',
			storageUsed: 'storage-used',
			persistence: 'persistence',

		};
		const element_class = {

		};
		// 使用Object.entries和解构赋值
		for (const [key, id] of Object.entries(elements_id)) {
			this.#elements[key] = document.getElementById(id);
		}
		for (const [key, class_name] of Object.entries(element_class)) {
			this.#elements[key] = document.querySelectorAll(class_name);
		}
	}

	/**
	 * 初始化Bootstrap模态框
	 */
	#initializeModals() {
		// 使用Bootstrap 5的Modal类初始化所有模态框
		const modalIds = ['group-edit-modal', 'remove-group-confirm-modal', 'plan-edit-modal', 'remove-plan-confirm-modal',
			'workspace-edit-modal', 'remove-workspace-confirm-modal', 'remove-workspace-confirm-modal-agin'];



		for (const id of modalIds) {
			const element = document.getElementById(id);
			if (element) {
				this.#modals[id] = new bootstrap.Modal(element);

				element.addEventListener('hide.bs.modal', () => {
					//清理焦点
					document.activeElement.blur();
				});
			}
		}
	}

	/**
	 * 初始化提示信息函数
	 */
	#initializeShowToast() {
		this.#showToast = {
			success: (message) => LnsawTool.showToast(message, 'success'),
			warning: (message) => LnsawTool.showToast(message, 'warning'),
			error: (message) => LnsawTool.showToast(message, 'danger'),
			info: (message) => LnsawTool.showToast(message, 'info'),
		};
	}

	#initializeWorkspaceManager() {
		// 配置回调函数
		const callbacks = {
			onActived: (workspace) => {
				console.log('Workspace actived:', workspace);
			},
			onSaved: (workspace) => {
				console.log('Workspace saved:', workspace);
			},
			onRemoved: (workspace) => {
				console.log('Workspace removed:', workspace);
			},
			onWorkspaceEnabled: (workspace) => {
				// this.#hideGroupDetail();
				// this.#workbenchData.currentPlanGroup = null;
				// this.#workbenchData.currentPlan = null;
				// this.#closeWorkspace();
				// this.initialize();

				// 直接刷新页面，这样就不用手动GC，写什么destroy()之类的东西了。
				// destroy()太专业了，太复杂了，太容易漏掉了。
				location.reload();
			}
		};

		// 创建工作区管理器实例
		this.#WorkspaceManager = new WorkspaceManager({
			elements: this.#elements,
			modals: this.#modals,
			workbenchData: this.#workbenchData,
			callbacks: callbacks,
			showToast: this.#showToast,
		});
	}

	/**
	 * 初始化方案组管理器
	 */
	#initializePlanGroupManager() {
		// 配置回调函数
		const callbacks = {
			onActived: () => {
				// 其内部已经更新了workbenchData.currentPlanGroup
				// 由于切换了方案组，所以需要清除当前方案
				this.#workbenchData.currentPlan = null;
				if (this.#PlanMetaManager) {
					this.#PlanMetaManager.loadPlanMetasByGroup();
					this.#showGroupDetail();
				}
			},
			onSaved: (group) => {
			},
			onRemoved: (oldGroup) => {
				this.#PlanMetaManager.removeAll(oldGroup.id);
				this.#hideGroupDetail();
				this.#workbenchData.currentPlanGroup = null;
				this.#workbenchData.currentPlan = null;
			},
			onActiveCleared: (oldGroup) => {

			}
		};

		// 创建方案组管理器实例
		this.#PlanGroupManager = new PlanGroupManager({
			elements: this.#elements,
			modals: this.#modals,
			workbenchData: this.#workbenchData,
			callbacks: callbacks,
			showToast: this.#showToast,
		});
	}

	/**
	 * 初始化方案管理器
	 */
	#initializePlanMetaManager() {
		// 配置回调函数
		const callbacks = {
			onPlanActived: (plan) => {
			},
			onPlanSaved: (openEdityModalType, plan) => {
				if (openEdityModalType === 'create') {
					// GroupMeta.count++
					this.#PlanGroupManager.updatePlanCount(1);
				}
			},
			onPlanRemoved: (planId) => {
				console.log('Plan removed:', planId);
				this.#PlanGroupManager.updatePlanCount(-1);
			},
			onActivedCleared: () => {
			},
			toParams: (plan) => {
				// 打开参数编辑页面
				window.open(`/page/planParams/planParams.html?workspaceId=${this.#workbenchData.currentWorkspace.id}&groupId=${this.#workbenchData.currentPlanGroup.id}&planId=${plan.id}`, '_blank');
			},
			toReport: (plan) => {
				// 打开参数编辑页面
				window.open(`/page/planReport/planReport.html?workspaceId=${this.#workbenchData.currentWorkspace.id}&groupId=${this.#workbenchData.currentPlanGroup.id}&planId=${plan.id}`, '_blank');
			},
		};

		// 创建方案管理器实例
		this.#PlanMetaManager = new PlanMetaManager({
			elements: this.#elements,
			modals: this.#modals,
			workbenchData: this.#workbenchData,
			callbacks: callbacks,
			showToast: this.#showToast,
		});
	}

	/**
	 * 设置事件监听
	 */
	#initializeEventListeners() {
		// 使用Map和forEach优化事件监听设置
		const clickListeners = new Map([
			['createGroupBtn', () => this.#PlanGroupManager.openEditGroupModal_Create()],
			['modifyGroupBtn', () => this.#PlanGroupManager.openEditGroupModal_Modify()],
			['removeGroupBtn', () => this.#PlanGroupManager.openRemoveGroupModal()],
			['saveGroupBtn', () => this.#PlanGroupManager.saveGroup()],
			['removeGroupConfirmBtn', () => this.#PlanGroupManager.confirmDelete()],

			['createPlanBtn', () => this.#PlanMetaManager.openEditPlanModal_Create()],
			['removePlanBtn', () => this.#PlanMetaManager.openRemovePlanModal()],
			['savePlanBtn', () => this.#PlanMetaManager.savePlanMeta()],
			['removePlanConfirmBtn', () => this.#PlanMetaManager.confirmDelete()],

			// 空间管理
			['workspaceShowBtn', () => this.#showWorkspace()],
			['workspaceCloseBtn', () => this.#closeWorkspace()],
			['createSpaceBtn', () => this.#WorkspaceManager.openEditWorkspaceModal_Create()],
			['removeSpaceBtn', () => this.#WorkspaceManager.openRemoveWorkspaceModal()],
			['saveWorkspaceBtn', () => this.#WorkspaceManager.saveWorkspace()],
			['removeWorkspaceConfirmBtn', () => this.#WorkspaceManager.openRemoveWorkspaceModalAgin()],
			['removeWorkspaceConfirmBtnAgin', () => this.#WorkspaceManager.confirmDelete()],

		]);

		for (const [elementKey, handler] of clickListeners) {
			this.#elements[elementKey]?.addEventListener('click', handler);
		}

		// 监听搜索框输入事件
		this.#elements.groupSearchInput?.addEventListener('input', (e) => {
			this.#PlanGroupManager.startSearch(e.target.value.trim());
		});
		// 监听搜索框输入事件
		this.#elements.planSearchInput?.addEventListener('input', (e) => {
			this.#PlanMetaManager.startSearch(e.target.value.trim());
		});
		// 监听搜索框输入事件
		this.#elements.workspaceSearchInput?.addEventListener('input', (e) => {
			this.#WorkspaceManager.startSearch(e.target.value.trim());
		});



		// 监听窗口大小变化，动态调整内容区域高度
		window.addEventListener('resize', () => {
			this.#setHeaderHeight();
		});
	}

	// 其实不是设置header标签的高度，而是设置--header-height变量的值
	#setHeaderHeight() {
		//计算header标签的高度
		const headerHeight = document.querySelector('header').offsetHeight;
		document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
	}
	#showWorkspace() {
		//隐藏 workbench-container
		this.#elements.workbenchContainer.classList.add('d-none');
		//显示 workspace-container
		this.#elements.workspaceContainer.classList.remove('d-none');

		this.#WorkspaceManager.requestPersistence();
	}
	#closeWorkspace() {
		//隐藏 workspace-container
		this.#elements.workspaceContainer.classList.add('d-none');
		//显示 workbench-container
		this.#elements.workbenchContainer.classList.remove('d-none');
	}
	#showGroupDetail() {
		// 显示groupDetail
		if (this.#elements.groupDetail) {
			//显示div
			this.#elements.groupDetail.style.display = 'flex';
		}
	}
	#hideGroupDetail() {
		this.#workbenchData.currentPlanGroup = null;
		this.#workbenchData.currentPlan = null;
		// 隐藏groupDetail
		if (this.#elements.groupDetail) {
			//隐藏div
			this.#elements.groupDetail.style.display = 'none';
		}
	}
}

// 页面加载完成后初始化工作台
window.addEventListener('DOMContentLoaded', async () => {
	try {
		// 创建并初始化工作台
		const workbench = new Workbench();
		await workbench.initialize();

		// 将工作台实例暴露到全局，方便调试
		window.workbench = workbench;
	} catch (error) {
		console.error('Failed to initialize workbench:', error);
		alert('工作台初始化失败，请刷新页面重试-2');
	}
});