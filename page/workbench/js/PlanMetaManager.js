/**
 * 方案管理器
 * 负责方案的增删改查和数据管理等功能
 */
import { Entity_PlanMeta } from '../../../domain/Entity_PlanMeta.js';
import { Repository_PlanMeta } from '../../../repository/Repository_PlanMeta.js';

class PlanMetaManager {
	// 使用ES2025私有字段
	#Repository_PlanMeta;
	#openEdityModalType = 'create';
	#elements = {};
	#modals = {};
	#workbenchData = {};
	#callbacks = {};
	#showToast = {};
	#allPlans = [];

	#updatePlanId = null;
	#removePlanId = null;
	#searchKeyword = '';

	/**
	 * 构造函数
	 * @param {Object} options - 配置选项
	 * @param {Object} options.elements - DOM元素引用映射
	 * @param {Object} options.modals - Bootstrap模态框实例映射
	 * @param {Object} options.callbacks - 回调函数映射
	 */
	constructor({ elements = {}, modals = {}, workbenchData = {}, callbacks = {}, showToast = {} }) {
		// 设置DOM元素引用
		this.#elements = elements;
		// 设置模态框实例
		this.#modals = modals;
		// 设置工作台数据
		this.#workbenchData = workbenchData;
		// 设置回调函数
		this.#callbacks = callbacks;
		// 设置toast函数
		this.#showToast = showToast;
		// 初始化数据仓库
		this.#Repository_PlanMeta = new Repository_PlanMeta(this.#workbenchData.currentWorkspace?.id);
	}

	/**
	 * 初始化方案管理器
	 */
	async initialize() {
		try {
			console.log('%c  plan init start', 'color: #00ff00', performance.now());
			// 初始化数据库
			await this.#Repository_PlanMeta.initDatabase();
			return true;
		} catch (error) {
			console.error('Failed to initialize plan manager:', error);
			this.#showToast.error('方案管理器初始化失败');
			return false;
		}
	}

	/**
	 * 加载指定方案组的所有方案
	 * 这个同时也算是入口，选择一个方案后
	 * 就会调用这个方法，来试图获取所有方案。
	 */
	async loadPlanMetasByGroup() {
		try {
			// 直接从PlanMetaRepository获取方案,毕竟，这个是打开方案详情时候触发的，而打开详情的时候，已经把相关是数据放到workbenchData了。
			const plans = await this.#Repository_PlanMeta.getPlanMetasByGroupId(this.#workbenchData.currentPlanGroup.id);
			if (this.#elements.planContent) {
				// 排序
				plans.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
				this.#allPlans = plans;
				// 渲染
				this.#filterAndRenderGroups();
			}
			return plans;
		} catch (error) {
			console.error('Failed to load plans:', error);
			this.#showToast.error('加载方案失败');
			return [];
		}
	}

	#filterAndRenderGroups() {
		// 根据搜索关键词过滤
		let filteredPlanMeta = [...this.#allPlans];

		if (this.#searchKeyword) {
			const keyword = this.#searchKeyword.toLowerCase();
			filteredPlanMeta = filteredPlanMeta.filter(group =>
				group.name.toLowerCase().includes(keyword) ||
				(group.description && group.description.toLowerCase().includes(keyword))
			);
		}

		// 渲染列表
		this.#renderPlansList(filteredPlanMeta);
	}

	startSearch(key) {
		console.log('search keyword:', key);
		this.#searchKeyword = key;
		this.#filterAndRenderGroups();
	}

	/**
	 * 渲染方案列表
	 */
	#renderPlansList(filteredPlanMeta) {
		const { planContent } = this.#elements;
		if (!planContent) return;

		// 清空列表
		planContent.innerHTML = '';

