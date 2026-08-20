# 方案组（PlanGroup）管理（逻辑子模块）

> 本模块是 ecomskill 的逻辑子模块之一，公共规则见根目录 `Skill.md`；数据空间的增删改查见 `workspace.md`，方案/参数的日常 CRUD 见 `workbench.md`。
> 本文所有结论均来自 2026-08-20 对线上源码的逐行核对（PlanGroupManager.js / Repository_PlanGroup.js / Entity_PlanGroup.js / workbench.js / workbench.html）+ 真机实测。
> 配套脚本：`scripts/plan_group_ops.js`（站点自身只有方案组 CRUD 的 UI，没有批量/查找能力，脚本把"查找/列全量"做成直连 IndexedDB，"新建/修改/删除"驱动真实 UI）。

---

## 1. 心智模型

```
当前启用的【用户工作区】库（库名 = 工作区 UUID）
├── planGroups   (store, keyPath=id)  ← 本模块管理的对象：方案组
├── planMetas    (store)              ← 方案（归属某个 planGroup，靠 groupId 关联）
├── planParams   (store)              ← 方案参数
└── system       (store, 内部)         ← 本库内部系统 store，勿动
```

- 方案组是工作区里的**第一级容器**：一个工作区里可以有多个方案组，一个方案组里可以有多个方案（planMeta）。
- 方案组数据**不在** `profitSimulation_systemDB`（系统目录库）里，而在**当前工作区自己的 IndexedDB 库**的 `planGroups` store 中。
- 方案组的"归属"完全靠字段关联：`planMetas.groupId` 指向 `planGroups.id`。没有外键约束，删组不自动删方案（见 §5 坑 3）。

### 记录字段（planGroups store，原始存储形态，经 Entity_Base.toSerializable 序列化）

| 字段 | 类型/格式 | 说明 |
|------|-----------|------|
| `id` | UUID | 主键 |
| `name` | string | 方案组名，**同一工作区内唯一**（站点强制校验，见 §5 坑 1） |
| `description` | string | 可空 |
| `createdAt` / `updatedAt` | `YYYY-MM-DD HH:mm:ss` 本地时间 | 建/改时间（与 workspace 同格式；`to_yyyymmdd_hhmmss` 函数名有误导性，实际带分隔符） |
| `planCount` | Integer 对象 | 形如 `{value: N, options: {...}}`；显示用 `.value`。由站点在增删方案时自维护，不要把玩它 |

---

## 2. UI 元素清单（自动化定位用，均已实测）

入口：工作台左侧方案组栏。

| 元素 | 选择器 | 备注 |
|------|--------|------|
| 新建按钮 | `#create-group-btn` | 文字「新建」 |
| 修改按钮 | `#modify-group-btn` | 文字「修改」；**只对"当前激活的方案组"生效** |
| 删除按钮 | `#remove-group-btn` | 文字「删除」；**只对"当前激活的方案组"生效** |
| 保存 | `#save-group-btn` | 新建/修改共用 |
| 列表容器 | `#group-content` | 动态生成 `.group-item`，`dataset.groupId = 组id` |
| 搜索框（左侧方案组栏） | `#group-search` | 实时过滤方案组的 name+description（大小写不敏感、含子串），过滤在内存里做；**只搜方案组，不搜方案**（方案的搜索框是右侧的 `#plan-search`） |
| 编辑弹窗 | `#group-edit-modal`（`.show` 表示已弹出） | 标题 `#group-edit-modal-title`：「新建方案组」/「编辑方案组」 |
| 名称 / 描述输入 | `#group-name-input` / `#group-description-input` | placeholder：`请输入方案组名称` |
| 删除确认弹窗 | `#remove-group-confirm-modal`（`.show`） | 文案 `#remove-group-confirm-text` 含组名与方案数 |
| 删除确认按钮 | `#remove-group-confirm-btn` | 点这个才真正执行删除（无二次确认，只有一步） |
| 当前组详情 | `#active-group-name` 等 | 激活某组后填充；未激活时显示占位「方案组详情」 |
| 顶栏空间名 | `#current-workspace-name` | 页面就绪判据；也表明当前操作落在哪个工作区 |

