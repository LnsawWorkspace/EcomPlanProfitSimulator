#!/usr/bin/env node
/**
 * ecomskill · 方案参数（PlanParams）运维脚本
 * 站点：https://ecomplanprofitsimulator.lnsaw.com  （纯前端 + IndexedDB，无后端 API）
 *
 * 数据模型（已核对 PlanParamsManager.js / Repository_PlanParams.js / Entity_PlanParams.js / 8 个 Model / planParams.html）
 *   - 参数存于【当前工作区库】的 planParams store（keyPath = 方案 id，一对一；与方案是"兄弟"关系）。
 *   - 记录 = 8 个模型 + 基础字段：modelPlanParamsSale / Refund / Goods / Gift /
 *     ExpensePerOrder / ExpenseMNPerOrder / ExpenseFixed / Advertising + id / createdAt / updatedAt。
 *   - 所有数值字段都是 {value, options} 包装对象（Decimal/Integer/Money/Percentage 序列化产物），读取取 .value。
 *   - 百分比类（退款比例/税率/回收率/订单比例）一律存 0-1 小数，页面输入是 %（0-100）。
 *   - Advertising 的 name 为空时整段为 null（不启用广告）。
 *   - 参数页必须带 URL 参数 ?workspaceId=&groupId=&planId= 才能加载，缺一页面隐藏。
 *
 * 设计原则（与 workspace_ops.js / plan_group_ops.js / plan_meta_ops.js 一致）
 *   1) 写操作（set）走**真实参数页 UI**，复用站点 8 类校验（正数/整数/0-100%/退款总和≤1）；
 *   2) 读/查找/体检直接读 IndexedDB（绕开 UI 渲染，拿全量数据）；
 *   3) 删除高危需 --confirm（本脚本不提供删参数命令，删除走 plan_meta_ops.js delete 方案）。
 *
 * ⚠️ 源码级坑（已核对源码 + 真机）
 *   - 参数页强依赖 URL 三参数：workspaceId / groupId / planId 缺一不可，否则整页隐藏为"方案不存在"。
 *   - 百分比方向：页面输入 %（13），存储 0.13（div(100)）。读写方向搞反报告数据全错。
 *   - 数值是 {value, options} 包装：直接读 IDB 见 salePrice:{value:"99",options:{...}} 属正常，取 .value。
 *   - 除法 bug：目标单量 = 3/33/333/3333 等时报告页计算卡死；写单量建议 ≥10 且 10 的倍数（check 会提示）。
 *   - 商品/赠品/费用是数组（表格多行），个别历史数据可能是单对象，读写都要兼容。
 *   - 保存成功 toast 为「方案参数保存成功！」（与方案组的「方案组创建成功」、方案的「方案更新成功」都不同）。
 *
 * 运行（Windows / Git Bash）：
 *   NODE_PATH="C:/Users/wamzm/.workbuddy/binaries/node/workspace/node_modules" \
 *   "C:/Users/wamzm/.workbuddy/binaries/node/versions/22.22.2/node.exe" plan_params_ops.js <命令> [参数]
 *
 * 命令：
 *   list                               列出工作区全部参数记录（含孤儿标记）
 *   get   <方案名|ID> [--group <名称|ID>]  查看某方案参数（简化可读值，百分比×100 展示）
 *   raw   <方案名|ID> [--group <名称|ID>]  查看某方案参数原始 JSON（含 options 包装）
 *   check <方案名|ID> [--group <名称|ID>]  体检：参数存在性 / 单量除法风险 / 广告 / 商品行数
 *   set   <方案名|ID> --sale-price 99 --quantity 1000 [--method cost|fair] [--refund-bef 1 --refund-ing 1 --refund-aft 3] [--group <名称|ID>]  写参数（走参数页 UI）
 *
 * 通用开关：--workspace <名称|ID>  指定目标工作区（默认当前启用；非当前先切换）
 *           --group <名称|ID>      限定方案组（get/raw/check/set 可用）
 *           --json（只输出机器可读结果）  --close（结束关闭浏览器）  --site=<url>
 * 浏览器：常驻模式（与其它脚本一致，见 plan_meta_ops.js 头注释）。
 * 环境变量：ECOMPLAN_BROWSER_DIR / ECOMPLAN_BROWSER_EXE / ECOMPLAN_SITE / ECOMPLAN_HEADLESS=1 / ECOMPLAN_CDP_PORT
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const { chromium } = require('playwright');

// ───────────────────────────── 配置 ─────────────────────────────
const CFG = {
	browserDir: process.env.ECOMPLAN_BROWSER_DIR || 'C:/Users/wamzm/AppData/Local/Microsoft/Edge SXS/User Data',
	browserExe: process.env.ECOMPLAN_BROWSER_EXE || 'C:/Users/wamzm/AppData/Local/Microsoft/Edge SXS/Application/msedge.exe',
	site: process.env.ECOMPLAN_SITE || 'https://ecomplanprofitsimulator.lnsaw.com',
	headless: process.env.ECOMPLAN_HEADLESS === '1',
	cdpPort: Number(process.env.ECOMPLAN_CDP_PORT || 9222),
	cdpHost: process.env.ECOMPLAN_CDP_HOST || '127.0.0.1',
};
const SYSTEM_DB = 'profitSimulation_systemDB'; // 系统目录库（类比 SQL Server 的 master），用于定位当前/目标工作区的库名（= 工作区 id）
const WS_STORE = 'workspaces';
const PG_STORE = 'planGroups';
const PM_STORE = 'planMetas';
const PP_STORE = 'planParams';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────── 参数解析 ───────────────────────────
const rawArgs = process.argv.slice(2);
const flags = {};
const args = [];
// 带值的标志：workspace/group/site + set 的参数（--sale-price 99 等）
const VALUE_FLAGS = new Set(['workspace', 'group', 'site', 'sale-price', 'quantity', 'method', 'refund-bef', 'refund-ing', 'refund-aft', 'ad-name', 'ad-roi', 'ad-rate']);
for (let i = 0; i < rawArgs.length; i++) {
	const a = rawArgs[i];
	if (!a.startsWith('--')) { args.push(a); continue; }
	const [k, v] = a.slice(2).split('=');
	if (v !== undefined) { flags[k] = v; continue; }
	if (VALUE_FLAGS.has(k) && rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--')) { flags[k] = rawArgs[++i]; continue; }
	flags[k] = true;
}
const CMD = (args.shift() || 'list').toLowerCase();
if (flags.site) CFG.site = flags.site;
const WORKBENCH = CFG.site + '/page/workbench/workbench.html';
const QUIET = !!flags.json;

const log = (...a) => { if (!QUIET) console.log(...a); };
const result = (obj) => console.log('RESULT: ' + JSON.stringify(obj));
const fail = (msg, extra = {}) => { result({ ok: false, cmd: CMD, error: msg, ...extra }); process.exit(2); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// 中文按 2 列宽对齐，避免表格错位
const dispLen = s => [...String(s)].reduce((n, c) => n + (c.codePointAt(0) > 0x2e80 ? 2 : 1), 0);
const padTo = (s, w) => {
	s = String(s);
	if (dispLen(s) <= w) return s + ' '.repeat(w - dispLen(s));
	let out = '', cur = 0;
	for (const c of s) { const cw = c.codePointAt(0) > 0x2e80 ? 2 : 1; if (cur + cw > w) break; out += c; cur += cw; }
	return out + ' '.repeat(Math.max(0, w - cur));
};

// ────────────── 注入到页面的工具集（window.__ws / window.__toasts） ──────────────
const INIT_SCRIPT = `
(() => {
  window.__toasts = [];
  const startObserver = () => {
    try {
      const mo = new MutationObserver(muts => {
        for (const m of muts) for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('toast')) {
            const body = n.querySelector('.toast-body');
            const type = (n.className.match(/text-bg-([a-z]+)/) || [])[1] || 'info';
            window.__toasts.push({ type, text: (body ? body.textContent : n.textContent || '').trim(), at: Date.now() });
          }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* ignore */ }
  };
  if (document.documentElement) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver);

  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const listDbs = async () => (await indexedDB.databases()).map(d => ({ name: d.name, version: d.version }));
  const exists = async (name) => (await listDbs()).some(d => d.name === name);
  const openExisting = async (name) => {
    if (!(await exists(name))) throw new Error('DB_NOT_FOUND:' + name);
    return await new Promise((res, rej) => {
      const r = indexedDB.open(name);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('DB_BLOCKED:' + name));
      r.onupgradeneeded = () => { /* 不应发生 */ };
    });
  };
  window.__ws = {
    listDbs, exists,
    async getAll(dbName, store) {
      const db = await openExisting(dbName);
      try {
        if (!db.objectStoreNames.contains(store)) return [];
        return await req(db.transaction(store, 'readonly').objectStore(store).getAll());
      } finally { db.close(); }
    },
    async count(dbName, store) {
      const db = await openExisting(dbName);
      try {
        if (!db.objectStoreNames.contains(store)) return null;
        return await req(db.transaction(store, 'readonly').objectStore(store).count());
      } finally { db.close(); }
    },
  };
})();
`;

// ─────────────────────── 浏览器 / 页面封装 ───────────────────────
// 常驻模式：浏览器进程独立于脚本存活（带 CDP 调试端口），脚本通过 CDP 连接复用。
// 首次运行自动拉起浏览器并保持打开；后续命令直接连接；--close 才关闭。
const CDP_URL = `http://${CFG.cdpHost}:${CFG.cdpPort}`;

