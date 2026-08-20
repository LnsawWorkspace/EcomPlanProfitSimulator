#!/usr/bin/env node
/**
 * ecomskill · 方案报告（PlanReport）读取脚本
 * 站点：https://ecomplanprofitsimulator.lnsaw.com  （纯前端 + IndexedDB，无后端 API）
 *
 * 报告页是**纯展示页**（无表单、无写入），数据由页面加载参数后现场计算渲染：
 *   - 核心指标卡（.stat-card × 13：付款单量/有效单量/付款金额/销售额/收入/广告费/总成本/利润/推广回报率/资本回报率/利润率/成本损失/利润损失）
 *   - 收入-利润瀑布图（svg #revenueAndCostWaterfallChart）
 *   - 成本结构饼图 / 退款损失饼图（canvas，容器 #costStructureChart / #refundCostStructureChart）
 *   - 明细表（table.data-table：商品GMV、商品成本、赠品成本、运营成本）
 *   - 8 个按钮（6 个敏感性分析图入口 + 添加到对比/查看对比，后两个标注"未完成"）
 * 报告页**不能**直连 IndexedDB 读取——所有数值都是计算产物，必须打开页面等它算完再抓。
 *
 * 设计原则
 *   1) 只读：本脚本不写任何数据（截图文件除外），打开报告页 → 等计算 → 抓文本/截图；
 *   2) 定位方案复用与 plan_params_ops.js 相同的 IndexedDB 直连逻辑（ensureWorkspace/resolveGroup/resolvePlan）；
 *   3) 计算耗时与参数相关，等待用"stat-card 数量"做就绪判据，超时提示除法 bug 可能。
 *
 * 运行（Windows / Git Bash）：
 *   NODE_PATH="C:/Users/wamzm/.workbuddy/binaries/node/workspace/node_modules" \
 *   "C:/Users/wamzm/.workbuddy/binaries/node/versions/22.22.2/node.exe" plan_report_ops.js <命令> <方案名|ID> [--group <组名|ID>]
 *
 * 命令：
 *   read <方案名|ID> [--group]   打开报告页，输出人类可读摘要（指标/瀑布图/饼图/明细表）+ 保存截图
 *   json <方案名|ID> [--group]   同上，但只输出机器可读 RESULT（指标 key-value + 表格数组）
 *   shot <方案名|ID> [--group]   只打开并截图，不输出摘要
 *
 * 进入报告页的 3 种方式（--via 指定，默认 url）：
 *   url       直接拼接 URL ?workspaceId=&groupId=&planId= 打开（最快最稳，脚本默认）
 *   params    打开参数页 → 点「保存并查看报告」（#goReport，会先保存参数再开报告）
 *   workbench 打开工作台 → 激活方案所在方案组 → 点方案卡片「查看报告」（.plan-view-btn）
 * 无论哪种方式，报告页都会**重新计算**：数据不落库，每次打开都要等它算完（通常 10s 内；
 * 若长时间无数字，先怀疑网络没加载到 JS 文件，再怀疑目标单量为 3/33/333 触发的除法 bug）。
 *
 * 通用开关：--workspace <名称|ID>（默认当前启用工作区）  --via <url|params|workbench>
 *           --out <截图目录>（默认 ECOMPLAN_REPORT_DIR 或 D:/wokrbudd/ecomplan-reports）
 *           --json（只输出机器可读结果）  --close（结束关闭浏览器）  --site=<url>
 * 浏览器：常驻模式（与其它脚本一致，见 plan_meta_ops.js 头注释）。
 * 环境变量：ECOMPLAN_BROWSER_DIR / ECOMPLAN_BROWSER_EXE / ECOMPLAN_SITE / ECOMPLAN_HEADLESS=1 / ECOMPLAN_CDP_PORT / ECOMPLAN_REPORT_DIR
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
	reportDir: process.env.ECOMPLAN_REPORT_DIR || 'D:/wokrbudd/ecomplan-reports',
	headless: process.env.ECOMPLAN_HEADLESS === '1',
	cdpPort: Number(process.env.ECOMPLAN_CDP_PORT || 9222),
	cdpHost: process.env.ECOMPLAN_CDP_HOST || '127.0.0.1',
};
const SYSTEM_DB = 'profitSimulation_systemDB';
const WS_STORE = 'workspaces';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────── 参数解析 ───────────────────────────
const rawArgs = process.argv.slice(2);
const flags = {};
const args = [];
const VALUE_FLAGS = new Set(['name', 'group', 'workspace', 'out', 'via', 'site']);
for (let i = 0; i < rawArgs.length; i++) {
	const a = rawArgs[i];
	if (!a.startsWith('--')) { args.push(a); continue; }
	const [k, v] = a.slice(2).split('=');
	if (v !== undefined) { flags[k] = v; continue; }
	if (VALUE_FLAGS.has(k) && rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--')) { flags[k] = rawArgs[++i]; continue; }
	flags[k] = true;
}
const CMD = (args.shift() || 'read').toLowerCase();
if (flags.site) CFG.site = flags.site;
const WORKBENCH = CFG.site + '/page/workbench/workbench.html';
const PARAMS = CFG.site + '/page/planParams/planParams.html';
const REPORT = CFG.site + '/page/planReport/planReport.html';
const QUIET = !!flags.json;
const VIA = flags.via && flags.via !== true ? String(flags.via).toLowerCase() : 'url';
if (!['url', 'params', 'workbench'].includes(VIA)) fail('--via 只能是 url | params | workbench');

const log = (...a) => { if (!QUIET) console.log(...a); };
const result = (obj) => console.log('RESULT: ' + JSON.stringify(obj));
const fail = (msg, extra = {}) => { result({ ok: false, cmd: CMD, error: msg, ...extra }); process.exit(2); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const nowText = () => {
	const d = new Date(), p = n => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const stamp = () => {
	const d = new Date(), p = n => String(n).padStart(2, '0');
	return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const safeName = s => String(s).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);

// ────────────── 注入页面工具（只读 IndexedDB 定位方案用） ──────────────
const INIT_SCRIPT = `
(() => {
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const listDbs = async () => (await indexedDB.databases()).map(d => d.name);
  const exists = async (name) => (await listDbs()).includes(name);
  const openExisting = async (name) => {
    if (!(await exists(name))) throw new Error('DB_NOT_FOUND:' + name);
    return await new Promise((res, rej) => {
      const r = indexedDB.open(name);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('DB_BLOCKED:' + name));
      r.onupgradeneeded = () => { };
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
  };
})();
`;

// ─────────────────────── 浏览器 / 页面封装（常驻模式） ───────────────────────
const CDP_URL = `http://${CFG.cdpHost}:${CFG.cdpPort}`;
function cdpAlive() {
	return new Promise(resolve => {
		const req = http.get(CDP_URL + '/json/version', res => { res.resume(); resolve(res.statusCode === 200); });
		req.setTimeout(1500, () => { req.destroy(); resolve(false); });
		req.on('error', () => resolve(false));
	});
}
async function ensureBrowser() {
	if (await cdpAlive()) return;
	if (!fs.existsSync(CFG.browserExe)) fail('浏览器可执行文件不存在：' + CFG.browserExe);
	const child = spawn(CFG.browserExe, [
		`--remote-debugging-port=${CFG.cdpPort}`,
		`--user-data-dir=${CFG.browserDir}`,
		'--no-first-run', '--no-default-browser-check', '--disable-backgrounding-occluded-windows',
		'about:blank',
	], { detached: true, stdio: 'ignore', windowsHide: false });
	child.unref();
	for (let i = 0; i < 40; i++) { await sleep(500); if (await cdpAlive()) return; }
	fail('浏览器启动超时：无法连接 ' + CDP_URL + '。若浏览器已被其他方式占用，请关闭后重试');
}
async function openPage(url) {
	await ensureBrowser();
	let browser;
	try { browser = await chromium.connectOverCDP(CDP_URL); }
	catch (e) { fail('连接浏览器失败：' + (e && e.message ? e.message : e) + '（' + CDP_URL + '）'); }
	const ctx = browser.contexts()[0] || await browser.newContext();
	await ctx.addInitScript(INIT_SCRIPT);
	let pages = ctx.pages();
	let page = pages.find(p => !p.isClosed());
	for (const p of pages) { if (p !== page && !p.isClosed()) await p.close().catch(() => { }); }
	if (!page || page.isClosed()) page = await ctx.newPage();
	page.on('dialog', d => d.dismiss().catch(() => { }));
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
	return { ctx, page, browser };
}
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
async function rowIndex(page, name) {
	return await page.evaluate(n => {
		const rows = Array.from(document.querySelectorAll('#workspace-table-body tr'));
		return rows.findIndex(r => r.children[0] && r.children[0].textContent.trim() === n);
	}, name);
}

// ────────────────────────── 方案定位（与 plan_params_ops.js 一致） ──────────────────────────
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
async function listGroups(page, wsId) {
	const raw = await page.evaluate(async (dbName) => {
		if (!(await window.__ws.exists(dbName))) return [];
		return await window.__ws.getAll(dbName, 'planGroups');
	}, wsId);
	return raw.map(g => ({ id: g.id, name: g.name, description: g.description || '', planCount: Number((g.planCount && g.planCount.value) ?? g.planCount ?? 0) }));
}
async function listPlans(page, wsId) {
	const raw = await page.evaluate(async (dbName) => {
		if (!(await window.__ws.exists(dbName))) return [];
		return await window.__ws.getAll(dbName, 'planMetas');
	}, wsId);
	return raw.map(p => ({ id: p.id, groupId: p.groupId, name: p.name, description: p.description || '' }));
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

// ────────────────────────── 报告页读取 ──────────────────────────
// 工作台辅助：激活方案所在方案组（点击 .group-item[data-group-id]）
async function activateGroup(page, groupId) {
	const ok = await page.evaluate(gid => {
		const items = Array.from(document.querySelectorAll('.group-item'));
		const t = items.find(i => (i.getAttribute('data-group-id') || '') === gid);
		if (!t) return false;
		if (t.classList.contains('active')) return true; // 已激活
		t.click(); return true;
	}, groupId);
	if (!ok) fail('工作台未找到方案组卡片（data-group-id=' + groupId + '）');
	await page.waitForTimeout(2000); // 等方案列表渲染
}
// 工作台辅助：找方案卡片索引（.plan-item 内 .plan-item-name 精确匹配）
async function findPlanCard(page, planName) {
	const idx = await page.evaluate(name => {
		const items = Array.from(document.querySelectorAll('.plan-item'));
		return items.findIndex(i => { const n = i.querySelector('.plan-item-name'); return n && n.textContent.trim() === name; });
	}, planName);
	if (idx < 0) fail('工作台方案列表中未找到方案卡片：' + planName);
	return idx;
}

// 打开报告页（3 种入口：url 直连 / params 点「保存并查看报告」 / workbench 点「查看报告」），并等计算完成
// 就绪判据：.stat-card 出现；超时多半是网络没加载到 JS 或除法 bug
async function openReportVia(page, ctx, wsId, groupId, planId, via, planName) {
	let rp; // 报告页 page 对象
	if (via === 'url') {
		rp = page;
		await page.goto(REPORT + `?workspaceId=${wsId}&groupId=${groupId}&planId=${planId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
	} else if (via === 'params') {
		await page.goto(PARAMS + `?workspaceId=${wsId}&groupId=${groupId}&planId=${planId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await page.waitForSelector('#goReport', { timeout: 20000 }).catch(() => fail('参数页未找到「保存并查看报告」按钮（#goReport），页面可能未正常加载') );
		// 该按钮会先保存参数，再 window.open 打开报告页（新标签）
		const [np] = await Promise.all([
			ctx.waitForEvent('page', { timeout: 20000 }),
			page.click('#goReport'),
		]);
		rp = np;
		await rp.waitForLoadState('domcontentloaded');
	} else { // workbench
		await page.goto(WORKBENCH, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await waitReady(page);
		await activateGroup(page, groupId);
		const idx = await findPlanCard(page, planName);
		// 方案卡片「查看报告」按钮（title=查看报告 / .plan-view-btn）window.open 新标签
		const [np] = await Promise.all([
			ctx.waitForEvent('page', { timeout: 15000 }),
			page.locator('.plan-item').nth(idx).locator('.plan-view-btn').click(),
		]);
		rp = np;
		await rp.waitForLoadState('domcontentloaded');
	}

	const ok = await rp.waitForFunction(() => document.querySelectorAll('.stat-card').length >= 5, { timeout: 60000 }).then(() => true).catch(() => false);
	if (!ok) {
		const hidden = await rp.evaluate(() => !!(document.getElementById('hidePage') && !document.getElementById('hidePage').classList.contains('d-none')));
		if (hidden) fail('报告页显示"方案不存在"（URL 三参数无效或方案被删除）');
		const body = await rp.evaluate(() => document.body.innerText.slice(0, 200));
		fail('报告计算超时（60s）。可能原因：网络没加载到相关 JS 文件，或目标单量为 3/33/333 等全 3 数触发除法 bug。当前页面文本：' + body.replace(/\s+/g, ' ').slice(0, 120));
	}
	await rp.waitForTimeout(2000); // 等图表/表格渲染
	return rp;
}

function extractReport(page) {
	return page.evaluate(() => {
		const out = { breadcrumb: '', metrics: [], tables: [], charts: {} };
		// 面包屑：找含 "->" 的短文本元素
		const crumbEl = Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0 && /->/.test(e.textContent) && e.textContent.trim().length < 80);
		out.breadcrumb = crumbEl ? crumbEl.textContent.trim() : '';
		// 指标卡：.stat-card（数值 + .stat-label）；按 class 分主/负（negative 红色边框表示负值）
		document.querySelectorAll('.stat-card').forEach(c => {
			const labelEl = c.querySelector('.stat-label');
			const label = labelEl ? labelEl.textContent.trim() : '';
			const value = labelEl ? c.textContent.replace(labelEl.textContent, '').trim() : c.textContent.trim();
			const negative = (c.className || '').includes('negative');
			out.metrics.push({ label, value, negative });
		});
		// 明细表：table.data-table。判断可见性：被 CSS 隐藏的视为弃用/历史残留（如"商品GMV表/收入明细"），标 abandoned
		document.querySelectorAll('table.data-table').forEach(t => {
			const head = Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim());
			const rows = Array.from(t.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
			const tbodyId = t.querySelector('tbody') ? t.querySelector('tbody').id : '';
			let title = '';
			let cur = t.parentElement;
			for (let i = 0; i < 3 && cur; i++) {
				const t2 = cur.querySelector(':scope > h5, :scope > h6, :scope > strong, :scope > .card-title');
				if (t2) { title = t2.textContent.trim(); break; }
				cur = cur.parentElement;
			}
			const style = getComputedStyle(t);
			const visible = style.display !== 'none' && style.visibility !== 'hidden' && t.offsetParent !== null;
			out.tables.push({ title, head, rows, tbodyId, abandoned: !visible });
		});
		// 图表存在性 + 实现方式（瀑布图=D3 svg, 两个 treemap=ECharts canvas）+ 所在 section 标题
		const chartInfo = (id, type, impl) => {
			const el = document.getElementById(id);
			if (!el) return { id, present: false };
			const card = el.closest('.card, .report-section, .section') || el.parentElement;
			const titleEl = card ? card.querySelector('.card-title, h5, h6, strong') : null;
			return { id, present: true, type, impl, title: titleEl ? titleEl.textContent.trim() : '' };
		};
		out.charts = {
			waterfall: chartInfo('revenueAndCostWaterfallChart', 'waterfall', 'd3-svg'),
			costStructure: chartInfo('costStructureChart', 'treemap', 'echarts-canvas'),
			refundCostStructure: chartInfo('refundCostStructureChart', 'treemap', 'echarts-canvas'),
		};
		return out;
	});
}

async function saveShot(page, planName) {
	const dir = flags.out && flags.out !== true ? String(flags.out) : CFG.reportDir;
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `report-${safeName(planName)}-${stamp()}.png`);
	await page.screenshot({ path: file, fullPage: true });
	return file;
}

// ──────────────────────────── 命令实现 ────────────────────────────
async function cmdRead(page, ctx, wsId, wsName) {
	const key = args[0];
	if (!key) fail('用法：read <方案名|ID> [--group <组名|ID>]');
	const groups = await listGroups(page, wsId);
	const plan = await resolvePlan(page, wsId, key, flags.group);
	const group = plan.groupId ? groups.find(g => g.id === plan.groupId) : null;
	const rp = await openReportVia(page, ctx, wsId, plan.groupId, plan.id, VIA, plan.name);
	const rep = await extractReport(rp);
	const shot = await saveShot(rp, plan.name);

	log(`方案报告：${wsName} -> ${group ? group.name : '?'} -> ${plan.name}（入口：${VIA}）`);
	log(`截图：${shot}`);
	log('');
	// 指标
	log('【核心指标】');
	for (const m of rep.metrics) log(`  ${m.label}：${m.value}`);
	log('');
	// 图表
	log('【图表】');
	for (const k of ['waterfall', 'costStructure', 'refundCostStructure']) {
		const c = rep.charts[k];
		if (c && c.present) log(`  ${c.title || k}：${c.type}（${c.impl}）`);
		else log(`  ${k}：无`);
	}
	log('');
	// 明细表
	for (const t of rep.tables) {
		const tag = t.abandoned ? ' [弃用残留]' : '';
		log(`【${t.title || '明细'}】${tag}`);
		if (t.abandoned && t.rows.length === 0) { log('  (空表 — 历史残留,页面不显示)'); continue; }
		log('  ' + t.head.join(' | '));
		for (const row of t.rows) log('  ' + row.join(' | '));
		log('');
	}
	result({ ok: true, cmd: 'read', via: VIA, workspace: wsName, plan: plan.name, group: group ? group.name : null, breadcrumb: rep.breadcrumb, metrics: rep.metrics, charts: rep.charts, tables: rep.tables, screenshot: shot });
}

async function cmdJson(page, ctx, wsId, wsName) {
	const key = args[0];
	if (!key) fail('用法：json <方案名|ID> [--group <组名|ID>]');
	const groups = await listGroups(page, wsId);
	const plan = await resolvePlan(page, wsId, key, flags.group);
	const group = plan.groupId ? groups.find(g => g.id === plan.groupId) : null;
	const rp = await openReportVia(page, ctx, wsId, plan.groupId, plan.id, VIA, plan.name);
	const rep = await extractReport(rp);
	const shot = await saveShot(rp, plan.name);
	result({ ok: true, cmd: 'json', via: VIA, workspace: wsName, plan: plan.name, group: group ? group.name : null, breadcrumb: rep.breadcrumb, metrics: rep.metrics, charts: rep.charts, tables: rep.tables, screenshot: shot });
}

async function cmdShot(page, ctx, wsId, wsName) {
	const key = args[0];
	if (!key) fail('用法：shot <方案名|ID> [--group <组名|ID>]');
	const plan = await resolvePlan(page, wsId, key, flags.group);
	const rp = await openReportVia(page, ctx, wsId, plan.groupId, plan.id, VIA, plan.name);
	const shot = await saveShot(rp, plan.name);
	log(`截图已保存：${shot}（入口：${VIA}）`);
	result({ ok: true, cmd: 'shot', via: VIA, plan: plan.name, screenshot: shot });
}

// ──────────────────────────── 入口 ────────────────────────────
(async () => {
	const handlers = { read: cmdRead, json: cmdJson, shot: cmdShot };
	if (!handlers[CMD]) {
		console.log('未知命令：' + CMD);
		console.log('可用：read | json | shot');
		process.exit(1);
	}
	const b = await openPage(WORKBENCH);
	try {
		const ws = await ensureWorkspace(b.page, flags.workspace && flags.workspace !== true ? String(flags.workspace) : null);
		await handlers[CMD](b.page, b.ctx, ws.id, ws.name);
	} finally {
		if (flags.close) {
			try { const s = await b.browser.newBrowserCDPSession(); await s.send('Browser.close'); } catch (_) { }
		}
		await b.browser.close().catch(() => { }); // 断开 CDP（不杀浏览器）
	}
})().catch(e => {
	console.error('FATAL: ' + (e && e.message ? e.message : e));
	result({ ok: false, cmd: CMD, error: String(e && e.message ? e.message : e) });
	process.exit(1);
});