关键 toast 文案（判断成败的依据）：
- `方案组创建成功` / `方案组更新成功` / `删除成功`
- `保存方案组失败`（真实失败，常因名称重复——见坑 1）/ `请输入方案组名称`（名称为空）/ `加载方案组失败`（初始化失败）

---

## 3. 四个基本操作的真实行为

| 操作 | 路径 | 隐藏行为（必须知道） |
|------|------|---------------------|
| 新建 | 「新建」→ 填名/描述 → 保存 | 名称重复直接失败；建完即出现在左侧列表，planCount=0 |
| 修改（改名/改描述） | 先点列表里的组激活它 →「修改」→ 改 → 保存 | **必须先激活目标组**；改的永远是"当前激活组" |
| 删除 | 先点列表里的组激活它 →「删除」→ 确认 | **必须先激活目标组**；确认后删组 + **级联删该组下全部方案**（靠回调 `PlanMetaManager.removeAll`） |
| 查找 | 在 `#group-search` 输入关键词 | 内存过滤 name+description，含子串、大小写不敏感；UI 列表有分页（pageSize 动态 1~20） |

> ⚠️ 修改/删除的"目标"是**当前激活组**，不是你在搜索框里敲的字。脚本（`plan_group_ops.js`）会自动先把目标组点出来激活，再操作，避免点错组。

---

## 4. 维护 SOP（用 `scripts/plan_group_ops.js`）

运行前提：**浏览器常驻模式**——首次运行自动启动带调试端口(9222)的 Edge 并保持打开，后续命令直接连接复用（不反复开关浏览器）；需要收尾时加 `--close` 真正关闭。若已有 Edge 带 `--remote-debugging-port=9222` 在跑，脚本直接连进去操作。playwright 装在托管 node workspace 里。脚本默认操作**当前启用的工作区**，可用 `--workspace <名称|ID>` 指定别的工作区（非当前会先切换并 reload）。

```bash
cd <本技能目录>/scripts
export NODE_PATH="<托管 node workspace>/node_modules"   # 托管 node 路径见脚本头注释（运行环境）
N="<托管 node 可执行文件>"

"$N" plan_group_ops.js list                                  # 列出当前工作区全部方案组（绕过分页，读 IndexedDB 全量）
"$N" plan_group_ops.js find "关键词"                           # 按名称/描述模糊查找
"$N" plan_group_ops.js count                                  # 方案组数量
"$N" plan_group_ops.js create "组名" "描述"                     # 新建（走 UI）
"$N" plan_group_ops.js rename "组名|ID" "新组名" "新描述"        # 修改（走 UI）
"$N" plan_group_ops.js delete "组名|ID" --confirm              # 删除（高危，级联删方案；需 --confirm）
# 指定工作区：
"$N" plan_group_ops.js --workspace "默认工作区" list
```

所有命令最后一行输出 `RESULT: {json}`，程序化解析取这一行即可；加 `--json` 只留这一行。

### 4.1 查找（find）
- 工作台有**两个搜索框，各管各的**，不要混用：
  - **左侧方案组栏**：`#group-search` —— 只搜**方案组**（匹配方案组的 name/description，内存过滤、含子串、大小写不敏感；列表有分页 pageSize 动态 1~20）。
  - **右侧方案列表**：`#plan-search` —— 只搜**方案**（匹配方案的 name/description，见 `planMetas.md`；**必须先激活某个方案组才出现/生效**）。
- 脚本 `plan_group_ops.js find` / `list` 直接读 `planGroups` store 全量，不受分页与渲染影响，更适合"按 ID 精确定位"或"在大批量里检索"。
- `find <关键词>` 与左侧搜索逻辑一致：名称或描述含子串、大小写不敏感。
- **搜索边界（重要）**：方案组模块的搜索（UI `#group-search` 或脚本 find）**只匹配方案组自身的 `name` / `description` 两个字段**，**不会**搜方案（`planMetas`）的任何信息——方案名、方案描述、方案 ID 都不会被命中。要找"哪个方案组下有某方案"，须**两步**：先用方案模块 `plan_meta_ops.js find "<方案关键词>"` 拿到方案的 `groupId`，再回方案组模块用该 ID/名称定位组。不要在方案组 find 里搜方案名，结果必为 0；反之，方案搜索框（`#plan-search`）也搜不到方案组。