// 探测 CDP 端口是否已有浏览器在跑
function cdpAlive() {
	return new Promise(resolve => {
		const req = http.get(CDP_URL + '/json/version', res => { res.resume(); resolve(res.statusCode === 200); });
		req.setTimeout(1500, () => { req.destroy(); resolve(false); });
		req.on('error', () => resolve(false));
	});
}

// 确保有可用的浏览器：已有(CDP)则复用，否则 spawn 一个独立常驻实例
async function ensureBrowser() {
	if (await cdpAlive()) return; // 已有浏览器在跑（无论是本脚本之前拉起还是用户手动带端口启动的）
	if (!fs.existsSync(CFG.browserExe)) fail('浏览器可执行文件不存在：' + CFG.browserExe);
	const child = spawn(CFG.browserExe, [
		`--remote-debugging-port=${CFG.cdpPort}`,
		`--user-data-dir=${CFG.browserDir}`,
		'--no-first-run', '--no-default-browser-check', '--disable-backgrounding-occluded-windows',
		'about:blank',
	], { detached: true, stdio: 'ignore', windowsHide: false });
	child.unref();
	// 等待 CDP 就绪（最长 ~20s，Edge 冷启动较慢）
	for (let i = 0; i < 40; i++) {
		await sleep(500);
		if (await cdpAlive()) return;
	}
	fail('浏览器启动超时：无法连接 ' + CDP_URL + '。若浏览器已被其他方式占用，请关闭后重试');
}

