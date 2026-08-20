# 方案（PlanMeta）维护

> 配套脚本：`scripts/plan_meta_ops.js`
> 数据全在浏览器 IndexedDB，无后端/账号/API。下面所有结论均来自源码核对
> （`PlanMetaManager.js` / `Repository_PlanMeta.js` / `Repository_PlanParams.js` / `Entity_PlanMeta.js` / `Entity_PlanParams.js` / `workbench.js`）。

## 1. 心智模型

```
profitSimulation_systemDB          ★系统目录库（system，站点内置、内部使用，类比 SQL Server 的 master）
└─ 每个工作区 = 一个 IndexedDB 库（库名 = 工作区 id，由 systemDB.workspaces 登记）
   ├─ planGroups  方案组（靠 groupId 关联方案）
   ├─ planMetas   方案 ★本文件主角★（keyPath=id；靠 groupId 关联方案组）
   ├─ planParams  参数（keyPath=方案 id，一对一；是方案的"兄弟"，不随方案删除而删）
   └─ system      本库内部系统 store（勿动）
```

- **方案（planMetas）** 属于某个**方案组（planGroup）**，靠 `groupId` 关联；方案组又属于某个**工作区**。
- **参数（planParams）** 与方案是"兄弟"关系，不是子表：`planParams` 的 `id` 直接复用方案的 `id`，一对一。删除方案时参数**不**自动删除 → 孤儿。
- 导航链路：`工作区 → 方案组（须激活）→ 方案`。方案列表只渲染"当前激活方案组"下的方案。

### 业务语义：一个方案 = 一个逻辑渠道（重要）

> 这条决定"怎么建方案、建几个"，是使用层面最核心的约定，务必先理解再动手。

- **一个方案 = 一条逻辑渠道（流量/销售渠道）**，例如：`自然流量`、`京东快车`、`汇川`、`淘宝客`、`XX直播`、`YY直播`……方案是"渠道"的载体，不是"产品"的载体。
- **不同逻辑渠道的经营参数完全不同，因此不能混在一个方案里**：
  - 退款率不同（如直播冲动消费退款高，快车/自然流量相对低）
  - 售价不同（同款商品不同渠道定价策略不同）
  - 发货/赠品策略不同（直播带赠品、淘宝客走佣金、快车按广告位……）
  - 各项费用支出不同（渠道佣金、广告费、固定费用、单均费用……）
- 参数是一对一的（一个方案一套 `planParams`）：把两个渠道混进一个方案，参数必然失真，利润报告和 6 个敏感性分析图全部跟着失真——**宁可多建方案，不要混渠道**。
- 方案组的定位：方案组是"业务的文件夹/分类"。常见做法是**同一产品线 → 一个方案组，组内按渠道各建一个方案**（如"吹风机"组下：自然流量 / 京东快车 / 直播 各一个方案）。方案组管归属，方案管渠道。
- 命名建议：方案名体现渠道，如 `京东快车-主推款`、`自然流量-日常款`、`淘宝客-清仓款`、`XX直播-冲量款`。

### planMetas 字段表

| 字段 | 类型 | 说明 | 备注 |
|------|------|------|------|
| `id` | string(UUID) | 方案唯一标识，keyPath | `crypto.randomUUID()` 生成 |
| `groupId` | string(UUID) | 外键，关联到方案组 | `stringIsStandardUUID` 校验，必须有 |
| `name` | string | 方案名称 | 必填；非空且非纯空白；**同方案组内唯一** |
| `description` | string | 方案描述 | 可空，默认 `''` |
| `enabled` | boolean | 是否启用 | 默认 `false` |
| `createdAt` | string | 创建时间 | 格式 `YYYY-MM-DD HH:mm:ss`（来自 `Entity_Base.to_yyyymmdd_hhmmss`，函数名 misleading 但实际带分隔符；与工作区/方案组同格式） |
| `updatedAt` | string | 更新时间 | 同上格式；改名/改描述时刷新 |

### planParams 字段（仅供了解，运维脚本只读审计）

`id`（= 方案 id）、`createdAt`/`updatedAt`、`entityModelVersion`，以及 8 个模型字段：`modelPlanParamsSale` / `Refund` / `Goods` / `Gift` / `ExpensePerOrder` / `ExpenseMNPerOrder` / `ExpenseFixed` / `Advertising`。**没有 `groupId` 字段**，所以孤儿参数无法直接反查原方案组。

## 2. UI 元素清单（workbench）

| 用途 | 选择器 |
|------|--------|
| 新建方案按钮 | `#create-plan-btn` |
| 方案名称输入 | `#plan-name-input` |
| 方案描述输入 | `#plan-description-input` |
| 保存（新建/修改共用） | `#save-plan-btn` |
| 编辑模态框 | `#plan-edit-modal`（标题 `#plan-edit-modal-title`：新建="新建方案" / 修改="编辑方案"） |
| 方案列表容器 | `#plan-content`（每项 `.plan-item`，含 `.plan-item-name`、`.plan-edit-btn`、`.plan-delete-btn`、`.plan-to-params-btn` 等） |
| 方案搜索框（右侧方案列表，实时过滤） | `#plan-search` | 只搜**方案**的 name/description；**需先激活某方案组才出现/生效**；搜不到方案组（方案组用左侧 `#group-search`） |
| 删除确认模态框 | `#remove-plan-confirm-modal`（文案 `#remove-plan-confirm-text`、确认按钮 `#remove-plan-confirm-btn`） |
| 激活方案组依赖 | `.group-item[data-group-id=...]`、`#active-group-name`（详情面板，占位"方案组详情"） |

