# 方案参数（PlanParams）维护

> 配套脚本：`scripts/plan_params_ops.js`
> 数据全在浏览器 IndexedDB，无后端/账号/API。下面所有结论均来自源码核对
> （`PlanParamsManager.js` / `Repository_PlanParams.js` / `Entity_PlanParams.js` / 8 个 `Model_PlanParams_*.js` / `planParams.html`）+ 真机实测。
> 关联：方案的增删改查见 `planMetas.md`，方案组见 `planGroups.md`，数据空间见 `workspace.md`。

---

## 1. 心智模型

```
当前工作区库（库名 = 工作区 UUID）
├── planMetas   方案（keyPath=id）            ← 参数的主体，一对一
├── planParams  方案参数（keyPath = 方案的 id）  ← ★本文件主角★ 与方案"兄弟"关系
└── ...
```

- **一个方案（planMeta）对应一条参数记录（planParams）**：`planParams.id` 直接复用方案的 `id`（源码注释："复用 PlanMeta 的 ID，这样就不用搞什么外键"），一对一。
- **参数页是独立页面**：`/page/planParams/planParams.html`，必须带 URL 参数 `?workspaceId=&groupId=&planId=` 才能加载（三者缺一 → 页面隐藏，显示「方案不存在，或已被移除。」）。
- **删除方案不级联删参数**（planMetas 的坑 3）：删方案后参数记录成孤儿。`plan_meta_ops.js params` 命令可审计孤儿。
- **填参数 ≠ 建方案**：方案（名称/描述）在工作台建；参数（售价/单量/退款/商品/赠品/费用/广告）在参数页填。

### 参数记录 = 8 个模型 + 基础字段

存储形态（`toSerializable` 序列化后）——**所有数值字段都是 `{value, options}` 包装对象**（Decimal/Integer/Money/Percentage 的序列化产物），读脚本需取 `.value`，写脚本需按此结构构造：

| 顶层字段 | 形态 | 说明 |
|---------|------|------|
| `id` | string(UUID) | = 方案 id，keyPath |
| `createdAt` / `updatedAt` | string | `YYYY-MM-DD HH:mm:ss`（与工作区/方案组/方案一致） |
| `entityModelVersion` | string | 模型版本 |
| `modelPlanParamsSale` | 单对象 | 销售：售价/目标单量/分摊方式 |
| `modelPlanParamsRefund` | 单对象 | 退款：三个阶段的退款比例 |
| `modelPlanParamsAdvertising` | 单对象或 null | 广告；**名称为空时返回 null（不使用广告）** |
| `modelPlanParamsGoods` | 数组或单对象 | 商品明细（可多行） |
| `modelPlanParamsGift` | 数组或单对象 | 赠品明细（可多行） |
| `modelPlanParamsExpensePerOrder` | 数组或单对象 | 每单费用 |
| `modelPlanParamsExpenseMNPerOrder` | 数组或单对象 | M→N 单费用（订单比例） |
| `modelPlanParamsExpenseFixed` | 数组或单对象 | 固定费用 |

### 各模型字段明细（均取 `.value` 使用；百分比类一律是 0-1 小数，**不是百分数**）

**Sale（销售）**
| 字段 | 类型 | 说明 |
|------|------|------|
| `salePrice` | Money | 售价（默认 `¥` 前缀），必须 > 0 |
| `payOrderQuantity` | Integer | 目标单量，必须正整数 > 0（**除法 bug 敏感字段，见 §5 坑 5**） |
| `method` | string | `'cost'`（成本分摊）/ `'fair'`（公允价值分摊） |
| `quantityPattern` | string | 单量计算模式，默认 `'real'` |

**Refund（退款）**——全部 0-1 小数
| 字段 | 说明 |
|------|------|
| `refundBefPer` / `refundIngPer` / `refundAftPer` | 售前/售中/售后退款比例，各 0~1，**三项总和 ≤ 1** |
| `refundTotalPer` | 合计（存储时自动算） |

**Advertising（广告）**——`name` 为空 → 整条为 null
| 字段 | 说明 |
|------|------|
| `name` | 广告名称，非空才启用广告 |
| `roi` | 广告 ROI，> 0 |
| `inputRate` | 广告税率，0-1 小数（页面输入 %，存 0-1） |
| `refundBefRec` / `refundIngRec` / `refundAftRec` | 广告售前/售中/售后回收率，0-1 |

**Goods / Gift（商品 / 赠品）**——数组元素字段相同；Gift 多 `subjectType`（费用类型，如"销售费用"，默认"其他"）
| 字段 | 说明 |
|------|------|
| `name` | 名称（空行跳过） |
| `quantity` | 件数，默认 1 |
| `purchaseAmount` / `purchaseQuantity` | 采购金额/数量（当前 UI 收集恒为 0） |
| `valueIncTax` / `valueExcTax` | 含税/不含税成本 |
| `inputRate` / `outputRate` | 进项/销项税率，0-1 小数（页面输入 %，存 0-1；outputRate 缺省回退 inputRate） |
| `fairValue` | 公允价值 |
| `refundBefRec` / `refundIngRec` / `refundAftRec` | 售前/售中/售后回收率，0-1 |