async function openWorkbench() {
	await ensureBrowser();
	let browser;
	try {
		browser = await chromium.connectOverCDP(CDP_URL);
	} catch (e) {
		fail('连接浏览器失败：' + (e && e.message ? e.message : e) + '（' + CDP_URL + '）');
	}
	const ctx = browser.contexts()[0] || await browser.newContext();
	await ctx.addInitScript(INIT_SCRIPT);

	// 只保留一个标签页：其它标签页会持有工作区库连接，导致 deleteDatabase 被 blocked
	let pages = ctx.pages();
	let page = pages.find(p => !p.isClosed());
	for (const p of pages) { if (p !== page && !p.isClosed()) await p.close().catch(() => { }); }
	if (!page || page.isClosed()) page = await ctx.newPage();
	page.on('dialog', d => d.dismiss().catch(() => { }));

	await page.goto(WORKBENCH, { waitUntil: 'domcontentloaded', timeout: 60000 });
	await waitReady(page);
	return { ctx, page, browser };
}

// 工作台就绪 = WorkspaceManager 已把当前空间名写进顶栏
async function waitReady(page) {
	await page.waitForFunction(() => {
		const el = document.getElementById('current-workspace-name');
		return !!el && el.textContent.trim().length > 0;
	}, { timeout: 40000 });
	await page.waitForTimeout(300);
}

