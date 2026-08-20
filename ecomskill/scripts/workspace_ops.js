#!/usr/bin/env node
/**
 * ecomskill · 数据空间（Workspace）运维脚本
 * 站点：https://ecomplanprofitsimulator.lnsaw.com  （纯前端 + IndexedDB，无后端 API）
 *
 * 设计原则
 *   1) 写操作（新建/改名/激活/删除）一律走**真实 UI**，复用站点的名称唯一校验、激活互斥、双重确认；
 *   2) 体检（站点没有体检功能）由本脚本直接读 IndexedDB 实现；
 *   3) 所有破坏性动作必须显式 --confirm。
 *
 * 运行（Windows / Git Bash）：
 *   NODE_PATH="<托管 node workspace>/node_modules"  # 托管 node 路径见运行环境 \
 *   "<托管 node 可执行文件>" workspace_ops.js <命令> [参数]
 *
 * 命令：
 *   list                                     列出所有数据空间（含 ID / 启用态 / 库是否已初始化 / 组数 / 方案数）
 *   doctor                                   健康体检（孤儿库、缺库记录、多启用/无启用、删除残留、配额）
 *   create  <名称> [描述]                     新建数据空间（不会自动激活）
 *   rename  <名称|ID> <新名称> [新描述]        修改名称/描述
 *   activate <名称|ID>                        激活（切换当前空间；页面会自动 reload）
 *   delete  <名称|ID> --confirm               删除（高危）
 *   repair  --fix <项,项> --confirm           修复：multi-enabled | no-enabled | orphan-register | clear-deleting | request-persist
 *
 * 通用开关：--json（只输出机器可读结果）  --close（结束关闭浏览器）  --site=<url>
 * 浏览器：常驻模式。首次运行自动启动带调试端口(9222)的 Edge 并保持打开，后续命令直接连接复用，
 *         默认不关闭浏览器；需要收尾时加 --close。若已有 Edge 带 --remote-debugging-port=9222 在跑，
 *         脚本会直接连进去操作（无需关闭用户浏览器）。
 * 环境变量：ECOMPLAN_BROWSER_DIR / ECOMPLAN_BROWSER_EXE / ECOMPLAN_SITE / ECOMPLAN_HEADLESS=1 / ECOMPLAN_CDP_PORT
 */
'use strict';

