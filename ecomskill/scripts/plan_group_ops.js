#!/usr/bin/env node
/**
 * ecomskill · 方案组（PlanGroup）运维脚本
 * 站点：https://ecomplanprofitsimulator.lnsaw.com  （纯前端 + IndexedDB，无后端 API）
 *
 * 设计原则（与 workspace_ops.js 一致）
 *   1) 写操作（新建/修改/删除）一律走**真实 UI**，复用站点的名称唯一校验、级联删除；
 *   2) 读/查找 直接读 IndexedDB（绕过 UI 分页，拿全量数据）；
 *   3) 删除高危，必须显式 --confirm；UI 删除会**级联删除该组下的方案**。
 *
 * ⚠️ 源码级坑（已核对 PlanGroupManager.js / Repository_PlanGroup.js / workbench.js）
 *   - 站点 UI 层"重名校验"误用了 workspace 弹窗的输入框（#workspace-name-input），
 *     所以"方案组名称已存在"这个守卫实质失效；真正的唯一性由 Repository 层拦截，
 *     但被 catch 后只显示通用的"保存方案组失败"。本脚本在写前**自校验唯一性**并给清晰报错。
 *   - 修改/删除只作用于"当前激活的方案组"，脚本会先点击 .group-item 激活目标组。
 *   - 列表 UI 有分页（pageSize 1~20），脚本 list/find 直连 IDB 读全量，不依赖渲染。
 *
 * 运行（Windows / Git Bash）：
 *   NODE_PATH="C:/Users/wamzm/.workbuddy/binaries/node/workspace/node_modules" \
 *   "C:/Users/wamzm/.workbuddy/binaries/node/versions/22.22.2/node.exe" plan_group_ops.js <命令> [参数]
 *
 * 命令：
 *   list                                      列出当前工作区全部方案组（绕过分页）
 *   find   <关键词>                            按名称/描述模糊查找（大小写不敏感，含子串）
 *   count                                     当前工作区方案组数量
 *   create <名称> [描述]                       新建方案组（走 UI）
 *   rename <ID|名称> <新名称> [新描述]          修改方案组（走 UI；须先用 ID 或名称定位并激活）
 *   delete <ID|名称> --confirm [--cascade]     删除方案组（走 UI，级联删方案；高危需 --confirm）
 *
 * 通用开关：--workspace <名称|ID>  指定目标工作区（默认当前启用的工作区；非当前则先切换并 reload）
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────── 参数解析 ───────────────────────────
const rawArgs = process.argv.slice(2);
const flags = {};
const args = [];
const VALUE_FLAGS = new Set(['workspace', 'site']); // 这些支持 "--k v" 与 "--k=v"
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

// ────────────────────────── 方案组读取 ──────────────────────────
async function listGroups(page, wsId) {
	const raw = await page.evaluate(async (dbName) => {
		if (!(await window.__ws.exists(dbName))) return [];
		return await window.__ws.getAll(dbName, 'planGroups');
	}, wsId);
	return raw.map(g => {
		const pc = g.planCount;
		const count = pc == null ? 0 : (typeof pc === 'object' ? Number(pc.value ?? 0) : Number(pc));
		return {
			id: g.id,
			name: g.name,
			description: g.description || '',
			planCount: count,
			createdAt: g.createdAt,
			updatedAt: g.updatedAt,
		};
	});
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

// 修改/删除只作用于"当前激活的方案组"，因此先把它点出来。
// 列表有分页，先用搜索框过滤确保目标渲染出来，再按精确 data-group-id 点击激活。
async function activateGroup(page, wsId, groupId) {
	const groups = await listGroups(page, wsId);
	const g = groups.find(x => x.id === groupId);
	if (!g) fail('方案组不存在：' + groupId);

	// 让目标出现在渲染结果里（即便原列表被分页隐藏）
	await page.fill('#group-search', g.name);
	await page.waitForSelector(`.group-item[data-group-id="${groupId}"]`, { timeout: 10000 });
	await page.click(`.group-item[data-group-id="${groupId}"]`);
	// 等待 manager 把 currentPlanGroup 设为该组（详情面板标题从占位"方案组详情"变成组名）
	await page.waitForFunction(name => {
		const el = document.getElementById('active-group-name');
		if (!el) return false;
		const t = el.textContent.trim();
		return t.length > 0 && t !== '方案组详情';
	}, g.name, { timeout: 8000 });
	await page.waitForTimeout(300);
}

// ──────────────────────────── 命令实现 ────────────────────────────
async function cmdList(page, wsId, wsName) {
	const groups = await listGroups(page, wsId);
	log(`\n方案组列表（工作区：${wsName}，共 ${groups.length} 个）：`);
	log('  ' + [padTo('名称', 24), padTo('ID', 38), padTo('方案数', 7), '更新时间'].join(' | '));
	log('  ' + '-'.repeat(96));
	for (const g of groups) {
		log('  ' + [padTo(g.name, 24), padTo(g.id, 38), padTo(String(g.planCount), 7), g.updatedAt || ''].join(' | '));
	}
	log('');
	result({ ok: true, cmd: 'list', workspace: wsName, workspaceId: wsId, total: groups.length, groups });
}

async function cmdFind(page, wsId, wsName) {
	const kw = (args[0] || '').trim().toLowerCase();
	if (!kw) fail('用法：find <关键词>');
	const groups = await listGroups(page, wsId);
	const hit = groups.filter(g => (g.name || '').toLowerCase().includes(kw) || (g.description || '').toLowerCase().includes(kw));
	log(`\n查找"${kw}"（工作区：${wsName}）：命中 ${hit.length} 个`);
	for (const g of hit) log('  • ' + padTo(g.name, 24) + '  ' + g.id + '  (' + g.planCount + ' 个方案)');
	log('');
	result({ ok: true, cmd: 'find', keyword: kw, workspace: wsName, workspaceId: wsId, total: hit.length, groups: hit });
}

async function cmdCount(page, wsId, wsName) {
	const groups = await listGroups(page, wsId);
	log(`工作区「${wsName}」共有 ${groups.length} 个方案组`);
	result({ ok: true, cmd: 'count', workspace: wsName, workspaceId: wsId, total: groups.length });
}

async function cmdCreate(page, wsId, wsName) {
	const name = args[0];
	const desc = args[1] || '';
	if (!name) fail('用法：create <名称> [描述]');
	const existing = await listGroups(page, wsId);
	if (existing.some(g => g.name === name)) fail(`名称已存在："${name}"（方案组名称唯一）`);

	const t0 = await toastCount(page);
	await page.click('#create-group-btn');
	await page.waitForSelector('#group-edit-modal.show', { timeout: 10000 });
	await page.fill('#group-name-input', name);
	await page.fill('#group-description-input', desc);
	await page.click('#save-group-btn');
	const tl = await waitToast(page, t0);
	const danger = tl.find(t => t.type === 'danger');
	if (danger) fail('站点拒绝：' + danger.text, { toasts: tl });
	await page.waitForTimeout(600);

	const after = await listGroups(page, wsId);
	const created = after.find(g => g.name === name);
	if (!created) fail('创建后未在 planGroups 中找到该记录', { toasts: tl });
	log(`✅ 已新建方案组："${name}"  id=${created.id}（工作区：${wsName}）`);
	result({ ok: true, cmd: 'create', id: created.id, name, description: desc, workspace: wsName, toasts: tl });
}

async function cmdRename(page, wsId, wsName) {
	const key = args[0], newName = args[1], newDesc = args[2];
	if (!key || !newName) fail('用法：rename <ID|名称> <新名称> [新描述]');
	const groups = await listGroups(page, wsId);
	const g = resolveGroup(groups, key);
	if (groups.some(x => x.name === newName && x.id !== g.id)) fail(`新名称已被占用："${newName}"`);

	await activateGroup(page, wsId, g.id);
	const t0 = await toastCount(page);
	await page.click('#modify-group-btn');
	await page.waitForSelector('#group-edit-modal.show', { timeout: 10000 });
	await page.fill('#group-name-input', newName);
	if (newDesc !== undefined) await page.fill('#group-description-input', newDesc);
	await page.click('#save-group-btn');
	const tl = await waitToast(page, t0);
	const danger = tl.find(t => t.type === 'danger');
	if (danger) fail('站点拒绝：' + danger.text + '（若为"保存方案组失败"，多半是名称与现有组重复）', { toasts: tl });
	await page.waitForTimeout(600);

	const after = await listGroups(page, wsId);
	const rec = after.find(x => x.id === g.id);
	log(`✅ 已更新：${g.name} → ${rec ? rec.name : newName}（工作区：${wsName}）`);
	result({ ok: true, cmd: 'rename', id: g.id, oldName: g.name, newName: rec ? rec.name : newName, description: rec ? rec.description : newDesc, workspace: wsName, toasts: tl });
}

async function cmdDelete(page, wsId, wsName) {
	const key = args[0];
	if (!key) fail('用法：delete <ID|名称> --confirm');
	const groups = await listGroups(page, wsId);
	const g = resolveGroup(groups, key);
	if (!flags.confirm) {
		log('⚠️ 这是不可恢复的高危操作。将删除方案组：');
		log(`   名称：${g.name}  id=${g.id}（工作区：${wsName}）`);
		log('   注意：UI 删除会级联删除该组下的全部方案。确认无误后加 --confirm 重新执行。');
		return result({ ok: false, cmd: 'delete', needConfirm: true, target: g });
	}

	await activateGroup(page, wsId, g.id);
	const t0 = await toastCount(page);
	await page.click('#remove-group-btn');
	await page.waitForSelector('#remove-group-confirm-modal.show', { timeout: 10000 });
	await page.click('#remove-group-confirm-btn');
	const tl = await waitToast(page, t0);
	const danger = tl.find(t => t.type === 'danger');
	if (danger) fail('站点拒绝：' + danger.text, { toasts: tl });
	await page.waitForTimeout(800);

	const after = await listGroups(page, wsId);
	const gone = !after.some(x => x.id === g.id);
	if (gone) {
		log(`✅ 已删除方案组："${g.name}"（工作区：${wsName}；其下方案已级联删除）`);
		return result({ ok: true, cmd: 'delete', id: g.id, name: g.name, workspace: wsName, toasts: tl });
	}
	log('❌ 删除后记录仍在，请重试（最常见原因：还有别的标签页打开着该页面）');
	result({ ok: false, cmd: 'delete', id: g.id, name: g.name, message: '删除后记录仍在', toasts: tl });
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
			default: fail('未知命令：' + CMD + '（支持 list / find / count / create / rename / delete）');
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