async function openPanel(page) {
	const shown = await page.evaluate(() => !document.getElementById('workspace-container').classList.contains('d-none'));
	if (!shown) await page.click('#workspace-show-btn');
	await page.waitForFunction(() => !document.getElementById('workspace-container').classList.contains('d-none'), { timeout: 10000 });
	await page.waitForTimeout(400);
}

async function toasts(page, sinceIdx = 0) {
	return await page.evaluate(i => (window.__toasts || []).slice(i), sinceIdx);
}
async function toastCount(page) {
	return await page.evaluate(() => (window.__toasts || []).length);
}
async function waitToast(page, sinceIdx, timeout = 8000) {
	const t0 = Date.now();
	while (Date.now() - t0 < timeout) {
		const list = await toasts(page, sinceIdx);
		if (list.length) return list;
		await sleep(200);
	}
	return [];
}
async function rowIndex(page, name) {
	return await page.evaluate(n => {
		const rows = Array.from(document.querySelectorAll('#workspace-table-body tr'));
		return rows.findIndex(r => r.children[0] && r.children[0].textContent.trim() === n);
	}, name);
}

// ────────────────────────── 工作区定位 / 切换 ──────────────────────────
async function ensureWorkspace(page, nameOrId) {
	const ws = await page.evaluate(async ({ db, store }) => {
		if (!(await window.__ws.exists(db))) return [];
		return await window.__ws.getAll(db, store);
	}, { db: SYSTEM_DB, store: WS_STORE });
	let target;
	if (nameOrId) {
		target = ws.find(r => r.id === nameOrId) || ws.find(r => r.name === nameOrId);
		if (!target) fail(`未找到工作区：${nameOrId}`, { candidates: ws.map(r => r.name) });
	} else {
		target = ws.find(r => r.enabled === true || r.enabled === 'true');
		if (!target) fail('没有启用的当前工作区（doctor 检查 no-enabled）');
	}
	const isActive = target.enabled === true || target.enabled === 'true';
	if (isActive) return target;

	await openPanel(page);
	const idx = await rowIndex(page, target.name);
	if (idx < 0) fail('面板表格中未找到该行：' + target.name);
	await Promise.all([
		page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { }),
		page.locator('#workspace-table-body tr').nth(idx).locator('.workspace-activate-btn').click(),
	]);
	await waitReady(page);
	return target;
}

// ────────────────────────── 方案组 / 方案 / 参数 读取 ──────────────────────────
async function listGroups(page, wsId) {
	const raw = await page.evaluate(async (dbName) => {
		if (!(await window.__ws.exists(dbName))) return [];
		return await window.__ws.getAll(dbName, 'planGroups');
	}, wsId);
	return raw.map(g => {
		const pc = g.planCount;
		const count = pc == null ? 0 : (typeof pc === 'object' ? Number(pc.value ?? 0) : Number(pc));
		return { id: g.id, name: g.name, description: g.description || '', planCount: count, createdAt: g.createdAt, updatedAt: g.updatedAt };
	});
}

async function listPlans(page, wsId) {
	const raw = await page.evaluate(async (dbName) => {
		if (!(await window.__ws.exists(dbName))) return [];
		return await window.__ws.getAll(dbName, 'planMetas');
	}, wsId);
	return raw.map(p => ({
		id: p.id,
		groupId: p.groupId,
		name: p.name,
		description: p.description || '',
		enabled: !!(p.enabled === true || p.enabled === 'true'),
		createdAt: p.createdAt,
		updatedAt: p.updatedAt,
	}));
}

