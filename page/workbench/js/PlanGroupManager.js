/**
 * 方案组管理器
 * 负责方案组的增删改查和数据导出等功能
 */
import { Entity_PlanGroup } from '../../../domain/Entity_PlanGroup.js';
import Integer from '../../../infrastructure/Integer.js';
import Decimal from '../../../infrastructure/decimal.mjs';
import { Repository_PlanGroup } from '../../../repository/Repository_PlanGroup.js';

class PlanGroupManager {
	// 方案组数据仓库
	#Repository_PlanGroup;
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

	// 所有方案组数据
	#allGroups = [];
	// 打开编辑模态框的类型，create 或 modify
	#openEditModalType = 'create';
	// 搜索关键词
	#searchKeyword = '';
	// 当前页码
	#currentPage = 1;
	// 每页显示数量,默认0，初始化的时候，一定会计算当前最佳每页显示数量。
	#pageSize = 0;
	// 总方案组数量
	#totalGroups = 0;
	// 窗口大小变化监听定时器
	#groupResizeTimeout = null;

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
		// 设置显示提示信息函数
		this.#showToast = showToast;
		// 初始化数据仓库
		this.#Repository_PlanGroup = new Repository_PlanGroup(this.#workbenchData.currentWorkspace?.id);
	}

	/**
	 * 初始化方案组管理器
	 */
	async initialize() {
		try {
			console.log('%c + plan group manager init start', 'color: green;font-weight: bold;', performance.now(),);
			// 计算并设置最佳的每页显示数量
			this.#calculateOptimalPageSize();
			// 初始化数据库
			await this.#Repository_PlanGroup.initDatabase();
			// 加载数据，一次加载，后续增删改查都是从内存中操作。同时同步更新indexedDB。
			await this.#loadAllPlanGroupMetas();
			// 初始化事件监听
			this.#initializeEventListeners();
			console.log('%c + plan group manager init success', 'color: green;font-weight: bold;', performance.now(),);
		} catch (error) {
			console.error('Failed to initialize plan group manager:', error);
			this.#showToast.error('方案组管理器初始化失败');
		}
	}

	/**
	 * 初始化事件监听
	 */
	#initializeEventListeners() {
		// 添加窗口大小变化监听，动态调整分页大小
		window.addEventListener('resize', this.#handleResizeGroup.bind(this));
		// 初始化分页事件监听
		this.#initPaginationEventListeners();
	}
	/**
	* 初始化分页事件
	*/
	#initPaginationEventListeners() {
		// 上一页按钮点击事件
		if (this.#elements.groupPrevPageBtn) {
			this.#elements.groupPrevPageBtn.addEventListener('click', (e) => {
				e.preventDefault();
				if (this.#currentPage > 1) {
					this.#currentPage--;
					this.#filterAndRenderGroups();
				}
			});
		}
		// 下一页按钮点击事件
		if (this.#elements.groupNextPageBtn) {
			this.#elements.groupNextPageBtn.addEventListener('click', (e) => {
				e.preventDefault();
				const totalPages = Math.ceil(this.#totalGroups / this.#pageSize);
				if (this.#currentPage < totalPages) {
					this.#currentPage++;
					this.#filterAndRenderGroups();
				}
			});
		}

		// 为页码按钮添加事件委托
		const paginationEl = this.#elements.groupPagination;
		if (paginationEl) {
			paginationEl.addEventListener('click', (e) => {
				if (e.target.closest('button.page-link') && !e.target.closest('li').classList.contains('disabled')) {
					const pageNum = parseInt(e.target.closest('button.page-link').dataset.page);
					if (!isNaN(pageNum)) {
						this.#currentPage = pageNum;
						this.#filterAndRenderGroups();
					}
				}
			});
		}
	}
	/**
	 * 开始搜索
	 * @param {string} keyword - 搜索关键词
	 */
	startSearch(keyword) {
		console.log("搜索关键词", keyword);
		this.#searchKeyword = keyword.trim();
		this.#currentPage = 1; // 重置到第一页
		this.#filterAndRenderGroups();
	}
	/**
	 * 计算最佳的每页显示数量
	 */
	#calculateOptimalPageSize() {
		const groupContent = this.#elements.groupContent;

		// 获取容器的计算样式，用于分析padding、border和margin
		const contentStyle = window.getComputedStyle(groupContent);
		const contentRect = groupContent.getBoundingClientRect();

		// 计算容器内部可用高度，考虑所有padding和border
		const contentPaddingTop = parseFloat(contentStyle.paddingTop);
		const contentPaddingBottom = parseFloat(contentStyle.paddingBottom);
		const contentBorderTop = parseFloat(contentStyle.borderTopWidth);
		const contentBorderBottom = parseFloat(contentStyle.borderBottomWidth);

		// 容器内部实际可用高度
		const innerContentHeight = contentRect.height - contentPaddingTop - contentPaddingBottom - contentBorderTop - contentBorderBottom;

		// 尝试获取实际项目的高度和margin（如果存在）
		let actualItemHeight = null;
		let itemMarginBottom = 0;
		let itemMarginTop = 0;
		const existingItem = document.querySelector('.group-item');

		if (existingItem) {
			const itemRect = existingItem.getBoundingClientRect();
			const itemStyle = window.getComputedStyle(existingItem);

			// 获取项目高度（包括padding和border）
			actualItemHeight = itemRect.height;
			// 获取项目的垂直margin
			itemMarginBottom = parseFloat(itemStyle.marginBottom);
			itemMarginTop = parseFloat(itemStyle.marginTop);
		}

		// 如果无法获取实际项目高度，使用更合理的估计值
		const estimatedItemHeight = actualItemHeight || 120;
		const estimatedTotalItemHeight = estimatedItemHeight + itemMarginTop + itemMarginBottom;

		// 计算最佳pageSize，考虑每个项目的完整高度（包括margin）
		let optimalPageSize = 0;
		if (estimatedTotalItemHeight > 0) {
			// 为最后一个项目的margin-bottom留出空间，或增加额外安全边距
			optimalPageSize = Math.floor(innerContentHeight / estimatedTotalItemHeight);
		}

		// 确保至少显示1个项目，最多不超过20个
		let newPageSize = Math.max(1, Math.min(optimalPageSize, 20));

		console.log(`详细分页计算: 容器总高度=${contentRect.height}, 内部可用高度=${innerContentHeight}, 项目高度=${estimatedItemHeight}, 项目总高度(含margin)=${estimatedTotalItemHeight}, 最终pageSize=${newPageSize}`);

		// 如果pageSize改变了，重置到第一页并重新渲染
		if (newPageSize !== this.#pageSize) {
			this.#pageSize = newPageSize;
			this.#currentPage = 1; // 重置到第一页
			console.log(`%c   + 最佳每页显示数量: ${newPageSize}`, 'color: darkorange ;font-weight: bold;');
			if (this.#allGroups?.length > 0) {
				this.#filterAndRenderGroups();
			}
		}
	}
	/**
	 * 处理窗口大小变化
	 */
	#handleResizeGroup() {
		// 清除之前的定时器
		if (this.#groupResizeTimeout) {
			clearTimeout(this.#groupResizeTimeout);
		}
		// 设置新的定时器，实现防抖
		this.#groupResizeTimeout = setTimeout(() => {
			console.log('%c + 窗口大小变化，触发分页计算', 'color: red ;font-weight: bold;', performance.now());
			this.#calculateOptimalPageSize();
		}, 500);
	}
	/**
	 * 加载所有方案组,其实是独立的方法，仅加载数据到this.#allGroups。
	 * 一个group大概 可能 也就几百字字节吧，撑死1k肯定够了。
	 * 1mb 四舍五入 1000个group，全量读没问题的。我不信真有人能用到1000个group。
	 */
	async #loadAllPlanGroupMetas() {
		try {
			const groups = await this.#Repository_PlanGroup.getAllPlanGroups();
			this.#allGroups = groups;
			this.#filterAndRenderGroups();
			return groups;
		} catch (error) {
			console.error('Failed to load groups:', error);
			this.#showToast.error('加载方案组失败');
			return [];
		}
	}

	/**
	 * 过滤并渲染方案组列表，目前是全量读，然后过滤this.#allGroups。
	 * 好处是可以过滤整个方案组的所有属性，而不仅仅是方案名称。
	 * 坏处是需要全量读。虽然一次性全部读到内存了。
	 * 好处是更快。不够gourp很小，哪怕1万个group也没多大。全量读到内存不是问题。而且好处还很多。
	 */
	#filterAndRenderGroups() {
		console.log("过滤前的group数量", this.#allGroups.length);

		// 根据搜索关键词过滤
		let filteredGroups = [...this.#allGroups];

		if (this.#searchKeyword) {
			const keyword = this.#searchKeyword.toLowerCase();
			filteredGroups = filteredGroups.filter(group =>
				group.name.toLowerCase().includes(keyword) ||
				(group.description && group.description.toLowerCase().includes(keyword))
			);
		}

		// 计算总数和总页数
		this.#totalGroups = filteredGroups.length;
		const totalPages = Math.ceil(this.#totalGroups / this.#pageSize);

		// 确保当前页码有效
		if (this.#currentPage > totalPages && totalPages > 0) {
			this.#currentPage = totalPages;
		}

		// 分页
		const startIndex = (this.#currentPage - 1) * this.#pageSize;
		const endIndex = startIndex + this.#pageSize;
		const pagedGroups = filteredGroups.slice(startIndex, endIndex);

		// 渲染列表
		this.#renderGroupsList(pagedGroups);

		// 更新分页信息
		this.#updatePagination(totalPages);
	}

	/**
	 * 更新分页信息
	 */
	#updatePagination(totalPages) {
		const paginationEl = this.#elements.groupPagination;
		const prevBtn = this.#elements.groupPrevPageBtn;
		const nextBtn = this.#elements.groupNextPageBtn;
		const pageInfoEl = this.#elements.groupPageInfo;
		const startItemEl = this.#elements.groupStartItem;
		const endItemEl = this.#elements.groupEndItem;
		const totalItemsEl = this.#elements.groupTotalItems;

		if (paginationEl) {
			// 只有当有多个页面时才显示分页
			if (totalPages > 1) {
				paginationEl.style.display = 'block';
			} else {
				paginationEl.style.display = 'none';
			}
		}

		// 更新页码信息
		if (pageInfoEl) {
			const startItem = this.#totalGroups > 0 ? (this.#currentPage - 1) * this.#pageSize + 1 : 0;
			const endItem = Math.min(this.#currentPage * this.#pageSize, this.#totalGroups);

			if (startItemEl) startItemEl.textContent = startItem;
			if (endItemEl) endItemEl.textContent = endItem;
			if (totalItemsEl) totalItemsEl.textContent = this.#totalGroups;
		}

		// 更新上一页和下一页按钮状态
		if (prevBtn) {
			prevBtn.classList.toggle('disabled', this.#currentPage <= 1);
			prevBtn.closest('.page-item').classList.toggle('disabled', this.#currentPage <= 1);
		}

		if (nextBtn) {
			nextBtn.classList.toggle('disabled', this.#currentPage >= totalPages || totalPages === 0);
			nextBtn.closest('.page-item').classList.toggle('disabled', this.#currentPage >= totalPages || totalPages === 0);
		}

		// 生成页码按钮
		this.#generatePageButtons(totalPages);
	}

	/**
	 * 生成页码按钮
	 */
	#generatePageButtons(totalPages) {
		const paginationList = this.#elements.groupPagination.querySelector('.pagination');
		if (!paginationList) return;

		// 保存上一页和下一页按钮
		const prevBtn = this.#elements.groupPrevPageBtn?.closest('li');
		const nextBtn = this.#elements.groupNextPageBtn?.closest('li');

		// 清空所有页码按钮，但保留上一页和下一页
		paginationList.innerHTML = '';
		if (prevBtn) paginationList.appendChild(prevBtn);

		// 生成页码按钮（简化版：显示当前页前后各1页，最多显示5页）
		let startPage = Math.max(1, this.#currentPage - 1);
		let endPage = Math.min(totalPages, startPage + 4);

		// 调整起始页码以确保显示足够的页面
		if (endPage - startPage < 4 && startPage > 1) {
			startPage = Math.max(1, endPage - 4);
		}

		// 添加省略号和第一页（如果需要）
		if (startPage > 1) {
			// 添加第一页
			const firstPageLi = document.createElement('li');
			firstPageLi.className = 'page-item';
			firstPageLi.innerHTML = `<button class="page-link" data-page="1">1</button>`;
			paginationList.appendChild(firstPageLi);

			// 添加省略号
			if (startPage > 2) {
				const ellipsisLi = document.createElement('li');
				ellipsisLi.className = 'page-item disabled';
				ellipsisLi.innerHTML = `<span class="page-link">...</span>`;
				paginationList.appendChild(ellipsisLi);
			}
		}
		// 添加页码按钮
		for (let i = startPage; i <= endPage; i++) {
			const pageLi = document.createElement('li');
			pageLi.className = `page-item ${i === this.#currentPage ? 'active' : ''}`;
			pageLi.innerHTML = `<button class="page-link" data-page="${i}">${i}</button>`;
			paginationList.appendChild(pageLi);
		}

		// 添加省略号和最后一页（如果需要）
		if (endPage < totalPages) {
			// 添加省略号
			if (endPage < totalPages - 1) {
				const ellipsisLi = document.createElement('li');
				ellipsisLi.className = 'page-item disabled';
				ellipsisLi.innerHTML = `<span class="page-link">...</span>`;
				paginationList.appendChild(ellipsisLi);
			}

			// 添加最后一页
			const lastPageLi = document.createElement('li');
			lastPageLi.className = 'page-item';
			lastPageLi.innerHTML = `<button class="page-link" data-page="${totalPages}">${totalPages}</button>`;
			paginationList.appendChild(lastPageLi);
		}

		if (nextBtn) paginationList.appendChild(nextBtn);
	}

	/**
	 * 渲染方案组列表
	 */
	#renderGroupsList(groups) {
		// 现在我们从DOM直接获取groups-list元素
		const groupsList = this.#elements.groupContent;
		console.log("左边渲染");
		if (!groupsList) return;

		// 清空列表
		groupsList.innerHTML = '';

		// 如果没有方案组，显示空状态
		if (groups.length === 0) {
			const emptyState = document.createElement('div');
			emptyState.className = 'text-center py-4 text-muted';

			// 根据是否有搜索关键词显示不同的空状态信息
			if (this.#searchKeyword) {
				emptyState.innerHTML = `
          <i class="bi bi-search display-3 mb-2"></i>
          <p>没有找到匹配的方案组</p>
          <p class="text-sm">请尝试其他关键词</p>
        `;
			} else {
				emptyState.innerHTML = `
          <i class="bi bi-folder2-open display-3 mb-2"></i>
          <p>暂无方案组，请点击"新建"按钮创建</p>
        `;
			}

			groupsList.appendChild(emptyState);
			return;
		}

		// 渲染每个方案组
		for (const group of groups) {
			const groupItem = document.createElement('div');
			groupItem.className = "group-item bg-gradient-to-r"
			groupItem.dataset.groupId = group.id;

			// 添加点击事件
			groupItem.addEventListener('click', () => this.#activeGroup(group.id));

			// 设置内容
			groupItem.innerHTML = `
              <h5 title="${group.name}">${group.name}</h5>
                <div class="group-meta d-flex flex-column align-items-end">
                    <span class="group-content-plan-count"><i class="bi bi-file-earmark-text"></i>
                        <span class="group-content-plan-count-num">${group.planCount.value}</span>个方案
                    </span>
                    <p><i class="bi bi-calendar3"></i>${group.updatedAt}</p>
                </div>
      `;

			groupsList.appendChild(groupItem);
		}

		// 缓存所有方案组项
		this.#elements.groupItem = Array.from(document.querySelectorAll('.group-item'));
	}

	/**
	 * 选择方案组
	 * @param {string} groupId - 方案组ID,ID是事件触发的元素的dataset.groupId传递的。是必须传递的，也是唯一来源。
	 * 否则，workbenchData.currentPlanGroup 永远是null。
	 */
	async #activeGroup(groupId) {
		try {
			console.log('%c   + activeGroup id ', 'color: #007bff;', groupId);

			// 加载方案组详情,不从内存读，防止内存数据过时。
			const group = await this.#Repository_PlanGroup.getPlanGroupById(groupId);
			if (group) {
				this.#workbenchData.currentPlanGroup = group;
				// 渲染方案组详情
				this.#renderGroupDetail();
				// 触发选择回调
				this.#callbacks.onActived?.();
				// 更新当前方案组的样式和数据。
				this.#updatecurrentPlanGroupDataAndStytle(group);
			}

			return group;
		} catch (error) {
			console.error('Failed to active group:', error);
			this.#showToast.error('选择方案组失败');
			return null;
		}
	}

	// 用来更新当前方案组的样式和数据。
	#updatecurrentPlanGroupDataAndStytle() {
		// 移除其他方案组的active类
		this.#elements.groupItem.forEach(item => {
			if (item.dataset.groupId !== this.#workbenchData.currentPlanGroup.id) {
				item.classList.remove('group-active');
			}
		});

		let currentPlanGroupItem = this.#elements.groupItem.find(item => item.dataset.groupId === this.#workbenchData.currentPlanGroup.id);
		if (currentPlanGroupItem) {
			currentPlanGroupItem.classList.add('group-active');
		}

	}

	/**
	* 渲染方案组详情
	*/
	#renderGroupDetail() {
		let group = this.#workbenchData.currentPlanGroup;
		if (!group) return;
		this.#elements.activeGroupName.textContent = group.name;
		this.#elements.activeGroupUpdatedAt.textContent = group.updatedAt;
		this.#elements.activeGroupPlanCount.textContent = group.planCount.value || '0';
		this.#elements.activeGroupDescription.textContent = group.description || '暂无描述';

		// 清空方案列表
		if (this.#elements.plansContainer) {
			this.#elements.plansContainer.innerHTML = `
        <div class="text-center py-5 text-muted">
          <p>该方案组暂无方案</p>
        </div>
      `;
		}

	}

	/**
	 * 打开新建方案组模态框
	 */
	openEditGroupModal_Create() {
		// 设置打开编辑模态框的类型为 create
		this.#openEditModalType = 'create';
		this.#elements.groupNameInput.value = '';
		this.#elements.groupNameInput.focus();
		this.#elements.groupDescriptionInput.value = '';
		this.#elements.groupEditModalTitle.textContent = '新建方案组';
		this.#modals['group-edit-modal'].show();
	}

	/**
	 * 打开编辑方案组模态框
	 */
	async openEditGroupModal_Modify() {
		try {
			console.log('%c   + openEditGroupModal id ', 'color: #007bff;', this.#workbenchData.currentPlanGroup.id);
			const group = await this.#Repository_PlanGroup.getPlanGroupById(this.#workbenchData.currentPlanGroup.id);
			if (group) {
				// 设置打开编辑模态框的类型为 modify
				this.#openEditModalType = 'modify';
				this.#elements.groupNameInput.value = group.name;
				this.#elements.groupDescriptionInput.value = group.description || '';
				this.#elements.groupEditModalTitle.textContent = '编辑方案组';

				this.#modals['group-edit-modal'].show();
			}
		} catch (error) {
			console.error('Failed to load group for editing:', error);
			this.#showToast.error('加载方案组信息失败');
		}
	}

	/**
	 * 保存方案组
	 */
	async saveGroup() {
		const { groupNameInput, groupDescriptionInput } = this.#elements;
		if (!groupNameInput) return;

		const groupName = groupNameInput.value.trim();
		if (!groupName) {
			this.#showToast.error('请输入方案组名称');
			groupNameInput.focus();
			return false;
		}

		try {
			// 如果是修改，那么修改的肯定是当前激活的方案组。也就是workbenchData.currentPlanGroup。
			// 但如果是新建，那么新建的肯定不是当前激活的方案组。也就不是workbenchData.currentPlanGroup。
			// 所有需要一个group来保存那个要保存的group对象。
			let group;

			// 验证名称是否重复
			const name = this.#elements.workspaceNameInput.value.trim();
			const isNameExists = await this.#Repository_PlanGroup.isPlanGroupNameExists(
				name,
				this.#openEditModalType === 'modify' ? this.#workbenchData.currentPlanGroup.id : null
			);
			if (isNameExists) {
				this.#showToast.error('方案组名称已存在');
				groupNameInput.focus();
				return false;
			}

			if (this.#openEditModalType === 'modify' && this.#workbenchData.currentPlanGroup.id) {
				// 更新现有方案组
				const existingGroup = await this.#Repository_PlanGroup.getPlanGroupById(this.#workbenchData.currentPlanGroup.id);
				if (existingGroup) {
					existingGroup.name = groupName;
					existingGroup.description = groupDescriptionInput?.value.trim() || '';
					await this.#Repository_PlanGroup.savePlanGroup(existingGroup);
					// 因为是更新，更新的一定是当前激活的方案组。所以这里将更新后的方案组赋值给workbenchData.currentPlanGroup。
					this.#workbenchData.currentPlanGroup = existingGroup;
					//由于修改必须是当前方案，那么一定是打开了当前方案的详情页，所以这里直接更新当前方案组的详情页。
					this.#renderGroupDetail();
				}
			} else {
				// 创建新方案组
				const newGroup = new Entity_PlanGroup({
					id: crypto.randomUUID(),
					name: groupName,
					description: groupDescriptionInput?.value.trim() || ''
				});
				// 保存新方案组
				await this.#Repository_PlanGroup.savePlanGroup(newGroup);
				group = newGroup;
			}

			// 关闭模态框
			this.#modals['group-edit-modal'].hide();
			// 刷新方案组列表
			await this.#loadAllPlanGroupMetas();
			// 显示成功消息
			this.#showToast.success(this.#openEditModalType === 'modify' ? '方案组更新成功' : '方案组创建成功');

			// 触发保存回调
			this.#callbacks.onSaved?.(group);

			return group;
		} catch (error) {
			console.error('Failed to save group:', error);
			this.#showToast.error('保存方案组失败');
			return false;
		}
	}

	/**
	 * 准备删除
	 */
	openRemoveGroupModal() {

		// 更新删除确认文本
		if (this.#elements.removeGroupConfirmText) {
			this.#elements.removeGroupConfirmText.textContent =
				`确定要删除方案组"${this.#workbenchData.currentPlanGroup.name}"吗？,该方案下一共有 ${this.#workbenchData.currentPlanGroup.planCount.value} 个方案，此操作不可撤销。`
		}

		// 显示删除确认模态框
		this.#modals['remove-group-confirm-modal'].show();
	}

	/**
	 * 确认删除
	 */
	async confirmDelete() {

		try {
			// 删除方案组，删除的一定是当前激活的方案组。也就是workbenchData.currentPlanGroup。
			await this.#Repository_PlanGroup.deletePlanGroup(this.#workbenchData.currentPlanGroup.id);
			// 关闭删除模态框
			this.#modals['remove-group-confirm-modal'].hide();
			// 刷新方案组列表
			await this.#loadAllPlanGroupMetas();
			// 显示成功消息
			this.#showToast.success('删除成功');
			// 触发删除回调
			this.#callbacks.onRemoved?.(this.#workbenchData.currentPlanGroup);

			// 清空当前激活的方案组,虽然删除之后，其他的地方可能也会清理。但是为了保险起见，直接再这里也清理一下。
			// 毕竟这里是源头。
			this.#workbenchData.currentPlanGroup = null;
			this.#workbenchData.currentPlan = null;

			return true;
		} catch (error) {
			console.error('Failed to delete:', error);
			this.#showToast.error('删除失败');
			return false;
		}
	}

	async updatePlanCount(delta) {
		const existingGroup = await this.#Repository_PlanGroup.getPlanGroupById(this.#workbenchData.currentPlanGroup.id);
		if (existingGroup) {
			existingGroup.planCount = existingGroup.planCount.plus(new Integer(delta));
			await this.#Repository_PlanGroup.savePlanGroup(existingGroup);
			// 因为是更新，更新的一定是当前激活的方案组。所以这里将更新后的方案组赋值给workbenchData.currentPlanGroup。
			this.#workbenchData.currentPlanGroup = existingGroup;

			//找到当前激活方案组的item元素
			const activeGroupElement = this.#elements.groupContent.querySelector(`[data-group-id="${this.#workbenchData.currentPlanGroup.id}"]`);
			if (activeGroupElement) {
				// 更新dom元素的计划数量
				activeGroupElement.querySelector('.group-content-plan-count-num').textContent = `${existingGroup.planCount.value}`;
			}
			this.#elements.activeGroupPlanCount.textContent = `${existingGroup.planCount.value}`;
		}
	}
}

export default PlanGroupManager;