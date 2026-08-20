#!/usr/bin/env node
/**
 * ecomskill · 方案（PlanMeta）运维脚本
 * 站点：https://ecomplanprofitsimulator.lnsaw.com  （纯前端 + IndexedDB，无后端 API）
 *
 * 数据模型（已核对 PlanMetaManager.js / Repository_PlanMeta.js / Entity_PlanMeta.js / workbench.js）
 *   - 方案存于【当前工作区库】的 planMetas store（keyPath id），通过 groupId 关联方案组。
 *   - 方案字段：id(UUID) / groupId(UUID，外键方案组) / name(必填) / description(可空) /
 *              enabled(布尔，默认 false) / createdAt / updatedAt（格式 YYYY-MM-DD HH:mm:ss，与工作区/方案组一致；to_yyyymmdd_hhmmss 函数名 misleading）。
 *   - 参数存于同库的 planParams store（keyPath = 方案的 id，一对一），与方案是"兄弟"关系，不随方案删除而删除。
 *
 * 设计原则（与 workspace_ops.js / plan_group_ops.js 一致）
 *   1) 写操作（新建/修改/删除）一律走**真实 UI**，复用站点的名称唯一校验（按方案组作用域）；
 *   2) 读/查找 直接读 IndexedDB（绕过 UI 渲染，拿全量数据）；
 *   3) 删除高危，必须显式 --confirm。
 *
 * ⚠️ 源码级坑（已核对源码）
 *   - 方案列表完全绑定"当前激活的方案组"：激活组的回调会调用 loadPlanMetasByGroup() 渲染该组方案。
 *     因此 新建/修改/删除 前，脚本会先激活目标方案组（点 .group-item[data-group-id]）。无激活组时
 *     新建会直接 toast「请先选择一个方案组」。
 *   - 方案名唯一性在 Repository 层校验（isPlanMetaNameExists，按 groupId 作用域）：同一方案组内重名才冲突，
 *     跨组允许同名。撞重名时 Repository 抛错被 Manager catch 成通用"保存方案失败"。脚本写前自校验并给清晰报错。
 *   - 空名称会被 Entity 的 setter 拒绝（stringNotEmptyAndWhitespace），UI 表现为"保存方案失败"。脚本写前自校验非空。
 *   - 删除方案【不级联】删除参数：confirmDelete 只删 planMetas，planParams 记录变孤儿（删整个方案组同理）。
 *     本脚本内置只读的 params 命令用于审计孤儿参数。
 *   - 时间格式 YYYY-MM-DD HH:mm:ss（来自 Entity_Base.to_yyyymmdd_hhmmss，函数名 misleading 但实际带分隔符；与工作区/方案组一致）。
 *   - 保存成功 toast 文案为「方案更新成功」（源码 ternary 判断写反，create/modify 都显示这条），不可据此区分创建/修改；
 *     脚本一律以"读回 IndexedDB 校验"为准。
 *
 * 运行（Windows / Git Bash）：
 *   NODE_PATH="<托管 node workspace>/node_modules"  # 托管 node 路径见运行环境 \
 *   "<托管 node 可执行文件>" plan_meta_ops.js <命令> [参数]
 *
 * 命令：
 *   list                                     列出工作区全部方案（可加 --group 限定方案组；绕开 UI 渲染）
 *   find   <关键词>                           按名称/描述模糊查找（大小写不敏感，含子串）
 *   count                                    工作区方案数量
 *   create <名称> [描述] [--group <名称|ID>]   新建方案（走 UI；须指定方案组，或用页面当前激活组）
 *   rename <ID|名称> <新名称> [新描述]          修改方案（走 UI；按 ID 或名称定位，自动激活其所属方案组）
 *   delete <ID|名称> --confirm [--group]      删除方案（走 UI；高危需 --confirm；参数不级联，会留孤儿）
 *   params                                   只读体检：列出 planParams，标记孤儿（对应方案已不存在）
 *
 * 通用开关：--workspace <名称|ID>  指定目标工作区（默认当前启用的工作区；非当前则先切换并 reload）
 *           --group <名称|ID>      指定方案组（create/rename/delete/list/find 可用）
 *           --json（只输出机器可读结果）  --close（结束关闭浏览器）  --site=<url>
 * 浏览器：常驻模式。首次运行自动启动带调试端口(9222)的 Edge 并保持打开，后续命令直接连接复用，
 *         默认不关闭浏览器；需要收尾时加 --close。若已有 Edge 带 --remote-debugging-port=9222 在跑，
 *         脚本会直接连进去操作（无需关闭用户浏览器）。
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
const VALUE_FLAGS = new Set(['workspace', 'group', 'site']); // 这些支持 "--k v" 与 "--k=v"
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
// 返回目标工作区记录（id 即该工作区的 IndexedDB 库名）。若指定 --workspace 且非当前，先激活（会 reload）。
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

	// 需要切换工作区（站点 activate 会 location.reload）
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

// ────────────────────────── 方案组 / 方案 读取 ──────────────────────────
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

// 修改/删除只作用于"当前激活的方案组"下渲染出的方案，因此先把它点出来。
// 列表无分页，但保险起见仍用搜索框过滤 + 精确 data-group-id 点击激活。
async function activateGroup(page, wsId, groupId) {
	const groups = await listGroups(page, wsId);
	const g = groups.find(x => x.id === groupId);
	if (!g) fail('方案组不存在：' + groupId);

	await page.fill('#group-search', g.name);
	await page.waitForSelector(`.group-item[data-group-id="${groupId}"]`, { timeout: 10000 });
	await page.click(`.group-item[data-group-id="${groupId}"]`);
	await page.waitForFunction(name => {
		const el = document.getElementById('active-group-name');
		if (!el) return false;
		const t = el.textContent.trim();
		return t.length > 0 && t !== '方案组详情';
	}, g.name, { timeout: 8000 });
	await page.waitForTimeout(300);
}

// 确保目标方案组处于激活态（currentPlanGroup 已设置），返回该组对象。
// 不传 groupKey 时，若页面已有激活组则复用，否则报错要求指定 --group。
async function ensureGroup(page, wsId, groupKey) {
	const groups = await listGroups(page, wsId);
	let group;
	if (groupKey) {
		group = resolveGroup(groups, groupKey);
	} else {
		const activeName = await page.evaluate(() => {
			const el = document.getElementById('active-group-name');
			return el ? el.textContent.trim() : '';
		});
		if (!activeName || activeName === '方案组详情') fail('未指定 --group，且当前页面没有激活的方案组。请用 --group <名称|ID> 指定。');
		group = groups.find(g => g.name === activeName);
		if (!group) fail('页面激活的方案组在目录中找不到：' + activeName);
	}
	const curName = await page.evaluate(() => {
		const el = document.getElementById('active-group-name');
		return el ? el.textContent.trim() : '';
	});
	if (curName !== group.name) await activateGroup(page, wsId, group.id);
	return group;
}

// 在已激活方案组的方案列表中，用搜索框过滤并精确匹配某方案的 .plan-item，点击其 edit/delete 按钮。
async function clickPlanAction(page, name, which) {
	await page.waitForSelector('.plan-item', { timeout: 10000 }).catch(() => { });
	await page.fill('#plan-search', name);
	await page.waitForTimeout(350);
	const ok = await page.evaluate(({ n, w }) => {
		const items = Array.from(document.querySelectorAll('.plan-item'));
		const target = items.find(el => {
			const x = el.querySelector('.plan-item-name');
			return x && x.textContent.trim() === n;
		});
		if (!target) return false;
		const btn = target.querySelector(w === 'delete' ? '.plan-delete-btn' : '.plan-edit-btn');
		if (!btn) return false;
		btn.click();
		return true;
	}, { n: name, w: which });
	if (!ok) fail(`方案列表未渲染出目标方案："${name}"（请确认该方案所属的方案组已激活）`);
}

// ──────────────────────────── 命令实现 ────────────────────────────
async function cmdList(page, wsId, wsName) {
	const groups = await listGroups(page, wsId);
	const groupName = id => (groups.find(g => g.id === id) || {}).name || id;
	let plans = await listPlans(page, wsId);
	let scopeLabel = '';
	if (flags.group) {
		const g = resolveGroup(groups, flags.group);
		plans = plans.filter(p => p.groupId === g.id);
		scopeLabel = '，方案组：' + g.name;
	}
	log(`\n方案列表（工作区：${wsName}${scopeLabel}，共 ${plans.length} 个）：`);
	log('  ' + [padTo('方案名', 24), padTo('所属方案组', 20), padTo('ID', 38), padTo('启用', 4), '更新时间'].join(' | '));
	log('  ' + '-'.repeat(98));
	for (const p of plans) {
		log('  ' + [padTo(p.name, 24), padTo(groupName(p.groupId), 20), padTo(p.id, 38), padTo(p.enabled ? '是' : '否', 4), p.updatedAt || ''].join(' | '));
	}
	log('');
	result({ ok: true, cmd: 'list', workspace: wsName, workspaceId: wsId, group: flags.group || null, total: plans.length, plans });
}

async function cmdFind(page, wsId, wsName) {
	const kw = (args[0] || '').trim().toLowerCase();
	if (!kw) fail('用法：find <关键词>');
	const groups = await listGroups(page, wsId);
	const groupName = id => (groups.find(g => g.id === id) || {}).name || id;
	let plans = await listPlans(page, wsId);
	if (flags.group) {
		const g = resolveGroup(groups, flags.group);
		plans = plans.filter(p => p.groupId === g.id);
	}
	const hit = plans.filter(p => (p.name || '').toLowerCase().includes(kw) || (p.description || '').toLowerCase().includes(kw));
	log(`\n查找"${kw}"（工作区：${wsName}）：命中 ${hit.length} 个`);
	for (const p of hit) log('  • ' + padTo(p.name, 24) + '  ' + groupName(p.groupId) + '  ' + p.id);
	log('');
	result({ ok: true, cmd: 'find', keyword: kw, workspace: wsName, workspaceId: wsId, group: flags.group || null, total: hit.length, plans: hit });
}

async function cmdCount(page, wsId, wsName) {
	const groups = await listGroups(page, wsId);
	let plans = await listPlans(page, wsId);
	let scopeLabel = '';
	if (flags.group) {
		const g = resolveGroup(groups, flags.group);
		plans = plans.filter(p => p.groupId === g.id);
		scopeLabel = '（方案组：' + g.name + '）';
	}
	log(`工作区「${wsName}」${scopeLabel}共有 ${plans.length} 个方案`);
	result({ ok: true, cmd: 'count', workspace: wsName, workspaceId: wsId, group: flags.group || null, total: plans.length });
}

async function cmdCreate(page, wsId, wsName) {
	const name = args[0];
	const desc = args[1] || '';
	if (!name) fail('用法：create <名称> [描述] [--group <名称|ID>]');
	if (!name.trim()) fail('方案名称不能为空');
	const group = await ensureGroup(page, wsId, flags.group);
	// 写前自校验：同方案组内名称唯一
	const plans = await listPlans(page, wsId);
	if (plans.some(p => p.groupId === group.id && p.name === name)) fail(`该方案组内已存在同名方案："${name}"`);

	const t0 = await toastCount(page);
	await page.click('#create-plan-btn');
	await page.waitForSelector('#plan-edit-modal.show', { timeout: 10000 });
	await page.fill('#plan-name-input', name);
	await page.fill('#plan-description-input', desc);
	await page.click('#save-plan-btn');
	const toastList = await waitToast(page, t0);
	const danger = toastList.find(t => t.type === 'danger');
	if (danger) fail('站点拒绝：' + danger.text, { toasts: toastList });
	await page.waitForTimeout(600);

	const after = await listPlans(page, wsId);
	const created = after.find(p => p.groupId === group.id && p.name === name);
	if (!created) fail('创建后未在 planMetas 中找到该记录', { toasts: toastList });
	log(`✅ 已新建方案："${name}"  id=${created.id}（方案组：${group.name}，工作区：${wsName}）`);
	result({ ok: true, cmd: 'create', id: created.id, name, description: desc, groupId: group.id, groupName: group.name, workspace: wsName, toasts: toastList });
}

async function cmdRename(page, wsId, wsName) {
	const key = args[0], newName = args[1], newDesc = args[2];
	if (!key || !newName) fail('用法：rename <ID|名称> <新名称> [新描述] [--group <名称|ID>]');
	if (!newName.trim()) fail('新方案名称不能为空');
	const plan = await resolvePlan(page, wsId, key, flags.group);
	// 写前自校验：同方案组内新名称唯一（排除自身）
	const plans = await listPlans(page, wsId);
	if (plans.some(p => p.groupId === plan.groupId && p.name === newName && p.id !== plan.id)) fail(`该方案组内已存在同名方案："${newName}"`);

	const group = await ensureGroup(page, wsId, plan.groupId);
	await clickPlanAction(page, plan.name, 'edit');
	await page.waitForSelector('#plan-edit-modal.show', { timeout: 10000 });
	await page.fill('#plan-name-input', newName);
	if (newDesc !== undefined) await page.fill('#plan-description-input', newDesc);
	const t0 = await toastCount(page);
	await page.click('#save-plan-btn');
	const toastList = await waitToast(page, t0);
	const danger = toastList.find(t => t.type === 'danger');
	if (danger) fail('站点拒绝：' + danger.text, { toasts: toastList });
	await page.waitForTimeout(600);

	const after = await listPlans(page, wsId);
	const rec = after.find(p => p.id === plan.id);
	log(`✅ 已更新方案：${plan.name} → ${rec ? rec.name : newName}（方案组：${group.name}，工作区：${wsName}）`);
	result({ ok: true, cmd: 'rename', id: plan.id, oldName: plan.name, newName: rec ? rec.name : newName, description: rec ? rec.description : newDesc, groupId: plan.groupId, groupName: group.name, workspace: wsName, toasts: toastList });
}

async function cmdDelete(page, wsId, wsName) {
	const key = args[0];
	if (!key) fail('用法：delete <ID|名称> --confirm [--group <名称|ID>]');
	const plan = await resolvePlan(page, wsId, key, flags.group);
	if (!flags.confirm) {
		const groups = await listGroups(page, wsId);
		const gname = (groups.find(g => g.id === plan.groupId) || {}).name || plan.groupId;
		log('⚠️ 这是不可恢复的高危操作。将删除方案：');
		log(`   名称：${plan.name}  id=${plan.id}（方案组：${gname}，工作区：${wsName}）`);
		log('   注意：UI 删除【不会】级联删除该方案的参数(planParams)，参数记录将变为孤儿，需另行清理（见 params 命令）。');
		log('   确认无误后加 --confirm 重新执行。');
		return result({ ok: false, cmd: 'delete', needConfirm: true, target: plan });
	}

	const group = await ensureGroup(page, wsId, plan.groupId);
	await clickPlanAction(page, plan.name, 'delete');
	await page.waitForSelector('#remove-plan-confirm-modal.show', { timeout: 10000 });
	const t0 = await toastCount(page);
	await page.click('#remove-plan-confirm-btn');
	const toastList = await waitToast(page, t0);
	const danger = toastList.find(t => t.type === 'danger');
	if (danger) fail('站点拒绝：' + danger.text, { toasts: toastList });
	await page.waitForTimeout(600);

	const after = await listPlans(page, wsId);
	const gone = !after.some(p => p.id === plan.id);
	if (gone) {
		log(`✅ 已删除方案："${plan.name}"（方案组：${group.name}，工作区：${wsName}；其参数已成孤儿，见 params 命令）`);
		return result({ ok: true, cmd: 'delete', id: plan.id, name: plan.name, groupId: plan.groupId, groupName: group.name, workspace: wsName, toasts: toastList });
	}
	log('❌ 删除后记录仍在，请重试（最常见原因：还有别的标签页打开着该页面）');
	result({ ok: false, cmd: 'delete', id: plan.id, name: plan.name, message: '删除后记录仍在', toasts: toastList });
}

// 只读体检：列出 planParams，标记孤儿（对应方案已不存在）
async function cmdParams(page, wsId, wsName) {
	const [metas, params] = await Promise.all([
		page.evaluate(async (db) => window.__ws.exists(db) ? await window.__ws.getAll(db, 'planMetas') : [], wsId),
		page.evaluate(async (db) => window.__ws.exists(db) ? await window.__ws.getAll(db, 'planParams') : [], wsId),
	]);
	const metaIds = new Set(metas.map(m => m.id));
	const rows = params.map(p => ({ id: p.id, orphan: !metaIds.has(p.id) }));
	const orphans = rows.filter(r => r.orphan);
	log(`\n参数(planParams)体检（工作区：${wsName}）：`);
	log(`   方案记录数：${metas.length}  参数记录数：${params.length}  孤儿参数：${orphans.length}`);
	if (orphans.length) {
		log('   孤儿参数（对应方案已不存在，占空间且可能干扰导出/统计）：');
		for (const o of orphans) log('     • ' + o.id);
	}
	log('');
	result({ ok: true, cmd: 'params', workspace: wsName, workspaceId: wsId, planMetaCount: metas.length, paramCount: params.length, orphanCount: orphans.length, orphans: orphans.map(o => ({ id: o.id })) });
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
			case 'find': await cmdFind(page, wsId, wsName); break;
			case 'count': await cmdCount(page, wsId, wsName); break;
			case 'create': await cmdCreate(page, wsId, wsName); break;
			case 'rename': await cmdRename(page, wsId, wsName); break;
			case 'delete': await cmdDelete(page, wsId, wsName); break;
			case 'params': await cmdParams(page, wsId, wsName); break;
			default: fail('未知命令：' + CMD + '（支持 list / find / count / create / rename / delete / params）');
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
