# 数据空间（Workspace）维护（逻辑子模块）

> 本模块是 ecomskill 的逻辑子模块之一，公共规则见根目录 `Skill.md`；方案组/方案的日常 CRUD 见 `workbench.md`。
> 本文所有结论均来自 2026-08-20 对线上源码的逐行核对 + 真机全链路实测（create→rename→activate→export→import→delete→doctor 全部跑通）。
> 配套脚本：`scripts/workspace_ops.js`（站点自身没有备份/导入/体检能力，只能靠它）。

---

## 1. 心智模型：一个【用户】数据空间 = 一个 IndexedDB 数据库（外加一个系统目录库统管所有工作区）

```
浏览器 origin (ecomplanprofitsimulator.lnsaw.com)
├── profitSimulation_systemDB  ★系统目录库（system）★ ← 站点内置、内部使用，类比 SQL Server 的 master；不面向用户、不存用户数据，只登记"其他库"（各用户工作区）的信息
│   └── workspaces (store)              ← 每条记录 = 一个【用户工作区】的元信息（id 即该工作区的库名 UUID）
└── <workspaceId>  (库名 = 该工作区的 UUID) ← 每个【用户数据空间】一个独立库
    ├── planGroups   方案组
    ├── planMetas    方案（名称/描述/所属组）
    ├── planParams   方案参数（推演输入的全部字段）
    └── system       ★本库内部的 system store★（内部使用，类比 SQL Server 的 sys；记录本库其他 store 的元信息，实测为空，非用户数据，勿动）
```

> **⚠ 系统目录库（system） vs 用户工作区——务必分清**
> - `profitSimulation_systemDB` 是**站点内置、内部使用的系统目录库**，类比 SQL Server 的 `master`/`system` 库。**它不是用户工作区、不存任何用户数据**，只登记"其他库"（即各个用户工作区 UUID 库）的元信息。
> - 维护时把它当**只读目录**看待：脚本只读取它的 `workspaces` 记录来枚举/定位工作区；**绝不**把它当作一个工作区去 list / export / delete / backup。
> - 每个用户工作区库内部还有一个 `system` **store**（store，不是库），同样是内部使用（类比 SQL Server 的 `sys`），记录本库其他 store 的元信息，实测为空、非用户数据、勿动。

- 数据空间是**顶层物理隔离**：不同空间的数据在不同数据库里，互不可见，也无法跨空间引用。
- 同一时刻**只有一个空间处于启用（enabled）状态**，就是顶栏「当前空间：xxx」。工作台/参数页/报告页读写的都是它。
- 一切数据只在**本浏览器 + 本 profile 的 IndexedDB** 里。没有后端、没有账号、没有云同步、没有 HTTP API。换浏览器/换设备/清 cookie（会连带清 IndexedDB）= 数据全丢。

### 记录字段（systemDB.workspaces，原始存储形态）

| 字段 | 类型/格式 | 说明 |
|------|-----------|------|
| `id` | UUID | 主键，**同时就是该空间的 IndexedDB 库名** |
| `name` | string | 空间名，**全局唯一**（站点强制校验） |
| `description` | string | 可空 |
| `createdAt` / `updatedAt` | `YYYY-MM-DD HH:mm:ss` 本地时间 | 建/改时间 |
| `enabled` | boolean | 是否为当前空间，全局只应有一个 true |
| `backupAt` | 同上 / null | 备份时间，**站点自己从不写、读的时候还会丢掉它**（见 §5 坑 2） |
| `deleteing` | boolean | 注意站点拼错了（不是 deleting）。删库失败时置 true |

### 库的创建时机（很容易误判为 bug）

新建空间时**只写 systemDB 记录，不建库**。只有该空间被**激活**、工作台随后初始化 `PlanGroupManager` / `PlanMetaManager` 时，才会创建那个 UUID 库。
所以「记录存在 + 库不存在」是**正常状态**（= 新建后从未用过），不要当成数据丢失去"修复"。

---

## 2. UI 元素清单（自动化定位用，均已实测）

入口：工作台顶栏 `#workspace-show-btn`（按钮文字「数据空间」）→ 面板 `#workspace-container` 去掉 `d-none` 显示；关闭 `#workspace-close-btn`。

