---
name: ecomskill
description: "全场景单品推演"网站（https://ecomplanprofitsimulator.lnsaw.com）的总入口 SKILL。当用户要求使用/操作该网站（利润推演、建方案、填参数、看报告、敏感性分析），或提到 ecomplan、利润推演、单品利润模拟、方案组/方案/工作区/数据空间，或需要对数据空间做新建、切换、重命名、体检、修复等维护操作，或对方案组/方案/参数做新建/删除/修改/查找等管理操作时，使用本技能。
agent_created: false
---

# Ecomplanprofitsimulator（全场景单品推演 · 总入口）

## 页面导航
+ workspaceId 是指**用户数据空间** ID，groupId 是指方案组 ID，planId 是指方案 ID。他们都是 GUID。
+ **数据空间 ≠ 系统库（极易混淆，先看清这层）**：本站点有两类"库"——
  ① `profitSimulation_systemDB` 是站点内置的**系统目录库**（类比 SQL Server 的 `master`），内部使用、不面向用户、不存用户数据，只登记各用户工作区的信息，**它不是数据空间**；
  ② 每个 workspaceId 对应一个**用户 IndexedDB 库**（含 `planGroups`/`planMetas`/`planParams`/`system` 四个 store，其中 `system` store 是该库内部的系统 store，类比 SQL Server 的 `sys`，记录本库其他 store 的元信息、非用户数据）。
  维护细节与红线见 `references/workspace.md` §1。