async function listParams(page, wsId) {
	const raw = await page.evaluate(async (dbName) => {
		if (!(await window.__ws.exists(dbName))) return [];
		return await window.__ws.getAll(dbName, 'planParams');
	}, wsId);
	return raw.map(p => ({ id: p.id, createdAt: p.createdAt, updatedAt: p.updatedAt, ...p }));
}

function resolveGroup(groups, key) {
	if (UUID_RE.test(key)) {
		const g = groups.find(x => x.id === key);
		if (!g) fail(`未找到方案组：${key}`);
		return g;
	}
	const exact = groups.filter(x => x.name === key);
	if (exact.length === 1) return exact[0];
	if (exact.length > 1) fail(`名称"${key}"匹配到多个方案组，请用 ID 指定`, { ids: exact.map(x => x.id) });
	const like = groups.filter(x => x.name.includes(key));
	if (like.length === 1) return like[0];
	if (like.length > 1) fail(`名称"${key}"匹配到多个方案组，请用 ID 或更精确的名称指定`, { ids: like.map(x => x.id) });
	fail(`未找到方案组：${key}`, { candidates: groups.map(x => x.name) });
}

async function resolvePlan(page, wsId, key, groupKey) {
	let plans = await listPlans(page, wsId);
	if (groupKey) {
		const groups = await listGroups(page, wsId);
		const g = resolveGroup(groups, groupKey);
		plans = plans.filter(p => p.groupId === g.id);
	}
	if (UUID_RE.test(key)) {
		const p = plans.find(x => x.id === key);
		if (!p) fail(`未找到方案：${key}`);
		return p;
	}
	const exact = plans.filter(x => x.name === key);
	if (exact.length === 1) return exact[0];
	if (exact.length > 1) fail(`名称"${key}"匹配到多个方案，请用 ID 指定`, { ids: exact.map(x => x.id) });
	const like = plans.filter(x => x.name.includes(key));
	if (like.length === 1) return like[0];
	if (like.length > 1) fail(`名称"${key}"匹配到多个方案，请用 ID 或更精确的名称指定`, { ids: like.map(x => x.id) });
	fail(`未找到方案：${key}`, { candidates: plans.map(x => x.name) });
}

// 取 {value, options} 包装的值（字符串），可指定按 0-1 → % 换算
function v(obj, mul100 = false) {
	if (obj == null) return null;
	const val = (typeof obj === 'object' && !Array.isArray(obj) && 'value' in obj) ? obj.value : obj;
	if (val == null) return null;
	const n = Number(val);
	if (Number.isNaN(n)) return val;
	return mul100 ? (n * 100) : n;
}

// 把参数记录转成可读摘要（百分比 ×100 展示，数组长度化）
function summarizeParams(p) {
	if (!p) return null;
	const S = p.modelPlanParamsSale || {};
	const R = p.modelPlanParamsRefund || {};
	const A = p.modelPlanParamsAdvertising || null;
	const arr = (x) => (Array.isArray(x) ? x.length : (x ? 1 : 0));
	return {
		id: p.id,
		createdAt: p.createdAt,
		updatedAt: p.updatedAt,
		sale: {
			price: v(S.salePrice),
			quantity: v(S.payOrderQuantity),
			method: S.method || null,
		},
		refund: {
			befPer: v(R.refundBefPer, true),
			ingPer: v(R.refundIngPer, true),
			aftPer: v(R.refundAftPer, true),
		},
		advertising: A ? { name: A.name, roi: v(A.roi), inputRate: v(A.inputRate, true) } : null,
		goodsCount: arr(p.modelPlanParamsGoods),
		giftCount: arr(p.modelPlanParamsGift),
		expensePerOrderCount: arr(p.modelPlanParamsExpensePerOrder),
		expenseMNPerOrderCount: arr(p.modelPlanParamsExpenseMNPerOrder),
		expenseFixedCount: arr(p.modelPlanParamsExpenseFixed),
	};
}