const fs = require('fs');
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
const SYSTEM_DB = 'profitSimulation_systemDB'; // 系统目录库（类比 SQL Server 的 master）：站点内置、内部使用、不面向用户，只登记各用户工作区的元信息。它不是"数据空间"，脚本永不把它当工作区删除；isSystemOwnedDb() 也靠它来排除枚举。
const WS_STORE = 'workspaces';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────── 参数解析 ───────────────────────────
const rawArgs = process.argv.slice(2);
const flags = {};
const args = [];
const VALUE_FLAGS = new Set(['name', 'out', 'fix', 'site', 'desc']);   // 这些支持 "--k v" 与 "--k=v" 两种写法
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
const nowText = () => {
	const d = new Date(), p = n => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
// 中文按 2 列宽对齐，避免表格错位
const dispLen = s => [...String(s)].reduce((n, c) => n + (c.codePointAt(0) > 0x2e80 ? 2 : 1), 0);
const padTo = (s, w) => {
	s = String(s);
	if (dispLen(s) <= w) return s + ' '.repeat(w - dispLen(s));
	let out = '', cur = 0;
	for (const c of s) { const cw = c.codePointAt(0) > 0x2e80 ? 2 : 1; if (cur + cw > w) break; out += c; cur += cw; }
	return out + ' '.repeat(Math.max(0, w - cur));
};
// 浏览器/站点自身的非工作区库（不是孤儿，别当问题报）
const isSystemOwnedDb = n => n === SYSTEM_DB || /^https?_/i.test(n);

// ────────────── 注入到页面的工具集（window.__ws / window.__toasts） ──────────────
const INIT_SCRIPT = `
(() => {
  // 1) toast 采集器：站点用 bootstrap toast，autohide 2s，轮询会漏，必须用 observer
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

  // 2) IndexedDB 直连工具（站点无体检能力，只能自己读写）
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const listDbs = async () => (await indexedDB.databases()).map(d => ({ name: d.name, version: d.version }));
  const exists = async (name) => (await listDbs()).some(d => d.name === name);
  // 只打开已存在的库：indexedDB.open 对不存在的库会“顺手创建空库”，是常见污染源
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
    async quota() {
      if (!navigator.storage || !navigator.storage.estimate) return null;
      const e = await navigator.storage.estimate();
      let persisted = null;
      try { persisted = await navigator.storage.persisted(); } catch (_) {}
      return { quota: e.quota, usage: e.usage, persisted };
    },
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
    async put(dbName, store, record) {
      const db = await openExisting(dbName);
      try {
        await new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).put(record);
          tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
        });
        return true;
      } finally { db.close(); }
    },
    async del(dbName, store, key) {
      const db = await openExisting(dbName);
      try {
        await new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).delete(key);
          tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
        });
        return true;
      } finally { db.close(); }
    },
    async dropDb(dbName) {
      return await new Promise((res) => {
        const r = indexedDB.deleteDatabase(dbName);
        r.onsuccess = () => res({ ok: true });
        r.onerror = () => res({ ok: false, reason: 'error' });
        r.onblocked = () => res({ ok: false, reason: 'blocked' });
      });
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

	// 只保留一个标签页：其他标签页会持有工作区库连接，导致 deleteDatabase 被 blocked
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

// ────────────────────────── 数据读取 ──────────────────────────
// 读 systemDB.workspaces 原始记录（不经过站点实体层，避免 deleteing 被丢字段）
async function readWorkspaces(page) {
	return await page.evaluate(async ({ db, store }) => {
		if (!(await window.__ws.exists(db))) return [];
		return await window.__ws.getAll(db, store);
	}, { db: SYSTEM_DB, store: WS_STORE });
}

// 汇总视图：记录 + 库是否已初始化 + 组/方案计数
async function inspect(page) {
	const records = await readWorkspaces(page);
	const dbs = await page.evaluate(() => window.__ws.listDbs());
	const dbNames = new Set(dbs.map(d => d.name));
	const rows = [];
	for (const r of records) {
		const hasDb = dbNames.has(r.id);
		let groups = null, plans = null, params = null;
		if (hasDb) {
			const c = await page.evaluate(async id => ({
				groups: await window.__ws.count(id, 'planGroups'),
				plans: await window.__ws.count(id, 'planMetas'),
				params: await window.__ws.count(id, 'planParams'),
			}), r.id);
			groups = c.groups; plans = c.plans; params = c.params;
		}
		rows.push({
			id: r.id, name: r.name, description: r.description || '',
			enabled: r.enabled === true || r.enabled === 'true',
			createdAt: r.createdAt, updatedAt: r.updatedAt,
			deleting: r.deleteing === true || r.deleteing === 'true',
			hasDb, groups, plans, params,
		});
	}
	const unlinked = dbs.filter(d => !isSystemOwnedDb(d.name) && !records.some(r => r.id === d.name));
	const orphanDbs = unlinked.filter(d => UUID_RE.test(d.name)).map(d => ({ name: d.name, version: d.version, looksLikeWorkspace: true }));
	const otherDbs = unlinked.filter(d => !UUID_RE.test(d.name)).map(d => ({ name: d.name, version: d.version, looksLikeWorkspace: false }));
	const quota = await page.evaluate(() => window.__ws.quota());
	return { rows, orphanDbs, otherDbs, quota, dbs };
}

function pick(rows, key) {
	if (!key) return null;
	const k = String(key).trim();
	return rows.find(r => r.id === k) || rows.find(r => r.name === k) ||
		rows.filter(r => r.name.includes(k))[0] || null;
}

function printTable(rows) {
	log('');
	log('数据空间列表：（★=当前空间）');
	log('  ' + ['启用', padTo('名称', 26), '组/方案', '库', 'ID'].join(' | '));
	log('  ' + '-'.repeat(76));
	for (const r of rows) {
		log('  ' + [
			(r.enabled ? ' ★  ' : '    '),
			padTo(r.name, 26),
			padTo(r.hasDb ? `${r.groups}/${r.plans}` : '-', 7),
			(r.hasDb ? '有' : '无'),
			r.id,
		].join(' | '));
	}
	log('');
}

// ──────────────────────────── 命令实现 ────────────────────────────
async function cmdList(page) {
	const info = await inspect(page);
	printTable(info.rows);
	if (info.orphanDbs.length) log('  ⚠ 存在孤儿库（IndexedDB 里有库但 systemDB 无记录）：', info.orphanDbs.map(d => d.name).join(', '));
	result({ ok: true, cmd: 'list', total: info.rows.length, workspaces: info.rows, orphanDbs: info.orphanDbs });
}

async function cmdDoctor(page) {
	const info = await inspect(page);
	const issues = [];
	const enabled = info.rows.filter(r => r.enabled);
	if (enabled.length > 1) issues.push({ level: 'error', code: 'multi-enabled', msg: `有 ${enabled.length} 个空间同时 enabled=true（应只有 1 个）`, ids: enabled.map(r => r.id) });
	if (enabled.length === 0 && info.rows.length) issues.push({ level: 'warn', code: 'no-enabled', msg: '没有任何空间被启用（站点会兜底用列表第一个，但状态不干净）' });
	for (const r of info.rows) {
		if (r.deleting) issues.push({ level: 'error', code: 'clear-deleting', msg: `空间"${r.name}"带 deleteing=true（上次删除被阻塞/失败，数据可能已损坏）`, id: r.id });
		if (!r.hasDb) issues.push({ level: 'info', code: 'db-not-initialized', msg: `空间"${r.name}"还没有 IndexedDB 库（新建后从未激活过，属正常）`, id: r.id });
	}
	for (const d of info.orphanDbs) {
		issues.push({
			level: 'error', code: 'orphan-db',
			msg: `孤儿库 ${d.name}（UUID 形态：删除残留或 systemDB 记录丢失的数据空间，可 repair --fix orphan-register 注册回来看内容）`,
			db: d.name,
		});
	}
	if (info.quota && info.quota.persisted === false) {
		issues.push({
			level: 'warn', code: 'persistence-off',
			msg: '存储持久化未启用：磁盘紧张时浏览器可能自动清理 IndexedDB（=数据丢失）。多用几次站点提升 engagement，或 repair --fix request-persist 尝试申请',
		});
	}
	if (info.quota && info.quota.quota && info.quota.usage / info.quota.quota > 0.8) {
		issues.push({ level: 'warn', code: 'quota-high', msg: '存储使用率超过 80%，建议清理无用空间' });
	}
	// 引用完整性：planMetas.groupId 指向不存在的组；planParams 没有对应 planMeta
	for (const r of info.rows.filter(x => x.hasDb)) {
		const ref = await page.evaluate(async id => {
			const groups = await window.__ws.getAll(id, 'planGroups');
			const metas = await window.__ws.getAll(id, 'planMetas');
			const params = await window.__ws.getAll(id, 'planParams');
			const gids = new Set(groups.map(g => g.id));
			const pids = new Set(metas.map(m => m.id));
			return {
				orphanMetas: metas.filter(m => !gids.has(m.groupId)).map(m => ({ id: m.id, name: m.name, groupId: m.groupId })),
				orphanParams: params.filter(p => !pids.has(p.id)).map(p => p.id),
			};
		}, r.id);
		if (ref.orphanMetas.length) issues.push({ level: 'warn', code: 'orphan-plan', msg: `空间"${r.name}"有 ${ref.orphanMetas.length} 个方案的 groupId 指向已删除的方案组`, id: r.id, detail: ref.orphanMetas });
		if (ref.orphanParams.length) issues.push({ level: 'warn', code: 'orphan-params', msg: `空间"${r.name}"有 ${ref.orphanParams.length} 条参数记录没有对应方案（删方案时残留）`, id: r.id, detail: ref.orphanParams });
	}

	printTable(info.rows);
	if (info.quota) {
		const mb = n => (n / 1024 / 1024).toFixed(2) + ' MB';
		log(`  存储：已用 ${mb(info.quota.usage)} / 配额 ${mb(info.quota.quota)}，持久化=${info.quota.persisted ? '已启用' : '未启用'}`);
	}
	if (info.otherDbs.length) log('  其它非工作区库（一般无需处理）：' + info.otherDbs.map(d => d.name).join(', '));
	log('');
	if (!issues.length) log('  ✅ 体检通过，未发现问题');
	for (const i of issues) log(`  ${i.level === 'error' ? '❌' : i.level === 'warn' ? '⚠️ ' : 'ℹ️ '} [${i.code}] ${i.msg}`);
	log('');
	result({ ok: true, cmd: 'doctor', workspaces: info.rows, orphanDbs: info.orphanDbs, otherDbs: info.otherDbs, quota: info.quota, issues });
}

async function cmdCreate(page) {
	const name = args[0];
	const desc = args[1] || '';
	if (!name) fail('用法：create <名称> [描述]');
	const before = await readWorkspaces(page);
	if (before.some(r => r.name === name)) fail(`名称已存在："${name}"（站点强制唯一，请换名或直接使用现有空间）`);

	await openPanel(page);
	const t0 = await toastCount(page);
	await page.click('#create-space-btn');
	await page.waitForSelector('#workspace-edit-modal.show', { timeout: 10000 });
	await page.fill('#workspace-name-input', name);
	await page.fill('#workspace-description-input', desc);
	await page.click('#save-workspace-btn');
	const tl = await waitToast(page, t0);
	const err = tl.find(t => t.type === 'danger');
	if (err) fail('站点拒绝：' + err.text, { toasts: tl });
	await page.waitForTimeout(600);

	const after = await readWorkspaces(page);
	const created = after.find(r => r.name === name);
	if (!created) fail('创建后未在 systemDB 中找到该记录', { toasts: tl });
	log(`✅ 已新建数据空间："${name}"  id=${created.id}`);
	log('   注意：新建后并未激活，也还没有 IndexedDB 库；激活后（activate）才会真正创建库。');
	result({ ok: true, cmd: 'create', id: created.id, name, description: desc, enabled: false, toasts: tl });
}

async function cmdRename(page) {
	const key = args[0], newName = args[1], newDesc = args[2];
	if (!key || !newName) fail('用法：rename <名称|ID> <新名称> [新描述]');
	const info = await inspect(page);
	const row = pick(info.rows, key);
	if (!row) fail(`未找到数据空间：${key}`, { candidates: info.rows.map(r => r.name) });
	if (info.rows.some(r => r.name === newName && r.id !== row.id)) fail(`新名称已被占用："${newName}"`);

	await openPanel(page);
	const idx = await rowIndex(page, row.name);
	if (idx < 0) fail('面板表格中未找到该行：' + row.name);
	const t0 = await toastCount(page);
	await page.locator('#workspace-table-body tr').nth(idx).locator('.workspace-edit-btn').click();
	await page.waitForSelector('#workspace-edit-modal.show', { timeout: 10000 });
	await page.fill('#workspace-name-input', newName);
	if (newDesc !== undefined) await page.fill('#workspace-description-input', newDesc);
	await page.click('#save-workspace-btn');
	const tl = await waitToast(page, t0);
	const err = tl.find(t => t.type === 'danger');
	if (err) fail('站点拒绝：' + err.text, { toasts: tl });
	await page.waitForTimeout(600);

	const after = await readWorkspaces(page);
	const rec = after.find(r => r.id === row.id);
	log(`✅ 已更新：${row.name} → ${rec ? rec.name : newName}`);
	result({ ok: true, cmd: 'rename', id: row.id, oldName: row.name, newName: rec ? rec.name : newName, description: rec ? rec.description : newDesc, toasts: tl });
}

async function rowIndex(page, name) {
	return await page.evaluate(n => {
		const rows = Array.from(document.querySelectorAll('#workspace-table-body tr'));
		return rows.findIndex(r => r.children[0] && r.children[0].textContent.trim() === n);
	}, name);
}

async function cmdActivate(page) {
	const key = args[0];
	if (!key) fail('用法：activate <名称|ID>');
	const info = await inspect(page);
	const row = pick(info.rows, key);
	if (!row) fail(`未找到数据空间：${key}`, { candidates: info.rows.map(r => r.name) });
	if (row.enabled) {
		log(`ℹ️ "${row.name}" 已经是当前空间，无需激活`);
		return result({ ok: true, cmd: 'activate', id: row.id, name: row.name, alreadyActive: true });
	}

	await openPanel(page);
	const idx = await rowIndex(page, row.name);
	if (idx < 0) fail('面板表格中未找到该行：' + row.name);
	// 站点激活成功后直接 location.reload()，必须等重载完成再校验
	await Promise.all([
		page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { }),
		page.locator('#workspace-table-body tr').nth(idx).locator('.workspace-activate-btn').click(),
	]);
	await waitReady(page);
	const topbar = (await page.textContent('#current-workspace-name')).trim();
	const after = await readWorkspaces(page);
	const enabled = after.filter(r => r.enabled === true || r.enabled === 'true').map(r => r.name);
	if (!topbar.includes(row.name)) fail(`激活后顶栏显示为「${topbar}」，与目标不一致`, { enabled });
	log(`✅ 已激活："${row.name}"（顶栏：${topbar}）`);
	result({ ok: true, cmd: 'activate', id: row.id, name: row.name, topbar, enabled });
}

async function cmdDelete(page) {
	const key = args[0];
	if (!key) fail('用法：delete <名称|ID> --confirm');
	const info = await inspect(page);
	const row = pick(info.rows, key);
	if (!row) fail(`未找到数据空间：${key}`, { candidates: info.rows.map(r => r.name) });
	if (row.enabled) fail(`"${row.name}" 是当前启用的空间，站点禁止删除：请先 activate 另一个空间再删`);
	if (!flags.confirm) {
		log('⚠️ 这是不可恢复的高危操作。将删除：');
		log(`   名称：${row.name}   id=${row.id}`);
		log(`   内容：${row.hasDb ? `${row.groups} 个方案组 / ${row.plans} 个方案` : '尚未初始化（无库）'}`);
		log('   确认无误后加 --confirm 重新执行。');
		return result({ ok: false, cmd: 'delete', needConfirm: true, target: row });
	}

	await openPanel(page);
	const idx = await rowIndex(page, row.name);
	if (idx < 0) fail('面板表格中未找到该行：' + row.name);
	const t0 = await toastCount(page);
	await page.locator('#workspace-table-body tr').nth(idx).locator('.workspace-remove-btn').click();
	await page.waitForSelector('#remove-workspace-confirm-modal.show', { timeout: 10000 });
	await page.click('#remove-workspace-confirm-btn');                       // 第一次确认
	await page.waitForSelector('#remove-workspace-confirm-modal-agin.show', { timeout: 10000 });
	await page.click('#remove-workspace-confirm-btn-agin');                   // 二次确认（真正执行）
	const tl = await waitToast(page, t0, 15000);
	await page.waitForTimeout(1000);

	const after = await inspect(page);
	const recordGone = !after.rows.some(r => r.id === row.id);
	const dbGone = !after.dbs.some(d => d.name === row.id);
	if (recordGone && dbGone) {
		log(`✅ 已删除："${row.name}"（记录与 IndexedDB 库均已清除）`);
		return result({ ok: true, cmd: 'delete', id: row.id, name: row.name, toasts: tl });
	}
	log(`❌ 删除未完全成功：记录${recordGone ? '已删' : '仍在'}，库${dbGone ? '已删' : '仍在'}`);
	log('   最常见原因：还有别的标签页/窗口打开着该空间的页面，deleteDatabase 被 blocked。');
	log('   处理：关闭其它所有标签页与浏览器窗口后重试；再用 doctor 检查 deleteing 标记与孤儿库。');
	result({ ok: false, cmd: 'delete', id: row.id, name: row.name, recordGone, dbGone, toasts: tl });
}

async function cmdRepair(page) {
	const fixes = String(flags.fix || '').split(',').map(s => s.trim()).filter(Boolean);
	if (!fixes.length) fail('用法：repair --fix multi-enabled,no-enabled,orphan-register,clear-deleting,request-persist --confirm');
	if (!flags.confirm) fail('修复会写入 IndexedDB，请加 --confirm 确认');

	const info = await inspect(page);
	const done = [];

	if (fixes.includes('multi-enabled')) {
		const enabled = info.rows.filter(r => r.enabled);
		if (enabled.length > 1) {
			const keep = enabled.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
			for (const r of enabled) {
				if (r.id === keep.id) continue;
				await page.evaluate(async ({ db, store, id }) => {
					const all = await window.__ws.getAll(db, store);
					const rec = all.find(x => x.id === id);
					rec.enabled = false;
					await window.__ws.put(db, store, rec);
				}, { db: SYSTEM_DB, store: WS_STORE, id: r.id });
				done.push({ fix: 'multi-enabled', action: 'disable', id: r.id, name: r.name });
			}
			done.push({ fix: 'multi-enabled', action: 'keep', id: keep.id, name: keep.name });
		}
	}

	if (fixes.includes('no-enabled') && !info.rows.some(r => r.enabled) && info.rows.length) {
		const keep = info.rows.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
		await page.evaluate(async ({ db, store, id }) => {
			const all = await window.__ws.getAll(db, store);
			const rec = all.find(x => x.id === id);
			rec.enabled = true;
			await window.__ws.put(db, store, rec);
		}, { db: SYSTEM_DB, store: WS_STORE, id: keep.id });
		done.push({ fix: 'no-enabled', action: 'enable', id: keep.id, name: keep.name });
	}

	if (fixes.includes('orphan-register')) {
		for (const d of info.orphanDbs.filter(x => x.looksLikeWorkspace)) {
			const rec = {
				id: d.name,
				name: `注册空间-${d.name.slice(0, 8)}`,
				description: `repair 自动注册的孤儿库（${nowText()}）`,
				createdAt: nowText(), updatedAt: nowText(),
				enabled: false,
			};
			await page.evaluate(async ({ db, store, rec }) => window.__ws.put(db, store, rec), { db: SYSTEM_DB, store: WS_STORE, rec });
			done.push({ fix: 'orphan-register', action: 'register', id: rec.id, name: rec.name });
		}
	}

	if (fixes.includes('clear-deleting')) {
		for (const r of info.rows.filter(x => x.deleting)) {
			const res = await page.evaluate(async ({ db, store, id }) => {
				const dropped = await window.__ws.dropDb(id);          // 再试一次删库
				if (dropped.ok) { await window.__ws.del(db, store, id); return { dropped: true, recordRemoved: true }; }
				return { dropped: false, reason: dropped.reason };
			}, { db: SYSTEM_DB, store: WS_STORE, id: r.id });
			done.push({ fix: 'clear-deleting', id: r.id, name: r.name, ...res });
		}
	}

	if (fixes.includes('request-persist')) {
		const r = await page.evaluate(async () => {
			if (!navigator.storage || !navigator.storage.persist) return { supported: false };
			return { supported: true, granted: await navigator.storage.persist() };
		});
		done.push({ fix: 'request-persist', ...r });
		if (r.supported && !r.granted) log('   ⚠ 浏览器拒绝了持久化申请（通常需要站点被"安装"或更多使用记录），可稍后再试');
	}

	if (!done.length) log('ℹ️ 没有需要修复的项');
	for (const d of done) log(`🔧 ${d.fix}: ${JSON.stringify(d)}`);
	result({ ok: true, cmd: 'repair', fixes, done });
}

// ──────────────────────────── 入口 ────────────────────────────
(async () => {
	const handlers = {
		list: cmdList, doctor: cmdDoctor, create: cmdCreate, rename: cmdRename,
		activate: cmdActivate, delete: cmdDelete, repair: cmdRepair,
	};
	if (!handlers[CMD]) {
		console.log('未知命令：' + CMD);
		console.log('可用：list | doctor | create | rename | activate | delete | repair');
		process.exit(1);
	}
	const b = await openWorkbench();
	try {
		await handlers[CMD](b.page);
	} finally {
		// 常驻模式：默认不关闭浏览器；--close 才关（用 CDP Browser.close 真正关闭浏览器进程）。
		// 无论如何都要断开 CDP 连接，否则 Node 进程因 websocket 连接不退出，bash 会挂起（管道截断假象）。
		if (flags.close) {
			try { const s = await b.browser.newBrowserCDPSession(); await s.send('Browser.close'); } catch (_) { }
		}
		await b.browser.close().catch(() => { }); // 断开 CDP 连接（不杀浏览器进程，浏览器保持常驻）
	}
})().catch(e => {
	console.error('FATAL: ' + (e && e.message ? e.message : e));
	result({ ok: false, cmd: CMD, error: String(e && e.message ? e.message : e) });
	process.exit(1);
});