| 元素 | 选择器 | 备注 |
|------|--------|------|
| 当前空间徽章 | `#current-workspace-name` | 文本形如 `当前空间：默认工作区`，**延迟 50ms 才填充**，页面就绪判据 |
| 新建按钮 | `#create-space-btn` | 文字「新建」 |
| 搜索框 | `#workspace-search` | 只在前端过滤 name/description，大小写不敏感 |
| 列表 | `#workspace-table-body tr` | 列顺序：名称、描述、更新时间、备份时间、操作 |
| 行内按钮 | `.workspace-edit-btn` / `.workspace-remove-btn` / `.workspace-activate-btn` | 文字：修改 / 删除 / 激活 |
| 编辑弹窗 | `#workspace-edit-modal`（`.show` 表示已弹出） | 标题 `#workspace-edit-modal-title` 会在「新建工作区 / 编辑工作区」间切换 |
| 名称 / 描述输入 | `#workspace-name-input` / `#workspace-description-input` | placeholder：`请输入工作区名称` |
| 保存 | `#save-workspace-btn` | |
| 删除一次确认 | `#remove-workspace-confirm-modal` → `#remove-workspace-confirm-btn` | 文案含空间名 |
| 删除二次确认 | `#remove-workspace-confirm-modal-agin` → `#remove-workspace-confirm-btn-agin` | **点这个才真正执行删除** |
| 存储信息 | `#storage-quota` / `#storage-used` / `#persistence` | 打开面板时调 `navigator.storage.persist()` + `estimate()` 现算 |
| 提示 toast | `.toast-container .toast.text-bg-{success,danger} .toast-body` | autohide **2s**，轮询会漏，要用 MutationObserver |

关键 toast 文案（判断成败的依据）：`工作区保存成功` / `工作区名称已存在` / `工作区启用成功` / `删除工作区成功` / `无法删除当前启用的工作区，请先切换到其他工作区再删！` / `数据库删除被阻塞，请关闭所有连接后重试！`

---

## 3. 四个基本操作的真实行为

| 操作 | 路径 | 隐藏行为（必须知道） |
|------|------|---------------------|
| 新建 | 面板 →「新建」→ 填名/描述 → 保存 | 名称重复直接失败（danger toast）；**建完不激活、也不建库** |
| 改名/改描述 | 行内「修改」→ 改 → 保存 | 只改 systemDB 记录，不动库；新名同样要求唯一 |
| 激活（切换当前空间） | 行内「激活」 | 先把其它空间 `enabled` 逐条回写为 false，再置自己为 true；成功后**直接 `location.reload()`**（自动化必须等导航完成再断言） |
| 删除 | 行内「删除」→ 确认 → **二次确认** | 当前启用空间被拦截；执行 `indexedDB.deleteDatabase(空间id)`，成功后才删 systemDB 记录 |

---

## 4. 维护 SOP（用 `scripts/workspace_ops.js`）

运行前提：**浏览器常驻模式**——首次运行自动启动带调试端口(9222)的 Edge 并保持打开，后续命令直接连接复用（不反复开关浏览器）；需要收尾时加 `--close` 真正关闭。若已有 Edge 带 `--remote-debugging-port=9222` 在跑，脚本直接连进去操作。playwright 装在托管 node workspace 里。

```bash
cd C:/Users/wamzm/.workbuddy/skills/ecomskill/scripts
export NODE_PATH="C:/Users/wamzm/.workbuddy/binaries/node/workspace/node_modules"
N="C:/Users/wamzm/.workbuddy/binaries/node/versions/22.22.2/node.exe"

"$N" workspace_ops.js list                       # 清单：启用态 / 组数 / 方案数 / 有无库 / 最近备份 / ID
"$N" workspace_ops.js doctor                     # 体检：孤儿库、多启用、删除残留、引用完整性、配额、持久化
"$N" workspace_ops.js create "空间名" "描述"       # 新建（不激活）
"$N" workspace_ops.js rename "旧名|ID" "新名" "新描述"
"$N" workspace_ops.js activate "空间名|ID"        # 切换当前空间（内部会等 reload）
"$N" workspace_ops.js export all                 # 备份全部（默认 D:/wokrbudd/ecomplan-backups）
"$N" workspace_ops.js export "空间名" --out D:/backup
"$N" workspace_ops.js import <备份.json> --name "恢复后的名字"
"$N" workspace_ops.js delete "空间名|ID" --confirm   # 高危：默认自动先备份
"$N" workspace_ops.js repair --fix multi-enabled,clear-deleting --confirm
```

