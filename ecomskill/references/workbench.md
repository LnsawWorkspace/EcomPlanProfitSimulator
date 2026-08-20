# 工作台页（逻辑子模块）
> 本模块是 ecomskill 的逻辑子模块之一，公共规则见根目录 SKILL.md。

## 数据空间维护（重要）
数据空间是浏览器 IndexedDB 的物理库（一个空间 = 一个库，库名 = 空间 UUID），由系统目录库 `profitSimulation_systemDB` 登记。
站点本身**没有**备份 / 导入 / 体检能力，且存在多个源码级坑（如"备份时间"不可信、删除需双重确认、删库会被其他标签页阻塞等）。

- **机制与 SOP 详见：** `references/workspace.md`（含 list/doctor/create/rename/activate/export/import/delete/repair 命令示例、10 条源码级坑、红线）。
- **自动化脚本：** `scripts/workspace_ops.js`（Playwright 驱动真实 UI 做写操作、直连 IndexedDB 做备份/恢复/体检）。常用：
  - 体检：`node scripts/workspace_ops.js doctor`
  - 列表：`node scripts/workspace_ops.js list`
  - 备份：`node scripts/workspace_ops.js export --name "默认工作区"`
  - 修复：`node scripts/workspace_ops.js repair --confirm`（谨慎使用）

> 涉及数据空间的任何"非常规"操作（批量删除、跨设备迁移、损坏修复）前，先读 `references/workspace.md`，不要凭直觉在 UI 上直接点。

## 方案组维护（重要）
方案组是当前工作区库里 `planGroups` store 中的记录，归属靠 `planMetas.groupId` 关联，删组会级联删方案。站点只提供了左侧栏的新建/修改/删除/搜索 UI，没有批量或跨页查找能力。

- **机制与 SOP 详见：** `references/planGroups.md`（含 list/find/create/rename/delete 命令示例、6 条源码级坑——尤其"UI 重名校验误用工作区输入框导致守卫失效""修改/删除只作用于当前激活组""删除级联删方案"、红线）。
- **自动化脚本：** `scripts/plan_group_ops.js`（读/查找直连 IndexedDB 拿全量，写走真实 UI）。常用：
  - 列表：`node scripts/plan_group_ops.js list`
  - 查找：`node scripts/plan_group_ops.js find "关键词"`
  - 新建：`node scripts/plan_group_ops.js create "组名" "描述"`
  - 改名：`node scripts/plan_group_ops.js rename "组名|ID" "新组名" "新描述"`
  - 删除：`node scripts/plan_group_ops.js delete "组名|ID" --confirm`（级联删方案，高危）

> 涉及方案组的"非常规"操作（批量改名、跨工作区迁移、查找大批量）前，先读 `references/planGroups.md`。

## 方案维护（重要）
方案是当前工作区库里 `planMetas` store 中的记录，靠 `groupId` 关联到方案组；其参数在 `planParams` store（keyPath=方案 id，一对一）。**业务语义：一个方案 = 一条逻辑渠道**（自然流量/京东快车/汇川/淘宝客/直播等），各渠道退款率、售价、发货、赠品、费用都不同，**不能混在一个方案里**（参数一对一，混了报告失真）。**方案列表完全绑定"当前激活的方案组"**——必须先激活方案组才能看到/改到该组下的方案。删除方案**不会**级联删除参数（参数变孤儿）。

- **机制与 SOP 详见：** `references/planMetas.md`（含 list/find/create/rename/delete/params 命令示例、7 条源码级坑——尤其"强依赖激活方案组""名称按方案组作用域唯一""删除不级联参数留孤儿""时间格式误解""成功 toast 文案误导"、红线）。
- **自动化脚本：** `scripts/plan_meta_ops.js`（读/查找直连 IndexedDB 拿全量，写走真实 UI）。常用：
  - 列表：`node scripts/plan_meta_ops.js list`（加 `--group 组名|ID` 限定方案组）
  - 查找：`node scripts/plan_meta_ops.js find "关键词"`
  - 新建：`node scripts/plan_meta_ops.js create "方案名" "描述" --group "组名|ID"`
  - 改名：`node scripts/plan_meta_ops.js rename "方案名|ID" "新方案名" "新描述"`
  - 删除：`node scripts/plan_meta_ops.js delete "方案名|ID" --confirm`（参数不级联，高危）
  - 参数孤儿体检（只读）：`node scripts/plan_meta_ops.js params`

> 涉及方案的"非常规"操作（批量改名、清理孤儿参数、跨方案组迁移）前，先读 `references/planMetas.md`。

## 参数维护（重要）
参数是 `planParams` store 中与方案**一对一**的记录（keyPath=方案 id），由独立参数页（`/page/planParams/planParams.html`）填写。**参数页必须带 URL 三参数** `?workspaceId=&groupId=&planId=` 才能加载，缺一页面隐藏。数值一律 `{value, options}` 包装、百分比存 0-1 小数（页面输入 %）；目标单量避开 3/33/333 等全 3 数（除法 bug，报告页会卡死）。

- **机制与 SOP 详见：** `references/planParams.md`（含 list/get/raw/check/set 命令示例、8 条源码级坑——尤其"URL 三参数依赖""百分比 0-1 换算""{value,options} 包装""广告 name 空为 null""除法 bug"、红线）。
- **自动化脚本：** `scripts/plan_params_ops.js`（读/体检直连 IndexedDB，写走参数页 UI 复用站点校验）。常用：
  - 清单：`node scripts/plan_params_ops.js list`
  - 查看：`node scripts/plan_params_ops.js get "方案名|ID" --group "组名|ID"`
  - 体检：`node scripts/plan_params_ops.js check "方案名|ID"`（除法 bug 风险等）
  - 写参数：`node scripts/plan_params_ops.js set "方案名|ID" --sale-price 159 --quantity 3000 --group "组名|ID"`
  - 原始 JSON：`node scripts/plan_params_ops.js raw "方案名|ID"`

> 填/改参数前先读 `references/planParams.md`，尤其百分比方向（页面 % → 存储 0-1）与除法 bug 单量。

## 使用流程
1. 确认需要的数据空间正确，否则选择正确的数据空间，若需要的数据空间不存在，创建数据空间。
2. 确认需要的方案组选择正确，否则选择正确的方案组，若需要的方案组不存在，创建方案组。
3. 确认需要的方案存在，否则创建方案。

## 方案的按钮说明：
+ **复制方案：** 会深度拷贝一个方案出来。
+ **查看报告：** 进入报告查看页面，显示对应方案的报告。
+ **调整方案：** 进入方案参数页面，可对参数进行调整。
+ **修改基本信息：** 不跳转页面，而是弹出modal，修改方案的名称、描述