+ 除了首页、工作台，其他页面都可以通过在页面URL+?workspaceId=xxx&groupId=yyy&planId=zzz 来直接访问。但前提是需要知道 workspaceId/groupId/planId，否则会报错。若不知道 workspaceId/groupId/planId，可以先访问工作台页面，找到对应的方案组/方案，点击"调整方案"按钮进入参数页，或点击"查看报告"按钮进入报告页。
### 首页
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/
+ **说明：** 这里是首页，但是通常不需要访问首页，可以直接访问工作台页面。
### 工作台
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/workbench/workbench.html
+ **说明：** 数据空间/方案组/方案的增删改查，是核心页面。
### 数据空间（概念 + 维护）
+ **不是独立页面**，而是浏览器 IndexedDB 的物理库：一个空间 = 一个 IndexedDB 库（库名 = 空间 UUID），由系统目录库 `profitSimulation_systemDB` 登记元信息。
+ **维护文档：** `references/workspace.md`——底层机制、UI 行为真相（如删除需双重确认、删库会被其他标签页阻塞等 9 个源码级坑）、以及 list/doctor/create/rename/activate/delete/repair 的 SOP。
+ **维护脚本：** `scripts/workspace_ops.js`——用 Playwright 驱动真实 UI 做写操作，直接读 IndexedDB 做体检，规避站点缺失的体检能力。命令见文档。
### 方案（概念 + 维护）
+ **业务语义：一个方案 = 一条逻辑渠道（流量/销售渠道）**，如 自然流量、京东快车、汇川、淘宝客、XX直播、YY直播。各渠道的退款率/售价/发货/赠品/费用支出都不同，**不能混在一个方案里**——宁可多建方案，不要混渠道（参数一对一的，混了报告就失真）。
+ **不是独立页面**，而是工作台里的数据对象：一个方案属于某个**方案组**（靠 `groupId` 关联），存于当前工作区库的 `planMetas` store；其参数存于同库的 `planParams` store（keyPath=方案 id，一对一，是方案的"兄弟"而非子表）。
+ **方案列表完全绑定"当前激活的方案组"**：必须先激活方案组，才看得到/改得到该组下的方案。
+ **维护文档：** `references/planMetas.md`——数据模型、`planMetas` 字段表、UI 元素清单、新建/修改/删除/查找真实行为、7 个源码级坑（强依赖激活组、按组作用域唯一性、删除不级联参数留孤儿、时间格式误解、空名被拒、成功 toast 文案误导等）、SOP 与红线。
+ **维护脚本：** `scripts/plan_meta_ops.js`——复用 workspace/方案组脚本的 Playwright+IndexedDB 直连骨架；写操作走真实 UI，读/查找直连 IndexedDB；删除高危需 `--confirm`；内置只读 `params` 命令审计"删方案后参数变孤儿"。命令见文档。
### 参数页
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/planParams/planParams.html
+ **说明：** 填参数（售价/单量/退款率/商品/赠品/支出），由工作台"调整方案"按钮打开新标签。**必须带 URL 参数 `?workspaceId=&groupId=&planId=` 才能加载**（缺一页面隐藏显示"方案不存在"）。
+ **注意：** 因涉及到各种除法，可能存在某种参数组合下，导致出现因除法出现bug的情况导致UI一直加载不出来。目前发现主要受到方案参数中的目标单量字段影响，比如当目标单量=3、33、333、3333等之类的时候发生的概率非常大，其他参数目前还没发现。另外目标单量尽可能的大于10，最好是10的倍数。
+ **维护文档：** `references/planParams.md`——数据模型（8 个模型字段、`{value,options}` 包装、百分比存 0-1）、真实行为（保存/加载/校验/除法 bug）、SOP 与红线。
+ **支出项目样例：** `extension/expense-checklist.md`——每单/部分订单/固定支出的常见项目、成本类型与税率速查（填参数时参考）。
+ **维护脚本：** `scripts/plan_params_ops.js`——list/get/raw/check/set：读走 IndexedDB，写走参数页 UI（复用站点校验）。命令见文档。
### 报告页
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/planReport/planReport.html
+ **说明：** 查看利润报告、6 个敏感性分析图，由参数页"保存并查看报告"按钮打开新标签。
### 敏感性分析图
**注意：** 敏感性分析图需要大量计算，因此打开后可能需要耐心等待，尤其是双变量扫描图（ROI+销售额、ROI+销售量）。另外在调整敏感性分析的参数时，**必须预估计算量，尽可能的将计算量控制在10000内。**，否则图表不会更新。
#### Roi 敏感性分析图
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/planReport/planReportRoiGraph.html
+ **说明：** 单变量扫描 ROI，重计算利润。由报告页"ROI 敏感性分析"按钮打开新标签。
#### Sale 敏感性分析图
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/planReport/planReportSaleGraph.html
+ **说明：** 单变量扫描 销售额，重计算利润。由报告页"销售额敏感性分析"按钮打开新标签。
#### Volume 敏感性分析图
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/planReport/planReportVolumeGraph.html
+ **说明：** 单变量扫描 销售量，重计算利润。由报告页"销售量敏感性分析"按钮打开新标签。
#### SaleVolume 敏感性分析图
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/planReport/planReportSaleVolumeGraph.html
+ **说明：** 双变量扫描 销售额+销售量，重计算利润。由报告页"销售额+销售量敏感性分析"按钮打开新标签。
+ **注意：** 该页面极慢，需要耐心等待。1万点位约需30-40s。
#### RoiSale 敏感性分析图
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/planReport/planReportRoiSaleGraph.html
+ **说明：** 双变量扫描 ROI+销售额，重计算利润。由报告页"ROI+销售额敏感性分析"按钮打开新标签。
+ **注意：** 该页面极慢，需要耐心等待。1万点位约需30-40s。
#### RoiVolume 敏感性分析图
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/planReport/planReportRoiVolumeGraph.html
+ **说明：** 双变量扫描 ROI+销售量，重计算利润。由报告页"ROI+销售量敏感性分析"按钮打开新标签。
+ **注意：** 该页面极慢，需要耐心等待。1万点位约需30-40s。

## 逻辑模块（按需加载对应文件）
| 模块 | 详情文件 | 用途 |
|------|---------|------|
| 工作台 | `references/workbench.md` | 数据空间/方案组/方案 CRUD |
| 方案组维护 | `references/planGroups.md` | 方案组 新建/删除/修改/查找 的真实行为、源码级坑、SOP，配套脚本 `scripts/plan_group_ops.js` |
| 方案维护 | `references/planMetas.md` | 方案 新建/删除/修改/查找 的真实行为、源码级坑、SOP，配套脚本 `scripts/plan_meta_ops.js` |
| 参数维护 | `references/planParams.md` | 方案参数（售价/单量/退款/商品/赠品/费用/广告）数据模型、真实行为、除法 bug、SOP，配套脚本 `scripts/plan_params_ops.js` |
| 数据空间维护 | `references/workspace.md` | 数据空间底层机制、UI 行为真相、体检/修复 SOP（备份由用户自行负责），配套脚本 `scripts/workspace_ops.js` |
| 参数页 | `references/planParams.md` | 方案参数填写 |
| 报告页 | `references/planReport.md` | 利润报告解读 |
| 分析图 | `references/graphs.md` | 6 个敏感性分析图 |