		filteredPlanMeta.forEach(plan => {
			// 创建方案卡片元素
			const planItem = document.createElement('div');
			planItem.className = 'plan-item';
			planItem.innerHTML = `
			<div class="plan-item-header">
				<h3 class="plan-item-name">${plan.name}</h3>
			</div>
			<div class="plan-item-updatedat">
				更新时间：${plan.updatedAt}
			</div>
			<p class="plan-item-description">${plan.description}</p>

			<div class="plan-item-actions">
				<button class="plan-action-btn plan-view-btn" title="查看报告">
					<i class="bi bi-file-earmark-bar-graph"></i>
				</button>
				<button class="plan-action-btn plan-to-params-btn" title="调整方案">
					<i class="bi bi-sliders"></i>
				</button>
				<button class="plan-action-btn plan-edit-btn" title="修改基本信息">
					<i class="bi bi-pencil-square"></i>
				</button>
				<button class="plan-action-btn plan-delete-btn" title="删除方案">
					<i class="bi bi-trash"></i>
				</button>
			</div>
			`;
			planContent.appendChild(planItem);

			// //绑定事件
			planItem.querySelector('.plan-edit-btn').addEventListener('click', () => this.#openEditPlanModal_Modify(plan.id));
			planItem.querySelector('.plan-delete-btn').addEventListener('click', () => this.#openRemovePlanModal(plan.id, plan.name));

			planItem.querySelector('.plan-to-params-btn').addEventListener('click', () => this.#callbacks.toParams(plan));
			planItem.querySelector('.plan-view-btn').addEventListener('click', () => this.#callbacks.toReport(plan));
		});
	}

	/**
	 * 选择方案,ID是通过事件传递过来的。可以查看点击事件绑定的位置。（就在这个文档里边。在一个渲染的方法里。）
	 */
	async activePlan(planId) {
		try {
			// 直接从PlanMetaRepository获取方案详情
			this.#workbenchData.currentPlan = await this.#Repository_PlanMeta.getPlanById(planId);

			if (plan) {
				// 触发选择回调
				this.#callbacks.onPlanActived?.();
			}
			return plan;
		} catch (error) {
			console.error('Failed to select plan:', error);
			this.#showToast.error('选择方案失败');
			return null;
		}
	}

	/**
	 * 打开新建方案模态框
	 */
	openEditPlanModal_Create() {
		if (!this.#workbenchData.currentPlanGroup) {
			this.#showToast.error('请先选择一个方案组');
			return;
		}

		this.#openEdityModalType = 'create';
		this.#elements.planNameInput.value = '';
		this.#elements.planNameInput.focus();
		this.#elements.planDescriptionInput.value = '';
		this.#elements.planEditModalTitle.textContent = '新建方案';
		this.#modals['plan-edit-modal'].show();
	}

	/**
	 * 打开编辑方案模态框
	 * 这个还没到呢。这个。。是不是修改当前 很难搞啊。不一定是修改当前 再说，现在还没到修改这一步呢
	 * 新建 筛选 查询后的渲染  还没完事呢
	 * 对了 修改的按钮多了去了，可不是只有一个，所以，，这个修改是内部渲染时候创建的事件。
	 * 包括 删除等都内部渲染时候绑定是事件，所以，一定需要id。如果是这样的话。。保存。。保存
	 * 如果是编辑（修改），那么保存就需要提供修改的那个方案。
	 * 如果是新建。那么等于传递的参数是null
	 */
	async #openEditPlanModal_Modify(planId) {
		try {
			this.#updatePlanId = planId;
			console.log("%c 打开编辑方案模态框", "color: #007bff; font-size: 16px; font-weight: bold;");
			// 直接从PlanMetaRepository获取方案
			const plan = await this.#Repository_PlanMeta.getPlanMetaById(planId);
			if (plan) {
				this.#openEdityModalType = 'modify';
				this.#elements.planNameInput.value = plan.name;
				this.#elements.planDescriptionInput.value = plan.description || '';
				this.#elements.planEditModalTitle.textContent = '编辑方案';
				// 显示模态框
				this.#modals['plan-edit-modal'].show();
			}
		} catch (error) {
			console.error('Failed to load plan for editing:', error);
			this.#showToast.error('加载方案信息失败');
		}
	}

	/**
	 * 保存方案
	 */
	async savePlanMeta() {
		try {
			let plan = null;
			console.log("%c 保存方案", "color: #007bff; font-size: 16px; font-weight: bold;");
			if (this.#openEdityModalType === 'create') {
				plan = new Entity_PlanMeta({
					id: crypto.randomUUID(),
					groupId: this.#workbenchData.currentPlanGroup.id,
					name: this.#elements.planNameInput.value,
					description: this.#elements.planDescriptionInput.value || '',
					enabled: false
				})
				await this.#Repository_PlanMeta.savePlanMeta(plan);
			} else if (this.#openEdityModalType === 'modify') {
				// 先查，然后改，然后保存，用EF core 的那种方式。
				// 得考虑考虑，修改未必是当前激活的方案。除非能确定激活相关的环节。
				const existingPlan = await this.#Repository_PlanMeta.getPlanMetaById(this.#updatePlanId);
				if (existingPlan) {
					// 更新方案属性
					existingPlan.name = this.#elements.planNameInput.value;
					existingPlan.description = this.#elements.planDescriptionInput.value || '';
					await this.#Repository_PlanMeta.savePlanMeta(existingPlan);
					this.#workbenchData.currentPlan = existingPlan;
					plan = existingPlan;
				}
			}

			// 关闭模态框
			this.#modals['plan-edit-modal'].hide();
			// 刷新方案列表
			await this.loadPlanMetasByGroup();
			// 显示成功消息
			this.#showToast.success(plan.name ? '方案更新成功' : '方案创建成功');

			// 触发保存回调
			this.#callbacks.onPlanSaved?.(this.#openEdityModalType, plan);

			return plan;
		} catch (error) {
			console.error('Failed to save plan:', error);
			this.#showToast.error('保存方案失败');
			return false;
		}
	}

	/**
	 * 准备删除
	 */
	#openRemovePlanModal(id, name) {
		// 存储要删除的方案ID
		this.#removePlanId = id;

		// 更新删除确认文本
		if (this.#elements.removePlanConfirmText) {
			this.#elements.removePlanConfirmText.textContent =
				`确定要删除方案"${name}"吗？此操作不可撤销。`
		}

		// 显示删除确认模态框
		this.#modals['remove-plan-confirm-modal'].show();
	}

	/**
	 * 确认删除
	 */
	async confirmDelete() {
		try {
			// 直接从PlanMetaRepository删除方案
			const deleted = await this.#Repository_PlanMeta.deletePlanMeta(this.#removePlanId);
			this.#removePlanId = null;
			if (deleted) {
				// 触发清空选中回调
				this.#callbacks.onActivedCleared?.();
			}

			// 关闭删除模态框
			this.#modals['remove-plan-confirm-modal'].hide();
			// 刷新方案列表
			await this.loadPlanMetasByGroup();
			// 显示成功消息
			this.#showToast.success('删除成功');

			// 触发删除回调
			this.#callbacks.onPlanRemoved?.(deleted);



			return true;
		} catch (error) {
			console.error('Failed to delete:', error);
			this.#showToast.error('删除失败');
			return false;
		}
	}

	async removeAll(groupId) {
		try {
			// 直接从PlanMetaRepository删除方案
			const deleted = await this.#Repository_PlanMeta.deletePlanMetasByGroupId(groupId);
			if (deleted) {
				// 触发清空选中回调
				this.#callbacks.onActivedCleared?.();
			}
		} catch (error) {
			console.error('Failed to delete:', error);
			this.#showToast.error('删除失败');
			return false;
		}
	}
}

export default PlanMetaManager;