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
 *   - 商品/赠品/费用是数组（表格多行），个别历史数据可能是单对象，读写都要兼容。
 *   - 保存成功 toast 为「方案参数保存成功！」（与方案组的「方案组创建成功」、方案的「方案更新成功」都不同）。
 *
 * 运行（Windows / Git Bash）：
 *   NODE_PATH="<托管 node workspace>/node_modules"  # 托管 node 路径见运行环境 \
 *   "<托管 node 可执行文件>" plan_params_ops.js <命令> [参数]
 *
 * 命令：
 *   list                               列出工作区全部参数记录（含孤儿标记）
 *   get   <方案名|ID> [--group <名称|ID>]  查看某方案参数（简化可读值，百分比×100 展示）
 *   raw   <方案名|ID> [--group <名称|ID>]  查看某方案参数原始 JSON（含 options 包装）
 *   check <方案名|ID> [--group <名称|ID>]  体检：参数存在性 / 广告 / 商品行数
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
	browserDir: process.env.ECOMPLAN_BROWSER_DIR || '',
	browserExe: process.env.ECOMPLAN_BROWSER_EXE || '',
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
// 带值的标志：workspace/group/site + set 的参数（--sale-price 99 等）；--goods 可重复（多条商品）
const VALUE_FLAGS = new Set(['workspace', 'group', 'site', 'sale-price', 'quantity', 'method', 'refund-bef', 'refund-ing', 'refund-aft', 'ad-name', 'ad-roi', 'ad-rate', 'ad-refund-bef', 'ad-refund-ing', 'ad-refund-aft', 'goods', 'gift', 'goods-del', 'gift-del', 'expense', 'expense-del', 'expense-mn', 'expense-mn-del', 'expense-fixed', 'expense-fixed-del']);
// 收集可重复标志（--goods / --gift / --goods-del / --gift-del / --expense / --expense-del 支持多条）
const REPEAT_FLAGS = new Set(['goods', 'gift', 'goods-del', 'gift-del', 'expense', 'expense-del', 'expense-mn', 'expense-mn-del', 'expense-fixed', 'expense-fixed-del']);
for (let i = 0; i < rawArgs.length; i++) {
	const a = rawArgs[i];
	if (!a.startsWith('--')) { args.push(a); continue; }
	const [k, v] = a.slice(2).split('=');
	if (v !== undefined) {
		if (REPEAT_FLAGS.has(k)) (flags[k] = flags[k] || []).push(v);
		else flags[k] = v;
		continue;
	}
	if (VALUE_FLAGS.has(k) && rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--')) {
		const val = rawArgs[++i];
		if (REPEAT_FLAGS.has(k)) (flags[k] = flags[k] || []).push(val);
		else flags[k] = val;
		continue;
	}
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
	if (!CFG.browserExe) fail('未配置浏览器可执行文件：请设置环境变量 ECOMPLAN_BROWSER_EXE（本技能为通用发布版，不内置本机路径）');
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

	// 智能就绪：若当前标签页已是本站页面（参数页/工作台等），直接复用，不重新导航。
	// （参数页的 openParamsPage 会再判断"是否同一方案"，是则 reload 复用。）
	const onSite = await page.evaluate(() => {
		try {
			return location.hostname.includes('ecomplanprofitsimulator');
		} catch (e) { return false; }
	}).catch(() => false);
	if (!onSite) {
		await page.goto(WORKBENCH, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await waitReady(page);
	} else {
		// 复用已打开的页面：addInitScript 只对之后的导航生效，需手动执行一次注入工具集
		await page.evaluate(INIT_SCRIPT).catch(() => { });
		await page.bringToFront().catch(() => { });
	}
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

// 等待支出类 modal 的"基于"（来源字段）select 选项填充完成（站点在 shown.bs.modal 后才 initSelectOptions 填充选项，
// 若脚本用 .show 就 selectOption 会抢在选项填充前 → 选不中）。等待目标选项存在后再 selectOption。
async function selectExpenseBase(page, selectId, value = '售价') {
	await page.waitForFunction(args => {
		const el = document.querySelector(args.sel);
		return el && Array.from(el.options).some(o => o.value === args.val);
	}, { sel: selectId, val: value }, { timeout: 8000 });
	await page.selectOption(selectId, value);
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

	// 需要切换工作区（依赖工作台 UI）：若当前不在工作台，先导航过去
	const onWorkbench = await page.evaluate(() => !!document.getElementById('current-workspace-name')).catch(() => false);
	if (!onWorkbench) {
		await page.goto(WORKBENCH, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await waitReady(page);
	}
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

// 检查单量是否有除法风险（3/33/333/3333 等全 3 组成的数，报告页曾出现计算异常；2026-08-22 保留检测便于观察）
function quantityRisk(q) {
	if (q == null) return false;
	const s = String(q).trim();
	if (!/^\d+$/.test(s)) return false;
	return /^3+$/.test(s);
}

// ────────────────────────── 参数页导航 ──────────────────────────
// 参数页必须带 workspaceId/groupId/planId 三参数，缺一页面隐藏。
// 智能复用：若当前标签页就是目标方案的参数页（URL 三参数一致），直接 reload 刷新数据即可，不必从工作台重新导航。
async function openParamsPage(page, wsId, groupId, planId) {
	const url = `${CFG.site}/page/planParams/planParams.html?workspaceId=${encodeURIComponent(wsId)}&groupId=${encodeURIComponent(groupId)}&planId=${encodeURIComponent(planId)}`;
	// 判断当前页是否已是同一参数页
	const samePage = await page.evaluate(({ ws, g, p }) => {
		if (!location.pathname.endsWith('/page/planParams/planParams.html')) return false;
		const q = new URLSearchParams(location.search);
		return q.get('workspaceId') === ws && q.get('groupId') === g && q.get('planId') === p;
	}, { ws: wsId, g: groupId, p: planId });
	if (samePage) {
		// 已在该方案参数页：刷新确保数据最新（用户建议：直接复用 + 刷新防过时）
		await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
	} else {
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
	}
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
	log(`   售价：¥${s.sale.price}  目标单量：${s.sale.quantity}${quantityRisk(s.sale.quantity) ? '  ⚠️全3数风险' : ''}  分摊：${s.sale.method}`);
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
	if (s.sale.quantity != null && quantityRisk(s.sale.quantity)) issues.push({ level: 'warn', code: 'div-bug-risk', msg: `目标单量 ${s.sale.quantity} 由全3组成，报告页可能异常（历史除法问题），建议改为≥10的倍数` });
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
	if (!key) fail('用法：set <方案名|ID> --sale-price <售价> --quantity <单量> [--method cost|fair] [--refund-bef <售前%> --refund-ing <售中%> --refund-aft <售后%>] [--ad-name <推广名> --ad-roi <ROI> --ad-rate <税率%>] [--goods "名称,件数,含税,公允,进%销%,前回收%,中回收%,后回收%"] [--gift "名称,...,视同销售|销售费用"] [--expense "名称,金额,num|per,进%[,回收%]"] [--expense-mn "名称,金额,num|per,订单%,进%,前退%,中退%,后退%[,回收%]"] [--expense-fixed "名称,金额,num|per,进%[,基于(默认利润,可选利润/收入/付款金额/销售金额)]"] [--*-del "名称"] [--group <名称|ID>]');
	const plan = await resolvePlan(page, wsId, key, flags.group);
	const salePrice = flags['sale-price'];
	const quantity = flags.quantity;
	if (salePrice === undefined || quantity === undefined) fail('set 至少需要 --sale-price <售价> 和 --quantity <单量>');
	if (!(Number(salePrice) > 0)) fail('售价必须是正数');
	if (!(Number.isInteger(Number(quantity)) && Number(quantity) > 0)) fail('单量必须是正整数');
	if (quantityRisk(quantity)) log('⚠️ 注意：单量由全3组成（历史除法风险），报告页可能异常；建议 ≥10 的倍数');
	const method = flags.method || 'cost';
	if (!['cost', 'fair'].includes(method)) fail('--method 只能是 cost 或 fair');
	// 退款比例（页面输入 %，站点内部 div(100) 存 0-1）
	const rb = flags['refund-bef'] !== undefined ? Number(flags['refund-bef']) : null;
	const ri = flags['refund-ing'] !== undefined ? Number(flags['refund-ing']) : null;
	const ra = flags['refund-aft'] !== undefined ? Number(flags['refund-aft']) : null;
	if ([rb, ri, ra].some(x => x !== null && !(x >= 0 && x <= 100))) fail('退款比例需在 0-100 之间（页面输入%）');
	const sum = (rb ?? 0) + (ri ?? 0) + (ra ?? 0);
	if (sum > 100) fail(`退款比例总和 ${sum}% 超过 100%（站点校验：总和≤100%）`);
	// 推广（按业务红线：要做推广 → ad-name 与 ad-roi 一起填；不做 → 都不填，绝不能只填 name）
	const adName = flags['ad-name'];
	const adRoi = flags['ad-roi'];
	const adRate = flags['ad-rate'];
	const adRefB = flags['ad-refund-bef'];
	const adRefI = flags['ad-refund-ing'];
	const adRefA = flags['ad-refund-aft'];
	if (adName !== undefined && adRoi === undefined) fail('要做推广必须同时给 --ad-name 和 --ad-roi（不做推广就都不要填，绝不只填推广名称）');
	if (adName === undefined && (adRoi !== undefined || adRate !== undefined || adRefB !== undefined || adRefI !== undefined || adRefA !== undefined)) fail('--ad-roi/--ad-rate/--ad-refund-* 必须配合 --ad-name 一起使用');
	if (adName !== undefined && adRoi !== undefined && !(Number(adRoi) > 0)) fail('广告 ROI 必须是正数（ROI=GMV/推广成本）');
	if (adRate !== undefined && !(Number(adRate) >= 0 && Number(adRate) <= 100)) fail('广告税率需在 0-100 之间（页面输入%）');
	if ([adRefB, adRefI, adRefA].some(x => x !== undefined && !(Number(x) >= 0 && Number(x) <= 100))) fail('广告回收率需在 0-100 之间（页面输入%）');

	await openParamsPage(page, wsId, plan.groupId, plan.id);

	// 单条删除：--goods-del <名称> / --gift-del <名称>（可多条，走表格行 .remove 按钮）
	for (const dn of (flags['goods-del'] || [])) {
		const ok = await page.evaluate(name => {
			const rows = Array.from(document.querySelectorAll('#goodsContainer tr'));
			for (const tr of rows) {
				const td0 = tr.querySelector('td.item-name');
				if (td0 && td0.textContent.trim() === name) { const b = tr.querySelector('.remove'); if (b) { b.click(); return true; } }
			}
			return false;
		}, dn);
		if (!ok) log(`⚠️ 未找到要删除的商品行：${dn}`);
		await page.waitForTimeout(300);
	}
	for (const dn of (flags['gift-del'] || [])) {
		const ok = await page.evaluate(name => {
			const rows = Array.from(document.querySelectorAll('#giftContainer tr'));
			for (const tr of rows) {
				const td0 = tr.querySelector('td.item-name');
				if (td0 && td0.textContent.trim() === name) { const b = tr.querySelector('.remove'); if (b) { b.click(); return true; } }
			}
			return false;
		}, dn);
		if (!ok) log(`⚠️ 未找到要删除的赠品行：${dn}`);
		await page.waitForTimeout(300);
	}
	for (const dn of (flags['expense-del'] || [])) {
		const ok = await page.evaluate(name => {
			const rows = Array.from(document.querySelectorAll('#expensePerOrderContainer tr'));
			for (const tr of rows) {
				const td0 = tr.querySelector('td.item-name');
				if (td0 && td0.textContent.trim() === name) { const b = tr.querySelector('.remove'); if (b) { b.click(); return true; } }
			}
			return false;
		}, dn);
		if (!ok) log(`⚠️ 未找到要删除的每单支出行：${dn}`);
		await page.waitForTimeout(300);
	}
	for (const dn of (flags['expense-mn-del'] || [])) {
		const ok = await page.evaluate(name => {
			const rows = Array.from(document.querySelectorAll('#expenseMNPerOrderContainer tr'));
			for (const tr of rows) {
				const td0 = tr.querySelector('td.item-name');
				if (td0 && td0.textContent.trim() === name) { const b = tr.querySelector('.remove'); if (b) { b.click(); return true; } }
			}
			return false;
		}, dn);
		if (!ok) log(`⚠️ 未找到要删除的部分订单支出行：${dn}`);
		await page.waitForTimeout(300);
	}
	for (const dn of (flags['expense-fixed-del'] || [])) {
		const ok = await page.evaluate(name => {
			const rows = Array.from(document.querySelectorAll('#expenseFixedContainer tr'));
			for (const tr of rows) {
				const td0 = tr.querySelector('td.item-name');
				if (td0 && td0.textContent.trim() === name) { const b = tr.querySelector('.remove'); if (b) { b.click(); return true; } }
			}
			return false;
		}, dn);
		if (!ok) log(`⚠️ 未找到要删除的固定支出行：${dn}`);
		await page.waitForTimeout(300);
	}

	// 填表单（radio 是隐藏 btn-check，点对应的 label 而不是 input 本身）
	await page.fill('#sale_price', String(salePrice));
	await page.fill('#sale_Number', String(quantity));
	await page.click(method === 'cost' ? 'label[for="sale_method_cost"]' : 'label[for="sale_method_fair"]');
	if (rb !== null) await page.fill('#refund_bef_per', String(rb));
	if (ri !== null) await page.fill('#refund_ing_per', String(ri));
	if (ra !== null) await page.fill('#refund_aft_per', String(ra));
	// 推广（ad-name 与 ad-roi 必须成对填；ad-rate 可选默认 6；ad-refund-* 可选广告回收率）
	if (adName !== undefined && adRoi !== undefined) {
		await page.fill('#advertising_name', adName);
		await page.fill('#advertising_roi', String(adRoi));
		if (adRate !== undefined) await page.fill('#advertising_rate', String(adRate));
		if (adRefB !== undefined) await page.fill('#advertising_refund_bef_rec', String(adRefB));
		if (adRefI !== undefined) await page.fill('#advertising_refund_ing_rec', String(adRefI));
		if (adRefA !== undefined) await page.fill('#advertising_refund_aft_rec', String(adRefA));
	}
	// 商品信息（--goods "名称,件数,含税成本,公允价值,进项税率%,销项税率%,售前回收%,售中回收%,售后回收%" 可多条）
	// 改名语法：--goods "旧名>新名,件数,..." —— 用旧名定位行（modify），弹窗名称填新名。
	// 按名称匹配：同名行存在 → 点该行 .modify 回填修改（不新增）；不存在 → 走"新增商品"。
	const goodsList = flags.goods || [];
	if (method === 'fair' && goodsList.length === 0) fail('分摊方式为公允(fair)时，必须提供 --goods 且每行填写公允价值（见文档：公允法每行必填公允价值）');
	for (const g of goodsList) {
		const parts = String(g).split(',').map(x => x.trim());
		if (parts.length < 4) fail('--goods 格式：名称,件数,含税成本,公允价值[,进项税率%,销项税率%,售前回收%,售中回收%,售后回收%]（最少 4 项）');
		// 支持"旧名>新名"改名语法：定位键 = 旧名，弹窗名称 = 新名
		let matchKey = parts[0];
		let newName = parts[0];
		if (parts[0].includes('>')) {
			const [oldN, newN] = parts[0].split('>').map(x => x.trim());
			matchKey = oldN; newName = newN;
			if (!oldN || !newN) fail('改名语法：--goods "旧名>新名,件数,..."');
		}
		const [gName, gNum, gCost, gFair, gInRate, gOutRate, gRefB, gRefI, gRefA] = parts;
		if (!gName) fail('商品名称不能为空');
		// 判断匹配键（旧名/原名）对应行是否已存在
		const rowInfo = await page.evaluate(name => {
			const rows = Array.from(document.querySelectorAll('#goodsContainer tr'));
			for (let i = 0; i < rows.length; i++) {
				const td0 = rows[i].querySelector('td.item-name');
				if (td0 && td0.textContent.trim() === name) return { exists: true, index: i };
			}
			return { exists: false };
		}, matchKey);
		if (rowInfo.exists) {
			// 修改单条：点该行 .modify 回填弹窗 → 改值 → 确认（走 editingRow 分支更新，不新增）
			await page.evaluate(name => {
				const rows = Array.from(document.querySelectorAll('#goodsContainer tr'));
				for (const tr of rows) {
					const td0 = tr.querySelector('td.item-name');
					if (td0 && td0.textContent.trim() === name) { const b = tr.querySelector('.modify'); if (b) b.click(); return; }
				}
			}, matchKey);
			await page.waitForSelector('#paramsModal_Goods.show', { timeout: 8000 });
		} else {
			// 新增：点列表区"新增商品"按钮打开弹窗
			await page.click('button[data-bs-target="#paramsModal_Goods"]');
			await page.waitForSelector('#paramsModal_Goods.show', { timeout: 8000 });
		}
		// 填弹窗：名称用 newName（改名场景=新名，普通场景=原名），其余覆盖传入字段
		await page.fill('#goods-name', newName);
		if (gNum !== undefined && gNum !== '') await page.fill('#goods-num', gNum);
		if (gCost !== undefined && gCost !== '') await page.fill('#goods-cost_withtax', gCost);
		if (gFair !== undefined && gFair !== '') await page.fill('#goods-fair_value', gFair);
		if (gInRate !== undefined && gInRate !== '') await page.fill('#goods-input_rate', gInRate);
		if (gOutRate !== undefined && gOutRate !== '') await page.fill('#goods-output_rate', gOutRate);
		if (gRefB !== undefined && gRefB !== '') await page.fill('#goods-refund_bef_rec', gRefB);
		if (gRefI !== undefined && gRefI !== '') await page.fill('#goods-refund_ing_rec', gRefI);
		if (gRefA !== undefined && gRefA !== '') await page.fill('#goods-refund_aft_rec', gRefA);
		// 确认（弹窗 footer"确认添加"按钮 #addGoodsBtn）
		await page.click('#paramsModal_Goods .modal-footer #addGoodsBtn');
		await page.waitForTimeout(500);
	}

	// 赠品（--gift "名称,件数,含税成本,公允价值,进项税率%,销项税率%,售前回收%,售中回收%,售后回收%,视同销售|销售费用" 可多条；subjectType 默认销售费用）
	// 改名语法同商品：--gift "旧名>新名,..."
	const giftList = flags.gift || [];
	for (const g of giftList) {
		const parts = String(g).split(',').map(x => x.trim());
		if (parts.length < 4) fail('--gift 格式：名称,件数,含税成本,公允价值[,进项税率%,销项税率%,售前回收%,售中回收%,售后回收%,视同销售|销售费用]（最少 4 项）');
		let matchKey = parts[0];
		let newName = parts[0];
		if (parts[0].includes('>')) {
			const [oldN, newN] = parts[0].split('>').map(x => x.trim());
			matchKey = oldN; newName = newN;
			if (!oldN || !newN) fail('改名语法：--gift "旧名>新名,..."');
		}
		const [gName, gNum, gCost, gFair, gInRate, gOutRate, gRefB, gRefI, gRefA, gSubj] = parts;
		if (!gName) fail('赠品名称不能为空');
		// 判断匹配键（旧名/原名）对应行是否已存在
		const rowInfo = await page.evaluate(name => {
			const rows = Array.from(document.querySelectorAll('#giftContainer tr'));
			for (let i = 0; i < rows.length; i++) {
				const td0 = rows[i].querySelector('td.item-name');
				if (td0 && td0.textContent.trim() === name) return { exists: true, index: i };
			}
			return { exists: false };
		}, matchKey);
		if (rowInfo.exists) {
			// 修改单条
			await page.evaluate(name => {
				const rows = Array.from(document.querySelectorAll('#giftContainer tr'));
				for (const tr of rows) {
					const td0 = tr.querySelector('td.item-name');
					if (td0 && td0.textContent.trim() === name) { const b = tr.querySelector('.modify'); if (b) b.click(); return; }
				}
			}, matchKey);
			await page.waitForSelector('#paramsModal_Gift.show', { timeout: 8000 });
		} else {
			// 新增
			await page.click('button[data-bs-target="#paramsModal_Gift"]');
			await page.waitForSelector('#paramsModal_Gift.show', { timeout: 8000 });
		}
		await page.fill('#gift-name', newName);
		if (gNum !== undefined && gNum !== '') await page.fill('#gift-num', gNum);
		if (gCost !== undefined && gCost !== '') await page.fill('#gift-cost_withtax', gCost);
		if (gFair !== undefined && gFair !== '') await page.fill('#gift-fair_value', gFair);
		if (gInRate !== undefined && gInRate !== '') await page.fill('#gift-input_rate', gInRate);
		if (gOutRate !== undefined && gOutRate !== '') await page.fill('#gift-output_rate', gOutRate);
		if (gRefB !== undefined && gRefB !== '') await page.fill('#gift-refund_bef_rec', gRefB);
		if (gRefI !== undefined && gRefI !== '') await page.fill('#gift-refund_ing_rec', gRefI);
		if (gRefA !== undefined && gRefA !== '') await page.fill('#gift-refund_aft_rec', gRefA);
		// 费用类型：视同销售（gift-deemedSale）或 销售费用（gift-salesExpense）
		if (gSubj !== undefined && gSubj !== '') {
			const deemed = gSubj === '视同销售';
			await page.evaluate(d => {
				document.getElementById(d ? 'gift-deemedSale' : 'gift-salesExpense').click();
			}, deemed);
		}
		await page.click('#paramsModal_Gift .modal-footer #addGiftBtn');
		await page.waitForTimeout(500);
	}

	// 每单支出（--expense "名称,金额,成本类型,进项税率%,售前回收%,售中回收%,售后回收%" 可多条；成本类型 num|per；可加第8项 含税|不含税 默认含税）
	// 格式：--expense "名称,金额,成本类型,进项税率%,售前回收%,售中回收%,售后回收%[,含税|不含税]"
	// 改名语法同商品：--expense "旧名>新名,..."
	const expenseList = flags.expense || [];
	for (const g of expenseList) {
		const parts = String(g).split(',').map(x => x.trim());
		if (parts.length < 7) fail('--expense 格式：名称,金额,成本类型(num|per),进项税率%,售前回收%,售中回收%,售后回收%[,含税|不含税]（最少 7 项）');
		let matchKey = parts[0];
		let newName = parts[0];
		if (parts[0].includes('>')) {
			const [oldN, newN] = parts[0].split('>').map(x => x.trim());
			matchKey = oldN; newName = newN;
			if (!oldN || !newN) fail('改名语法：--expense "旧名>新名,..."');
		}
		const [eName, eValue, eType, eInRate, eRefB, eRefI, eRefA, eTax] = parts;
		if (!eName) fail('支出名称不能为空');
		if (!['num', 'per'].includes(eType)) fail('成本类型只能是 num（金额）或 per（百分比）');
		// 判断匹配键对应行是否已存在
		const rowInfo = await page.evaluate(name => {
			const rows = Array.from(document.querySelectorAll('#expensePerOrderContainer tr'));
			for (let i = 0; i < rows.length; i++) {
				const td0 = rows[i].querySelector('td.item-name');
				if (td0 && td0.textContent.trim() === name) return { exists: true, index: i };
			}
			return { exists: false };
		}, matchKey);
		if (rowInfo.exists) {
			// 修改单条
			await page.evaluate(name => {
				const rows = Array.from(document.querySelectorAll('#expensePerOrderContainer tr'));
				for (const tr of rows) {
					const td0 = tr.querySelector('td.item-name');
					if (td0 && td0.textContent.trim() === name) { const b = tr.querySelector('.modify'); if (b) b.click(); return; }
				}
			}, matchKey);
			await page.waitForSelector('#paramsModal_ExpensePerOrder.show', { timeout: 8000 });
		} else {
			// 新增
			await page.click('button[data-bs-target="#paramsModal_ExpensePerOrder"]');
			await page.waitForSelector('#paramsModal_ExpensePerOrder.show', { timeout: 8000 });
		}
		await page.fill('#expensePerOrder-name', newName);
		if (eValue !== undefined && eValue !== '') await page.fill('#expensePerOrder-value', eValue);
		// 成本类型：num→cost_type_money（默认勾选），per→cost_type_percent
		if (eType === 'num') {
			await page.evaluate(() => document.getElementById('expensePerOrder-cost_type_money').click());
		} else {
			await page.evaluate(() => document.getElementById('expensePerOrder-cost_type_percent').click());
		}
		if (eInRate !== undefined && eInRate !== '') await page.fill('#expensePerOrder-input_rate', eInRate);
		if (eType === 'per') {
			// 百分比必须选来源：base 选"售价"，来源类型按 eTax 或默认含税（等选项填充好再选，见 selectExpenseBase）
			await selectExpenseBase(page, '#expensePerOrder-base');
			const tax = eTax !== undefined && eTax !== '' ? eTax : '含税';
			await page.evaluate(t => {
				document.getElementById(t === '不含税' ? 'expensePerOrder-no_tax' : 'expensePerOrder-with_tax').click();
			}, tax);
		}
		if (eRefB !== undefined && eRefB !== '') await page.fill('#expensePerOrder-refund_bef_rec', eRefB);
		if (eRefI !== undefined && eRefI !== '') await page.fill('#expensePerOrder-refund_ing_rec', eRefI);
		if (eRefA !== undefined && eRefA !== '') await page.fill('#expensePerOrder-refund_aft_rec', eRefA);
		await page.click('#paramsModal_ExpensePerOrder .modal-footer #addexpensePerOrderBtn');
		await page.waitForTimeout(500);
	}

	// 部分订单支出（--expense-mn "名称,金额,成本类型,订单比例%,进项税率%,售前退款%,售中退款%,售后退款%,售前回收%,售中回收%,售后回收%[,含税|不含税]" 可多条）
	// 成本类型 num|per；退款率是行内单独填（区别于目标模块的退款）；固定支出无此结构。
	const mnList = flags['expense-mn'] || [];
	for (const g of mnList) {
		const parts = String(g).split(',').map(x => x.trim());
		if (parts.length < 8) fail('--expense-mn 格式：名称,金额,成本类型(num|per),订单比例%,进项税率%,售前退款%,售中退款%,售后退款%[,售前回收%,售中回收%,售后回收%[,含税|不含税]]（最少 8 项）');
		let matchKey = parts[0];
		let newName = parts[0];
		if (parts[0].includes('>')) {
			const [oldN, newN] = parts[0].split('>').map(x => x.trim());
			matchKey = oldN; newName = newN;
			if (!oldN || !newN) fail('改名语法：--expense-mn "旧名>新名,..."');
		}
		const [eName, eValue, eType, eOrderPer, eInRate, eRefB, eRefI, eRefA, eRecB, eRecI, eRecA, eTax] = parts;
		if (!eName) fail('支出名称不能为空');
		if (!['num', 'per'].includes(eType)) fail('成本类型只能是 num（金额）或 per（百分比）');
		if (!(Number(eOrderPer) > 0 && Number(eOrderPer) <= 100)) fail('订单比例需在 0-100 之间（页面输入%）');
		const rowInfo = await page.evaluate(name => {
			const rows = Array.from(document.querySelectorAll('#expenseMNPerOrderContainer tr'));
			for (let i = 0; i < rows.length; i++) {
				const td0 = rows[i].querySelector('td.item-name');
				if (td0 && td0.textContent.trim() === name) return { exists: true, index: i };
			}
			return { exists: false };
		}, matchKey);
		if (rowInfo.exists) {
			await page.evaluate(name => {
				const rows = Array.from(document.querySelectorAll('#expenseMNPerOrderContainer tr'));
				for (const tr of rows) {
					const td0 = tr.querySelector('td.item-name');
					if (td0 && td0.textContent.trim() === name) { const b = tr.querySelector('.modify'); if (b) b.click(); return; }
				}
			}, matchKey);
			await page.waitForSelector('#paramsModal_ExpenseMNPerOrder.show', { timeout: 8000 });
		} else {
			await page.click('button[data-bs-target="#paramsModal_ExpenseMNPerOrder"]');
			await page.waitForSelector('#paramsModal_ExpenseMNPerOrder.show', { timeout: 8000 });
		}
		await page.fill('#expenseMNPerOrder-name', newName);
		if (eValue !== undefined && eValue !== '') await page.fill('#expenseMNPerOrder-value', eValue);
		if (eType === 'num') {
			await page.evaluate(() => document.getElementById('expenseMNPerOrder-cost_type_money').click());
		} else {
			await page.evaluate(() => document.getElementById('expenseMNPerOrder-cost_type_percent').click());
		}
		if (eOrderPer !== undefined && eOrderPer !== '') await page.fill('#expenseMNPerOrder-order_per', eOrderPer);
		if (eInRate !== undefined && eInRate !== '') await page.fill('#expenseMNPerOrder-input_rate', eInRate);
		if (eRefB !== undefined && eRefB !== '') await page.fill('#expenseMNPerOrder-refund_bef_per', eRefB);
		if (eRefI !== undefined && eRefI !== '') await page.fill('#expenseMNPerOrder-refund_ing_per', eRefI);
		if (eRefA !== undefined && eRefA !== '') await page.fill('#expenseMNPerOrder-refund_aft_per', eRefA);
		if (eRecB !== undefined && eRecB !== '') await page.fill('#expenseMNPerOrder-refund_bef_rec', eRecB);
		if (eRecI !== undefined && eRecI !== '') await page.fill('#expenseMNPerOrder-refund_ing_rec', eRecI);
		if (eRecA !== undefined && eRecA !== '') await page.fill('#expenseMNPerOrder-refund_aft_rec', eRecA);
		if (eType === 'per') {
			await selectExpenseBase(page, '#expenseMNPerOrder-base');
			const tax = eTax !== undefined && eTax !== '' ? eTax : '含税';
			await page.evaluate(t => {
				document.getElementById(t === '不含税' ? 'expenseMNPerOrder-no_tax' : 'expenseMNPerOrder-with_tax').click();
			}, tax);
		}
		await page.click('#paramsModal_ExpenseMNPerOrder .modal-footer #addexpenseMNPerOrderBtn');
		await page.waitForTimeout(500);
	}

	// 固定支出（--expense-fixed "名称,金额,成本类型,进项税率%[,基于]" 可多条；成本类型 num|per）
	// 固定支出无退款、无回收率、无含税/不含税来源类型（只有 base 来源字段）。注意：Fixed 的 base 选项是
	// ["-", "付款金额", "销售金额", "收入", "利润"]（无"售价"！与 PerOrder/MN 不同）；per 类型默认选"利润"，
	// 可用第 5 项覆盖（如 ,利润 / ,付款金额 / ,收入 / ,销售金额）。
	const fixedList = flags['expense-fixed'] || [];
	for (const g of fixedList) {
		const parts = String(g).split(',').map(x => x.trim());
		if (parts.length < 4) fail('--expense-fixed 格式：名称,金额,成本类型(num|per),进项税率%[,基于]（最少 4 项）');
		let matchKey = parts[0];
		let newName = parts[0];
		if (parts[0].includes('>')) {
			const [oldN, newN] = parts[0].split('>').map(x => x.trim());
			matchKey = oldN; newName = newN;
			if (!oldN || !newN) fail('改名语法：--expense-fixed "旧名>新名,..."');
		}
		const [eName, eValue, eType, eInRate, eBase] = parts;
		if (!eName) fail('支出名称不能为空');
		if (!['num', 'per'].includes(eType)) fail('成本类型只能是 num（金额）或 per（百分比）');
		if (eBase && !['利润', '收入', '付款金额', '销售金额'].includes(eBase)) fail(`--expense-fixed 第5项基于只能是 利润/收入/付款金额/销售金额（当前：${eBase}）`);
		const rowInfo = await page.evaluate(name => {
			const rows = Array.from(document.querySelectorAll('#expenseFixedContainer tr'));
			for (let i = 0; i < rows.length; i++) {
				const td0 = rows[i].querySelector('td.item-name');
				if (td0 && td0.textContent.trim() === name) return { exists: true, index: i };
			}
			return { exists: false };
		}, matchKey);
		if (rowInfo.exists) {
			await page.evaluate(name => {
				const rows = Array.from(document.querySelectorAll('#expenseFixedContainer tr'));
				for (const tr of rows) {
					const td0 = tr.querySelector('td.item-name');
					if (td0 && td0.textContent.trim() === name) { const b = tr.querySelector('.modify'); if (b) b.click(); return; }
				}
			}, matchKey);
			await page.waitForSelector('#paramsModal_ExpenseFixed.show', { timeout: 8000 });
		} else {
			await page.click('button[data-bs-target="#paramsModal_ExpenseFixed"]');
			await page.waitForSelector('#paramsModal_ExpenseFixed.show', { timeout: 8000 });
		}
		await page.fill('#expenseFixed-name', newName);
		if (eValue !== undefined && eValue !== '') await page.fill('#expenseFixed-value', eValue);
		if (eType === 'num') {
			await page.evaluate(() => document.getElementById('expenseFixed-cost_type_money').click());
		} else {
			await page.evaluate(() => document.getElementById('expenseFixed-cost_type_percent').click());
		}
		if (eInRate !== undefined && eInRate !== '') await page.fill('#expenseFixed-input_rate', eInRate);
		if (eType === 'per') await selectExpenseBase(page, '#expenseFixed-base', eBase || '利润');
		await page.click('#paramsModal_ExpenseFixed .modal-footer #addexpenseFixedBtn');
		await page.waitForTimeout(500);
	}

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
	if (adName !== undefined) log(`   推广：${s.advertising ? `${s.advertising.name}（ROI=${s.advertising.roi}，税率%=${s.advertising.inputRate}）` : '(未保存成功)'}`);
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