所有命令最后一行输出 `RESULT: {json}`，程序化解析取这一行即可；加 `--json` 只留这一行。

### 4.1 备份（唯一可靠的数据保险）

- 站点**没有**任何备份/导出按钮（面板底部只有配额信息 + "请定期备份数据"的口头提醒）。AIREADME 里"建议定期备份（数据空间面板）"这句是站点侧的**表述错误**，实际做不到。
- `export` 产出单个 JSON，含：空间元信息 + 库的**结构快照**（version / stores / keyPath / 索引）+ 全量数据。这样恢复时能原样重建库，不依赖站点版本。
- 备份台账写在备份目录的 `_index.json`（空间 id → 最近备份时间 / 文件名 / 历史 30 条）。`list`/`doctor` 显示的"最近备份"来自这里，**不要**信站点记录里的 `backupAt`（见 §5 坑 2）。
- 建议节奏：录完一批方案参数后立即 `export all`；删除任何东西之前必 `export`。

### 4.2 恢复 / 迁移

`import` 的语义是**恢复为一个新空间**，永不覆盖现有数据：先用站点 UI 建一个空空间（拿到站点生成的新 UUID），再按快照重建库并灌数据。

- 方案组 / 方案 / 参数的 id 全部**原样保留**，只有 workspaceId 变了。
- 因此旧的深链（`planParams.html?workspaceId=...&groupId=...&planId=...`）中的 workspaceId 失效，需要重新从工作台进入拿新 URL。
- 换设备/换浏览器：`export all` → 拷 JSON → 新环境打开工作台 → 逐个 `import` → `activate` 想用的那个。

### 4.3 体检与修复

`doctor` 输出的 issue code 与处置：

| code | 级别 | 含义 | 处置 |
|------|------|------|------|
| `multi-enabled` | error | 多个空间同时 enabled | `repair --fix multi-enabled --confirm`（保留 updatedAt 最新的） |
| `no-enabled` | warn | 没有启用的空间（站点会兜底取第一个，但状态脏） | `repair --fix no-enabled --confirm` |
| `orphan-db` | error | 有 UUID 库但 systemDB 无记录（删除残留 / 记录丢失） | `repair --fix orphan-register --confirm` 注册回来 → `activate` 看内容 → 确认无用再 `delete` |
| `clear-deleting` | error | 记录带 `deleteing=true`：上次删库被阻塞，数据可能已半损 | 关掉所有其它标签页/窗口后 `repair --fix clear-deleting --confirm` |
| `db-not-initialized` | info | 记录有、库没有 | 正常（新建后从未激活），不用处理 |
| `never-backup` | warn | 台账里没有备份记录 | `export` |
| `orphan-plan` / `orphan-params` | warn | 方案指向已删除的组 / 参数没有对应方案 | 数据残渣，不影响使用；洁癖可导出后手工清理 |
| `persistence-off` | warn | 存储未持久化，磁盘紧张时浏览器可能自行清理 IndexedDB | 多用几次站点提升 engagement，或 `repair --fix request-persist --confirm` |
| `quota-high` | warn | 用量 > 80% 配额（实测配额约 10 GB） | 备份后删掉无用空间 |

---

## 5. 源码级坑（全部已核对/实测，踩了很难自己想明白）

1. **`Repository_Workspace.getAllWorkspaces()` 的 `return` 写在 for 循环体里**
   → 空库时返回 `undefined`（不是 `[]`），站点自己靠 `if (!workspaces || length===0)` 兜住；外部脚本若直接调仓库层要自己判空。
   → 同一处 `map` 只挑了 6 个字段，**丢掉了 `backupAt` 和 `deleteing`**。连带后果：`deleteing` 的"下次打开自动重删"自愈逻辑**永远不会触发**（读回来恒为 undefined）。