**Expense_PerOrder / Expense_Fixed（每单 / 固定费用）**——数组元素字段相同
| 字段 | 说明 |
|------|------|
| `name` | 费用名称 |
| `valueType` | `'num'`（金额）/ `'per'`（百分比） |
| `valueMoney` | 金额型数值（valueType=num 时用） |
| `valuePercentage` | 百分比型数值，0-1（valueType=per 时用） |
| `inputRate` | 进项税率，0-1，默认 0.06 |
| `base` | 计算基础（per 时必填；base=1 基于不含税，=2 基于含税） |
| `baseHaveTax` | 是否基于含税金额计算 |
| `refundBefRec` / `refundIngRec` / `refundAftRec` | 售前/售中/售后回收率，0-1 |

**Expense_MNPerOrder（M→N 单费用）**——按订单比例分摊
| 字段 | 说明 |
|------|------|
| `orderPer` | 订单比例，0-1 |
| `refundBefPer` / `refundIngPer` / `refundAftPer` | 三个阶段的退款比例，0-1 |
| `valueMoney` / `valuePercentage` / `valueType` 等 | 同 PerOrder |

## 2. UI 元素清单（参数页，自动化定位用）

入口：`/page/planParams/planParams.html?workspaceId=xxx&groupId=yyy&planId=zzz`（三者缺一页面隐藏）。

| 元素 | 选择器 | 备注 |
|------|--------|------|
| 页面标题 | `.main-title h1 span` | 显示 `工作区名 -> 方案组名 -> 方案名` |
| 售价 | `#sale_price` | |
| 目标单量 | `#sale_Number` | **除法 bug 敏感**，建议 ≥10 且 10 的倍数 |
| 分摊方式 | `#sale_method_cost` / `#sale_method_fair` | radio，cost 或 fair |
| 退款比例 | `#refund_bef_per` / `#refund_ing_per` / `#refund_aft_per` | 页面输入 **%（0-100）**，存储为 0-1 |
| 广告名称/ROI/税率 | `#advertising_name` / `#advertising_roi` / `#advertising_rate` | rate 页面输入 %，存储 0-1 |
| 广告回收率 | `#advertising_refund_bef_rec` / `#advertising_refund_ing_rec` / `#advertising_refund_aft_rec` | 页面输入 %，存储 0-1 |
| 商品表 | `#goodsContainer`（表 `#goodsTable`） | 行内 `tr > td`：名称/件数/含税成本/不含税成本/公允价值/进项税率/销项税率/售前回收/售中回收/售后回收 |
| 赠品表 | `#giftContainer`（表 `#giftTable`） | 同商品 + 费用类型列 |
| 每单费用表 | `#expensePerOrderContainer`（表 `#expensePerOrderTable`） | 名称/支出成本/进项税率/成本类型(money/percent)/基于/基于含税/三回收率 |
| M→N 单费用表 | `#expenseMNPerOrderContainer`（表 `#expenseMNPerOrderTable`） | 名称/订单比例/支出成本/... |
| 固定费用表 | `#expenseFixedContainer`（表 `#expenseFixedTable`） | 同 PerOrder |
| 保存按钮 | `#savePlanParams` | 点它保存（toast「方案参数保存成功！」） |
| 保存并查看报告 | `#goReport` | 保存后新标签打开报告页（可能因除法 bug 卡死，慎用） |

**toast 文案**：成功 → `方案参数保存成功！`；失败 → `保存方案参数时出错：<原因>`；校验错误 → `错误：<原因>`。

## 3. 真实行为（源码级）

| 动作 | 真实行为 |
|------|---------|
| 加载 | `#initPlanParams` 读 URL 三参数 → 依次查 workspace/group/meta，任一缺失 → `#hidePage`（页面显示"方案不存在"）。存在则读 planParams，有记录就 `#loadPlanParams` 回填表单 |
| 保存 | `#saveParamsData` → `#getParams` 收集 8 个模型 → `Entity_PlanParams` → `repositoryPlanParams.savePlanParams`（`put` 进 planParams store，keyPath=方案 id）→ toast 成功 |
| 校验（Sale） | 售价必须正数；单量必须正整数 |
| 校验（Refund） | 三个退款比例各 0-1 且**总和 ≤ 1**，否则报错 |
| 校验（Advertising） | name 为空 → 返回 null（整段不存）；roi>0；rate 0-100% |
| 校验（Goods/Gift/Expense） | 每行构建 Model，失败的行 toast 警告并跳过，不阻断整单保存 |
| 商品/赠品/费用可多行 | Goods/Gift/三个 Expense 都是**数组**（表格每行一个元素）；单对象形态在 parse 时也兼容 |