// 检查单量是否有除法 bug 风险（3/33/333/3333 等全 3 组成的数）
function quantityRisk(q) {
	if (q == null) return false;
	const s = String(q).trim();
	if (!/^\d+$/.test(s)) return false;
	return /^3+$/.test(s);
}

// ────────────────────────── 参数页导航 ──────────────────────────
// 参数页必须带 workspaceId/groupId/planId 三参数，缺一页面隐藏。
async function openParamsPage(page, wsId, groupId, planId) {
	const url = `${CFG.site}/page/planParams/planParams.html?workspaceId=${encodeURIComponent(wsId)}&groupId=${encodeURIComponent(groupId)}&planId=${encodeURIComponent(planId)}`;
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
	// 等表单关键元素出现（页面加载成功标志），或判定"方案不存在"
	await page.waitForTimeout(1500);
	const ok = await page.evaluate(() => !!document.getElementById('savePlanParams'));
	if (!ok) fail('参数页未加载（URL 三参数缺失或方案不存在），可能已被 #hidePage 隐藏');
	await page.waitForTimeout(600); // 等 loadPlanParams 回填
	return url;
}

// ────────────────────────── 命令实现 ──────────────────────────
async function cmdList(page, wsId, wsName) {
	const [params, metas] = await Promise.all([
		listParams(page, wsId),
		listPlans(page, wsId),
	]);
	const metaIds = new Set(metas.map(m => m.id));
	const metaById = new Map(metas.map(m => [m.id, m]));
	const rows = params.map(p => {
		const meta = metaById.get(p.id);
		return {
			id: p.id,
			planName: meta ? meta.name : '(方案不存在)',
			groupName: meta ? null : null, // 组名需二次查，简化略
			orphan: !metaIds.has(p.id),
			updatedAt: p.updatedAt,
			summary: summarizeParams(p),
		};
	});
	const orphans = rows.filter(r => r.orphan);
	log(`\n参数(planParams)清单（工作区：${wsName}）：`);
	log(`   参数记录数：${params.length}  方案数：${metas.length}  孤儿参数：${orphans.length}`);
	if (rows.length) {
		log(padTo('方案', 26) + padTo('参数存在', 8) + '更新时间');
		log('-'.repeat(50));
		for (const r of rows) {
			log(padTo(r.planName, 26) + padTo(r.orphan ? '孤儿!' : '有', 8) + (r.updatedAt || ''));
		}
	}
	log('');
	result({ ok: true, cmd: 'list', workspace: wsName, workspaceId: wsId, paramCount: params.length, planCount: metas.length, orphanCount: orphans.length, params: rows });
}

async function cmdGet(page, wsId, wsName) {
	const key = args[0];
	if (!key) fail('用法：get <方案名|ID> [--group <名称|ID>]');
	const plan = await resolvePlan(page, wsId, key, flags.group);
	const params = await listParams(page, wsId);
	const p = params.find(x => x.id === plan.id);
	if (!p) fail(`方案"${plan.name}"还没有参数记录（去参数页填写保存后才有）`, { planId: plan.id, groupId: plan.groupId });
	const s = summarizeParams(p);
	log(`\n方案参数（工作区：${wsName}，方案：${plan.name}，方案组：${plan.groupId}）：`);
	log(`   售价：¥${s.sale.price}  目标单量：${s.sale.quantity}${quantityRisk(s.sale.quantity) ? '  ⚠️除法bug风险(全3数)' : ''}  分摊：${s.sale.method}`);
	log(`   退款%：售前 ${s.refund.befPer} / 售中 ${s.refund.ingPer} / 售后 ${s.refund.aftPer}`);
	log(`   广告：${s.advertising ? `${s.advertising.name}（ROI=${s.advertising.roi}，税率%=${s.advertising.inputRate}）` : '未启用'}`);
	log(`   行数：商品 ${s.goodsCount} / 赠品 ${s.giftCount} / 每单费用 ${s.expensePerOrderCount} / M→N单费用 ${s.expenseMNPerOrderCount} / 固定费用 ${s.expenseFixedCount}`);
	log(`   更新时间：${p.updatedAt}`);
	log('');
	result({ ok: true, cmd: 'get', workspace: wsName, planId: plan.id, planName: plan.name, groupId: plan.groupId, params: s, quantityRisk: quantityRisk(s.sale.quantity) });
}