**toast 文案**：新建/修改成功 → `方案更新成功`（注意源码 ternary 写反，create/modify 都显示这条）；删除成功 → `删除成功`；失败通用 → `保存方案失败` / `删除失败`；未选方案组新建 → `请先选择一个方案组`。

## 3. 四个基本操作（真实行为）

| 操作 | 触发 | 真实行为 | 校验 |
|------|------|----------|------|
| 新建 | `#create-plan-btn` → 填表 → `#save-plan-btn` | `new Entity_PlanMeta({id, groupId: currentPlanGroup.id, name, description, enabled:false})` → `savePlanMeta` | 必须**已激活方案组**；名称非空；**同组内名称唯一** |
| 修改 | 某方案 `.plan-edit-btn` → 改 → `#save-plan-btn` | 按 `#updatePlanId` 查出旧方案，改 `name`/`description` 后保存 | 名称非空；同组内新名称唯一（排除自身） |
| 删除 | 某方案 `.plan-delete-btn` → `#remove-plan-confirm-btn` | `deletePlanMeta(id)`，仅删 `planMetas` | 无级联；**参数变孤儿** |
| 查找/列举 | — | 脚本直连 IndexedDB 读 `planMetas`（全量，绕开 UI 渲染） | — |

> 方案列表**无分页**（一次渲染组内全部），但脚本仍建议用 `#plan-search` 过滤后精确匹配，避免同名歧义。

## 4. 维护 SOP（bash 示例）

```bash
# 路径
NODE="C:/Users/wamzm/.workbuddy/binaries/node/versions/22.22.2/node.exe"
MODS="C:/Users/wamzm/.workbuddy/binaries/node/workspace/node_modules"
SK="$HOME/.workbuddy/skills/ecomskill/scripts"
RUN="NODE_PATH=\"$MODS\" \"$NODE\" \"$SK/plan_meta_ops.js\""

# 列举全部方案（跨方案组）；加 --group <名称|ID> 可限定某组
$RUN list
$RUN list --group "智能吹风机-阿澈演示"

# 查找（名称/描述子串，大小写不敏感）
$RUN find "吹风机"

# 数量
$RUN count --group "连衣裙-定价对比"

# 新建（必须指定方案组，或用页面当前激活组）
$RUN create "双11冲刺方案" "备注说明" --group "智能吹风机-阿澈演示"

# 修改（按 ID 或名称定位，自动激活其所属方案组）
$RUN rename "双11冲刺方案" "双11终极方案" "改了备注"

# 删除（高危，需 --confirm；参数不级联）
$RUN delete "双11终极方案"          # 先打印将删除的内容，需确认
$RUN delete "双11终极方案" --confirm

# 参数孤儿体检（只读）
$RUN params
```

## 5. 源码级坑（务必注意）

1. **强依赖激活方案组**：新建方案时 `openEditPlanModal_Create` 检查 `currentPlanGroup`，无则直接 toast「请先选择一个方案组」且不弹窗。脚本在写前自动激活目标 `--group`。
2. **名称唯一性按方案组作用域**：`Repository.isPlanMetaNameExists(groupId, name, excludeId)` 只在**同一方案组**内查重，跨组允许同名。撞重名时 Repository 抛「方案名称已存在」被 Manager catch 成通用「保存方案失败」，信息不直观——脚本写前自校验并给清晰报错。
3. **删除不级联参数**：`confirmDelete` 只删 `planMetas`；`planParams` 的 `deletePlanParams` 从未被 `PlanMetaManager` 调用。删整个方案组（`removeAll`）同理只删 metas。→ 长期运行后 `planParams` 会积累孤儿记录，用 `params` 命令审计。
4. **时间格式 `YYYY-MM-DD HH:mm:ss`**：来自 `Entity_Base.to_yyyymmdd_hhmmss`（函数名 misleading，实际输出带分隔符）。`Entity_PlanMeta.js` 的 DTO 注释写的 `YYYY-MM-DD HH:mm:ss` 是**对的**——别被函数名骗了。工作区 / 方案组 / 方案三者时间戳格式完全一致。
5. **空名称被拒**：`Entity_PlanMeta` 的 `name` setter 走 `stringNotEmptyAndWhitespace`，空名会抛错、UI 显示「保存方案失败」。脚本写前自校验非空。
6. **成功 toast 文案误导**：`savePlanMeta` 末尾 `plan.name ? '方案更新成功' : '方案创建成功'` 因 `plan.name` 恒真，create 与 modify **都显示「方案更新成功」**。脚本一律以"读回 IndexedDB 校验"为准，不依赖 toast 文字。
7. **`enabled` 默认 false**：新建方案默认未启用；脚本不改此项（如需启用请走真实 UI 或后续扩展）。

## 6. 红线

- 写操作一律走真实 UI（复用站点校验），**不要**直接 `put` 进 IndexedDB 的 `planMetas`（会绕过唯一性/激活依赖，破坏一致性）。
- 删除方案高危，必须 `--confirm`；且牢记**参数不级联**，删前最好先用 `params` 评估孤儿影响。
- `profitSimulation_systemDB`（系统目录库）只用于定位工作区库名，**不要**把它当工作区去列/备/删/导方案。
- 浏览器为**常驻模式**：首次运行自动拉起（带 CDP 端口 9222），后续命令直接复用；默认不关闭，收尾用 `--close` 真正关闭浏览器进程。

## 7. 溯源

- 实体/仓储：`domain/Entity_PlanMeta.js`、`domain/plan/Entity_PlanParams.js`、`repository/Repository_PlanMeta.js`、`repository/Repository_PlanParams.js`
- 管理器/页面：`page/workbench/js/PlanMetaManager.js`、`page/workbench/js/workbench.js`、`page/workbench/workbench.html`
- 基础：`domain/Entity_Base.js`（时间格式、`toSerializable`）