## 4. 维护 SOP（用 `scripts/plan_params_ops.js`）

运行前提：浏览器常驻模式（见 planGroups.md §4），命令默认操作**当前启用工作区**，`--workspace` 指定其他。

```bash
cd C:/Users/wamzm/.workbuddy/skills/ecomskill/scripts
export NODE_PATH="C:/Users/wamzm/.workbuddy/binaries/node/workspace/node_modules"
N="C:/Users/wamzm/.workbuddy/binaries/node/versions/22.22.2/node.exe"

"$N" plan_params_ops.js list [--workspace <名称|ID>]                 # 参数记录清单（含孤儿标记）
"$N" plan_params_ops.js get "<方案名|ID>" [--group <组名|ID>]          # 查看某方案参数（简化为可读值）
"$N" plan_params_ops.js raw "<方案名|ID>" [--group <组名|ID>]          # 查看某方案参数原始 JSON（含 options）
"$N" plan_params_ops.js check "<方案名|ID>" [--group <组名|ID>]        # 体检：参数是否存在/单量除法风险/孤儿
"$N" plan_params_ops.js set "<方案名|ID>" --sale-price 99 --quantity 1000 --method cost [--group ...]   # 写参数（走 UI）
# 常见组合：
"$N" plan_params_ops.js set "京东POP自然流量" --sale-price 159 --quantity 3000 --group "睡裙"
```

所有命令最后一行输出 `RESULT: {json}`；加 `--json` 只留这一行。

## 5. 源码级坑（务必注意）

1. **参数页强依赖 URL 三参数**：`workspaceId` / `groupId` / `planId` 缺一不可，否则页面直接隐藏（不是报错，是整页替换成"方案不存在"）。脚本导航必须先拿全三个 ID。
2. **百分比一律存 0-1 小数**：退款比例、税率、回收率、订单比例，页面输入是 %（如 13），存储是 0.13。读写脚本千万别把 13 当 13% 直接存——读时 `.value` 就是 0-1，写时要先除以 100（或按页面输入格式传）。
3. **数值全是 `{value, options}` 包装对象**：直接读 IDB 时看到 `salePrice: {value:"99", options:{...}}` 是正常的，取 `.value`（字符串）再 `Number()` 转换。**不要**把整个对象当值传给 UI 或报告逻辑。
4. **广告 name 为空 = 整条不存**：`getParams_Advertising` 在 name 空时返回 null，`savePlanParams` 会把整个 `modelPlanParamsAdvertising` 存为 null。读脚本要容忍 null。
5. **除法 bug（报告页）**：目标单量 = 3 / 33 / 333 / 3333 等（数字全部由 3 组成）时，报告页计算可能卡死/一直加载。参数页本身正常，但 `#goReport` 或报告页会踩。**写单量时建议 ≥10 且为 10 的倍数**，`check` 命令会提示风险。
6. **商品/赠品/费用是数组**：表格可多行。读脚本 `Array.isArray()` 判断；个别历史数据可能是单对象（parse 兼容），也要处理。
7. **`expenseFixed` 的 valueType 默认**：Model 里 `valueType` 缺省时按 `'num'`（金额）处理；UI 上有 `cost_type_money` / `cost_type_percent` 单选按钮对应 num/per。
8. **保存成功 toast 是 `方案参数保存成功！`**：与方案组（`方案组创建成功`）、方案（`方案更新成功`，误导文案）都不同，别混。

## 6. 红线

- **写参数走参数页 UI**（复用站点的 8 类校验：正数/整数/0-100%/总和≤1），**不要**直接 `put` 进 planParams store 绕过校验。
- **百分比换算**：UI 输入 % → 存储 0-1；读脚本输出时可按需 ×100 展示。方向搞反会让报告数据全错。
- **不要动 `id`**：planParams.id 必须等于方案 id，改了会脱离方案（孤儿）。
- 删除方案前先 `plan_meta_ops.js params` 评估孤儿；删方案后参数不会自动删。
- 目标单量避开 3/33/333/3333 这类值（除法 bug），建议 ≥10 的倍数。
- 浏览器常驻模式，收尾用 `--close`；Edge Canary 被手动打开时先关掉或用调试端口启动。

## 7. 溯源

- 页面/管理器：`page/planParams/planParams.html`、`page/planParams/js/PlanParamsManager.js`
- 实体/模型：`domain/plan/Entity_PlanParams.js`、`domain/plan/Model_PlanParams_{Sale,Refund,Goods,Gift,Expense_PerOrder,Expense_MNPerOrder,Expense_Fixed,Advertising}.js`
- 仓储：`repository/Repository_PlanParams.js`（save = put；get 按 id；delete 按 id）
- 基础：`domain/Entity_Base.js`（toSerializable：Decimal→字符串、`{value,options}` 包装、时间格式）