async function cmdRaw(page, wsId, wsName) {
	const key = args[0];
	if (!key) fail('用法：raw <方案名|ID> [--group <名称|ID>]');
	const plan = await resolvePlan(page, wsId, key, flags.group);
	const params = await listParams(page, wsId);
	const p = params.find(x => x.id === plan.id);
	if (!p) fail(`方案"${plan.name}"还没有参数记录`);
	log(`\n方案参数原始 JSON（工作区：${wsName}，方案：${plan.name}）：`);
	log(JSON.stringify(p, null, 1));
	result({ ok: true, cmd: 'raw', workspace: wsName, planId: plan.id, planName: plan.name, params: p });
}

async function cmdCheck(page, wsId, wsName) {
	const key = args[0];
	if (!key) fail('用法：check <方案名|ID> [--group <名称|ID>]');
	const plan = await resolvePlan(page, wsId, key, flags.group);
	const params = await listParams(page, wsId);
	const p = params.find(x => x.id === plan.id);
	const issues = [];
	if (!p) issues.push({ level: 'warn', code: 'no-params', msg: '该方案还没有参数记录' });
	const s = p ? summarizeParams(p) : { sale: { quantity: null } };
	if (s.sale.quantity != null && quantityRisk(s.sale.quantity)) issues.push({ level: 'warn', code: 'div-bug-risk', msg: `目标单量 ${s.sale.quantity} 由全3组成，报告页可能卡死（除法bug），建议改为≥10的倍数` });
	if (s.sale.price == null) issues.push({ level: 'warn', code: 'no-sale-price', msg: '未设置售价' });
	if (s.sale.quantity == null) issues.push({ level: 'warn', code: 'no-quantity', msg: '未设置目标单量' });
	log(`\n参数体检（工作区：${wsName}，方案：${plan.name}）：`);
	if (!issues.length) log('   ✅ 无问题');
	for (const i of issues) log(`   ⚠️ [${i.code}] ${i.msg}`);
	log('');
	result({ ok: true, cmd: 'check', workspace: wsName, planId: plan.id, planName: plan.name, issues });
}