2. **`backupAt` 字段不可信（实测已复现）**
   UI 表格「备份时间」列恒显示 `-`；更要命的是**"激活"操作会遍历回写所有空间记录**（`enableWorkspace` → `saveWorkspace`），而回写用的实体已经丢了 `backupAt` → 外部写进去的备份时间会被**一次激活全部抹成 null**。
   → 结论：备份时间只认脚本维护的 `_index.json`。脚本仍会顺手写一份 `backupAt`（站点将来修好即可显示），但不依赖它。

3. **删库会被其它标签页阻塞**
   `deleteDatabase(空间id)` 若有其它标签页/窗口持有该库连接 → `onblocked` → toast「数据库删除被阻塞」+ 记录被打上 `deleteing=true`，而由坑 1 该标记不会自愈，只能人工/脚本清。
   → 删除前**只留一个工作台标签页**（脚本启动时会自动关掉多余标签页），别在另一窗口开着参数页/报告页。

4. **当前启用的空间删不掉**：`confirmDelete` 直接拦截并 toast「无法删除当前启用的工作区…」。先 `activate` 另一个再删。

5. **激活后页面会 `location.reload()`**（作者原话：省得写 destroy 手工 GC）。自动化点完「激活」必须等导航结束再断言，否则读到的是旧 DOM。

6. **名称全局唯一**，重名保存报 danger toast「工作区名称已存在」。批量脚本要先查重再建。

7. **删除是双重确认**：第一个确认框只是跳板，真正执行在 `#remove-workspace-confirm-btn-agin`。少点一步会以为"删了但没删"。

8. **持久化默认可能未启用**：`navigator.storage.persist()` 只在 engagement 足够时才被批准（实测首次 `未启用`，多次打开面板后变 `已启用`）。未启用状态下磁盘紧张时浏览器可清理 IndexedDB —— 这是真实的数据丢失路径，`doctor` 会告警。

9. **`indexedDB.open(不存在的库名)` 会顺手创建一个空库**——脚本里所有读操作都先用 `indexedDB.databases()` 判存在，避免制造孤儿空库。自己写临时脚本时最容易在这里污染环境。

10. 小瑕疵（无功能影响，别误报为故障）：`workbench.js` 绑定了 HTML 里并不存在的 `removeSpaceBtn`；二次确认弹窗静态文案有错字"高微操作"（运行时被 JS 覆盖成"高危操作"）；表格里有一行 `ws_001` 静态占位行，渲染时会被清掉。

---

## 6. 红线（不要做）

- **不要** 在没有 `export` 的情况下执行 `delete`（脚本默认会自动备份，别用 `--no-backup` 抄近路）。
- **不要** 直接对 `systemDB.workspaces` 批量写 `enabled=true`；启用互斥靠站点 `enableWorkspace` 串行回写，手写容易造成多启用脏状态。
- **不要** 手动 `indexedDB.deleteDatabase` 删空间库而不清 systemDB 记录（会造出"幽灵记录 + 数据没了"）；反之只删记录不删库 = 孤儿库。要么走 UI，要么走脚本。
- **不要** 让用户去"清除浏览器数据/Cookie"排查问题——那等于删掉全部方案数据。
- **不要** 把 `profitSimulation_systemDB`（系统目录库）当成"又一个工作区"去列/备/删/导——它是内部目录库（类比 SQL Server 的 master），只应由站点自身读写；脚本已通过 `isSystemOwnedDb()` 将它排除在用户库/孤儿库枚举之外，永不把它当工作区导出或删除。

---

## 7. 溯源

线上源码（2026-08-20 抓取核对）：
`page/workbench/workbench.html`、`page/workbench/js/workbench.js`、`page/workbench/js/WorkspaceManager.js`、
`repository/Repository_Workspace.js`、`repository/db/DBFactory.js`、`repository/Repository_PlanGroup.js`、
`domain/Entity_Workspace.js`、`domain/Entity_Base.js`、`domain/utils/DateTimeUitls.js`、`infrastructure/utils/LnsawTool.js`、`/AIREADME.md`