### 4.2 新建 / 修改 / 删除（走 UI 的原因）
- 与数据空间同理：站点没有方案组的导入/导出/批量接口，写操作必须复用 UI 以拿到站点的名称唯一校验与级联删除。
- 脚本在写前会**自校验名称唯一性**（因为站点的 UI 重名校验有 bug，见 §5 坑 1），并区分"成功 toast"与"失败 toast"给出清晰报错。

---

## 5. 源码级坑（全部已核对/实测）

1. **站点 UI 层的"方案组重名校验"用了错误的输入框**（PlanGroupManager.saveGroup 第 575 行）。
   → 它拿的是 `workspaceNameInput`（**工作区弹窗**的 `#workspace-name-input`），不是方案组的 `#group-name-input`。
   → 后果：UI 层"方案组名称已存在"这个守卫**实质失效**（校验的是工作区名，几乎永远不冲突）。
   → 真正的唯一性由 `Repository_PlanGroup.savePlanGroup` 拦截，但被 manager 的 catch 兜底成通用的 **"保存方案组失败"** toast——不是友好的"名称已存在"。
   → 应对：脚本在写前自己读 `planGroups` 比对名称，重复时直接给"名称已存在"报错；若仍收到"保存方案组失败"，提示多半是名称重复。

2. **修改/删除只作用于"当前激活的方案组"**（`workbenchData.currentPlanGroup`）。
   → 列表是渲染出来的 `.group-item`，点一下才激活。脚本会先按 `data-group-id` 把目标组点出来激活，再点修改/删除。
   → UI 列表有**分页**（pageSize 动态 1~20，按容器高度算），目标组可能不在当前页——脚本先用搜索框过滤让目标渲染出来，再点击，规避分页。

3. **UI 删除会级联删方案**（workbench.js 的 `onRemoved` 回调调 `PlanMetaManager.removeAll(groupId)`）。
   → 所以通过 UI/脚本删除方案组，**该组下的方案（planMetas/planParams）也会被删**。
   → 但如果你**绕过 UI**直接删 `planGroups` 记录（比如手动清 IndexedDB），方案不会跟着删，会留下孤儿方案（其 `groupId` 指向已删的组）——`workspace_ops.js doctor` 的 `orphan-plan` 即检测这个。
   → 结论：删组请走 UI/脚本（带级联），不要直删记录。

4. **时间格式**：方案组 `createdAt/updatedAt` 与工作区一样都是 `YYYY-MM-DD HH:mm:ss`——别被 `DateTimeUtils.to_yyyymmdd_hhmmss` 这个 misleading 的函数名骗了，它实际输出带分隔符。比对脚本按统一格式处理即可。

5. **planCount 是对象不是数字**：存储形态约为 `{value: N, options: {...}}`，显示用 `.value`。脚本读全量时会归一化成数字方便看，但**不要**手动改它——它由站点在新建/删除方案时自维护（`updatePlanCount`）。

6. **空名称会被拒**：名称为空时 toast「请输入方案组名称」，保存不执行。脚本要求 `create` 必须带名称。

---

## 6. 红线（不要做）

- **不要** 直接改 `planCount` 或手写 `planGroups` 记录去"移动/合并"方案组——方案靠 `groupId` 关联，手工改容易造出孤儿方案或脏计数。要挪方案先想清楚级联。
- **不要** 绕过 UI 直接 `deleteDatabase`/删 `planGroups` 记录来做"删除"——会留下孤儿方案（见坑 3）。
- **不要** 以为搜索框能跨工作区查找——它只搜当前工作区内的方案组。
- **不要** 在方案组搜索（UI `#group-search` 或 `plan_group_ops.js find`）里找方案——它只匹配方案组的 name/description，方案信息永远搜不到（见 §4.1）。

---

## 7. 溯源

线上源码（2026-08-20 抓取核对）：
`page/workbench/js/PlanGroupManager.js`、`page/workbench/js/workbench.js`、`page/workbench/workbench.html`、
`repository/Repository_PlanGroup.js`、`domain/Entity_PlanGroup.js`、`domain/Entity_Base.js`、`repository/db/DBFactory.js`