// 写参数：导航到参数页 → 填表单 → 点保存 → 读回校验
async function cmdSet(page, wsId, wsName) {
	const key = args[0];
	if (!key) fail('用法：set <方案名|ID> --sale-price <售价> --quantity <单量> [--method cost|fair] [--refund-bef <售前%> --refund-ing <售中%> --refund-aft <售后%>] [--group <名称|ID>]');
	const plan = await resolvePlan(page, wsId, key, flags.group);
	const salePrice = flags['sale-price'];
	const quantity = flags.quantity;
	if (salePrice === undefined || quantity === undefined) fail('set 至少需要 --sale-price <售价> 和 --quantity <单量>');
	if (!(Number(salePrice) > 0)) fail('售价必须是正数');
	if (!(Number.isInteger(Number(quantity)) && Number(quantity) > 0)) fail('单量必须是正整数');
	if (quantityRisk(quantity)) log('⚠️ 注意：单量由全3组成（除法bug风险），报告页可能卡死；建议 ≥10 的倍数');
	const method = flags.method || 'cost';
	if (!['cost', 'fair'].includes(method)) fail('--method 只能是 cost 或 fair');
	// 退款比例（页面输入 %，站点内部 div(100) 存 0-1）
	const rb = flags['refund-bef'] !== undefined ? Number(flags['refund-bef']) : null;
	const ri = flags['refund-ing'] !== undefined ? Number(flags['refund-ing']) : null;
	const ra = flags['refund-aft'] !== undefined ? Number(flags['refund-aft']) : null;
	if ([rb, ri, ra].some(x => x !== null && !(x >= 0 && x <= 100))) fail('退款比例需在 0-100 之间（页面输入%）');
	const sum = (rb ?? 0) + (ri ?? 0) + (ra ?? 0);
	if (sum > 100) fail(`退款比例总和 ${sum}% 超过 100%（站点校验：总和≤100%）`);

	await openParamsPage(page, wsId, plan.groupId, plan.id);

	// 填表单
	await page.fill('#sale_price', String(salePrice));
	await page.fill('#sale_Number', String(quantity));
	await page.check(method === 'cost' ? '#sale_method_cost' : '#sale_method_fair');
	if (rb !== null) await page.fill('#refund_bef_per', String(rb));
	if (ri !== null) await page.fill('#refund_ing_per', String(ri));
	if (ra !== null) await page.fill('#refund_aft_per', String(ra));

	const before = await toastCount(page);
	await page.click('#savePlanParams');
	const tl = await waitToast(page, before);
	const danger = tl.find(t => t.type === 'danger' || t.type === 'error');
	if (danger) {
		// 读回校验失败原因
		const p = await listParams(page, wsId);
		const rec = p.find(x => x.id === plan.id);
		fail('参数保存失败：' + danger.text, { toast: danger.text, hasParams: !!rec });
	}
	// 成功：读回 IDB 校验
	const p2 = await listParams(page, wsId);
	const rec2 = p2.find(x => x.id === plan.id);
	if (!rec2) fail('保存后未在 IndexedDB 中找到参数记录（站点可能未 put 成功）', { toasts: tl });
	const s = summarizeParams(rec2);
	log(`✅ 已保存方案参数："${plan.name}"（工作区：${wsName}）`);
	log(`   售价 ¥${s.sale.price} / 单量 ${s.sale.quantity} / 分摊 ${s.sale.method}`);
	if (rb !== null || ri !== null || ra !== null) log(`   退款%：售前 ${s.refund.befPer} / 售中 ${s.refund.ingPer} / 售后 ${s.refund.aftPer}`);
	log('');
	result({ ok: true, cmd: 'set', workspace: wsName, planId: plan.id, planName: plan.name, groupId: plan.groupId, toasts: tl, params: s });
}

// ──────────────────────────── 入口 ────────────────────────────
(async () => {
	const b = await openWorkbench();
	const { ctx, page } = b;
	try {
		const ws = await ensureWorkspace(page, flags.workspace);
		const wsId = ws.id, wsName = ws.name;
		switch (CMD) {
			case 'list': await cmdList(page, wsId, wsName); break;
			case 'get': await cmdGet(page, wsId, wsName); break;
			case 'raw': await cmdRaw(page, wsId, wsName); break;
			case 'check': await cmdCheck(page, wsId, wsName); break;
			case 'set': await cmdSet(page, wsId, wsName); break;
			default: fail('未知命令：' + CMD + '（支持 list / get / raw / check / set）');
		}
	} catch (e) {
		fail(e.message || String(e));
	} finally {
		// 常驻模式：默认不关闭浏览器；--close 才关（用 CDP Browser.close 真正关闭浏览器进程）。
		// 无论如何都要断开 CDP 连接，否则 Node 进程因 websocket 连接不退出，bash 会挂起（管道截断假象）。
		if (flags.close) {
			try { const s = await b.browser.newBrowserCDPSession(); await s.send('Browser.close'); } catch (_) { }
		}
		await b.browser.close().catch(() => { }); // 断开 CDP 连接（不杀浏览器进程，浏览器保持常驻）
	}
})();
