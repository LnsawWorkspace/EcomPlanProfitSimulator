#!/usr/bin/env node
/**
 * ecomskill · 方案敏感性分析图（Graphs）读取脚本
 * 站点：https://ecomplanprofitsimulator.lnsaw.com  （纯前端 + IndexedDB，无后端 API）
 *
 * 分析图是**纯展示页**：固定其他参数、把指定变量（ROI/售价/单量）从一段范围扫到另一段、每个点重算报告画曲线。
 * 全部基于 ECharts 6 + ecStat 渲染，**不能**直连 IndexedDB 读——必须打开页面、等它算完、通过 `window.echarts.getInstanceByDom` 拿实例 option。
 *
 * 已支持 2 个图（其余 4 个按同模式扩展）：
 *   roi    planReportRoiGraph.html   扫 ROI（固定售价/单量；--sale-price/--order-quantity 可临时改，不落库）
 *   sale   planReportSaleGraph.html  扫 售价（固定 ROI/单量；--roi/--order-quantity 可临时改，不落库）
 * 页面输入框 = 临时沙盒：改值只影响本次图，不改方案参数。
 * ROI/售价 的「开始/步进/结束」都是被扫变量的值；ROI 步进可细到 0.0001；售价步进按 1/2/5×10ⁿ 归一（0.1/0.2/0.5/1/2/5…），
 * 计算次数 = (结束−开始)/步长+1，建议 ≤1 万（页面自动控制在 1000 点左右），脚本会估算并警示。
 * 入口校验广告依赖：ROI 图必须有广告；售价图无广告时 ROI 输入框被站点禁用（图可开但 ROI 固定为方案值）。
 *
 * 设计原则
 *   1) 只读：本脚本不写任何数据（截图文件除外）；
 *   2) 定位方案复用与 plan_params_ops.js 相同的 IndexedDB 直连逻辑（ensureWorkspace/resolveGroup/resolvePlan）；
 *   3) 读 ECharts option 拿数据（x 轴 + series + markArea），不靠截图识别；自动找"利润≥0 的保本点"。
 *
 * 运行（Windows / Git Bash）：
 *   NODE_PATH="<托管 node workspace>/node_modules"  # 托管 node 路径见运行环境 \
 *   "<托管 node 可执行文件>" plan_report_graph_ops.js <命令> <方案名|ID> [--group <组名|ID>]
 *
 * 命令：
 *   roi  <方案名|ID> [--group] [--sale-price 售价] [--order-quantity 单量] [--start 1] [--end 10] [--step 0.1]
 *   sale <方案名|ID> [--group] [--roi 4] [--order-quantity 单量] [--start 0] [--end 300] [--step 0.5]
 *       打开对应分析图，输出摘要（序列首/中/尾 + 保本点 + markArea）+ 保存截图
 *       通用：--zoom-start 0 --zoom-end 40  主动缩放 ECharts dataZoom 滑条（百分比 0-100），
 *             先缩放再截图 —— 双变量图点位密集时用来放大看局部（只影响显示/截图，不改数据）
 *   shot roi|sale <方案名|ID> [...]   只截图不输出摘要
 *
 * 通用开关：--workspace <名称|ID>（默认当前启用工作区）  --out <截图目录>（默认 ECOMPLAN_REPORT_DIR 或相对目录）
 *           --json（只输出机器可读结果）  --close（结束关闭浏览器）  --site=<url>
 * 浏览器：常驻模式（与其它脚本一致）。
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
	browserDir: process.env.ECOMPLAN_BROWSER_DIR || '',
	browserExe: process.env.ECOMPLAN_BROWSER_EXE || '',
	site: process.env.ECOMPLAN_SITE || 'https://ecomplanprofitsimulator.lnsaw.com',
	reportDir: process.env.ECOMPLAN_REPORT_DIR || 'ecomplan-reports',
	headless: process.env.ECOMPLAN_HEADLESS === '1',
	cdpPort: Number(process.env.ECOMPLAN_CDP_PORT || 9222),
	cdpHost: process.env.ECOMPLAN_CDP_HOST || '127.0.0.1',
};
const SYSTEM_DB = 'profitSimulation_systemDB';
const WS_STORE = 'workspaces';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 已支持的图：path / 输入框前缀 / 图表容器 / 扫描变量说明 / 固定变量 flag 映射
const GRAPHS = {
	roi: {
		path: '/page/planReport/planReportRoiGraph.html',
		prefix: 'roi-graph', container: 'roi-graph-container',
		scan: 'ROI', fixed: '售价/单量',
		flags: { salePrice: 'sale-price', orderQuantity: 'order-quantity' },
	},
	sale: {
		path: '/page/planReport/planReportSaleGraph.html',
		prefix: 'sale-graph', container: 'sale-graph-container',
		scan: '售价', fixed: 'ROI/单量',
		flags: { roi: 'roi', orderQuantity: 'order-quantity' },
	},
};

// ─────────────────────────── 参数解析 ───────────────────────────
const rawArgs = process.argv.slice(2);
const flags = {};
const args = [];
const VALUE_FLAGS = new Set(['name', 'group', 'workspace', 'out', 'site', 'start', 'end', 'step', 'sale-price', 'order-quantity', 'roi', 'zoom-start', 'zoom-end']);
for (let i = 0; i < rawArgs.length; i++) {
	const a = rawArgs[i];
	if (!a.startsWith('--')) { args.push(a); continue; }
	const [k, v] = a.slice(2).split('=');
	if (v !== undefined) { flags[k] = v; continue; }
	if (VALUE_FLAGS.has(k) && rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--')) { flags[k] = rawArgs[++i]; continue; }
	flags[k] = true;
}
let CMD = (args.shift() || 'roi').toLowerCase();
// shot 命令：第一个参数是图类型（shot roi <方案> / shot sale <方案>）
let SHOT_TYPE = null;
if (CMD === 'shot') {
	SHOT_TYPE = (args.shift() || '').toLowerCase();
	if (!GRAPHS[SHOT_TYPE]) { console.log('shot 用法：shot roi|sale <方案名|ID> [参数]'); process.exit(1); }
	CMD = SHOT_TYPE;
}
if (flags.site) CFG.site = flags.site;
const WORKBENCH = CFG.site + '/page/workbench/workbench.html';
const QUIET = !!flags.json;

const log = (...a) => { if (!QUIET) console.log(...a); };
const result = (obj) => console.log('RESULT: ' + JSON.stringify(obj));
const fail = (msg, extra = {}) => { result({ ok: false, cmd: CMD, error: msg, ...extra }); process.exit(2); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
	if (!CFG.browserExe) fail('未配置浏览器可执行文件：请设置环境变量 ECOMPLAN_BROWSER_EXE（本技能为通用发布版，不内置本机路径）');
	if (!fs.existsSync(CFG.browserExe)) fail('浏览器可执行文件不存在：' + CFG.browserExe);
	const child = spawn(CFG.browserExe, [
		`--remote-debugging-port=${CFG.cdpPort}`,
		`--user-data-dir=${CFG.browserDir}`,
		'--no-first-run', '--no-default-browser-check', '--disable-backgrounding-occluded-windows',
		'about:blank',
	], { detached: true, stdio: 'ignore', windowsHide: false });
	child.unref();
	for (let i = 0; i < 40; i++) { await sleep(500); if (await cdpAlive()) return; }
	fail('浏览器启动超时：无法连接 ' + CDP_URL);
}
async function openPage(url) {
	await ensureBrowser();
	let browser;
	try { browser = await chromium.connectOverCDP(CDP_URL); }
	catch (e) { fail('连接浏览器失败：' + (e && e.message ? e.message : e)); }
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
		if (!target) fail('未找到工作区：' + nameOrId, { candidates: ws.map(r => r.name) });
	} else {
		target = ws.find(r => r.enabled === true || r.enabled === 'true');
		if (!target) fail('没有启用的当前工作区');
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
	if (UUID_RE.test(key)) { const g = groups.find(x => x.id === key); if (!g) fail('未找到方案组：' + key); return g; }
	const exact = groups.filter(x => x.name === key);
	if (exact.length === 1) return exact[0];
	if (exact.length > 1) fail(`名称"${key}"匹配到多个方案组`, { ids: exact.map(x => x.id) });
	const like = groups.filter(x => x.name.includes(key));
	if (like.length === 1) return like[0];
	if (like.length > 1) fail(`名称"${key}"匹配到多个方案组`, { ids: like.map(x => x.id) });
	fail('未找到方案组：' + key, { candidates: groups.map(x => x.name) });
}
async function resolvePlan(page, wsId, key, groupKey) {
	let plans = await listPlans(page, wsId);
	if (groupKey) {
		const groups = await listGroups(page, wsId);
		const g = resolveGroup(groups, groupKey);
		plans = plans.filter(p => p.groupId === g.id);
	}
	if (UUID_RE.test(key)) { const p = plans.find(x => x.id === key); if (!p) fail('未找到方案：' + key); return p; }
	const exact = plans.filter(x => x.name === key);
	if (exact.length === 1) return exact[0];
	if (exact.length > 1) fail(`名称"${key}"匹配到多个方案`, { ids: exact.map(x => x.id) });
	const like = plans.filter(x => x.name.includes(key));
	if (like.length === 1) return like[0];
	if (like.length > 1) fail(`名称"${key}"匹配到多个方案`, { ids: like.map(x => x.id) });
	fail('未找到方案：' + key, { candidates: plans.map(x => x.name) });
}

// 直连 IndexedDB 读方案参数，校验 advertising.name（ROI 图依赖；售价图无广告时 ROI 被锁定）
async function readPlanParams(page, wsId, planId) {
	const raw = await page.evaluate(async ({ dbName, id }) => {
		if (!(await window.__ws.exists(dbName))) return null;
		const all = await window.__ws.getAll(dbName, 'planParams');
		return all.find(r => r.id === id) || null;
	}, { dbName: wsId, id: planId });
	return raw;
}

// ────────────────────────── 分析图核心（通用） ──────────────────────────
async function openGraph(page, type, wsId, groupId, planId) {
	const g = GRAPHS[type];
	await page.goto(`${CFG.site}${g.path}?workspaceId=${wsId}&groupId=${groupId}&planId=${planId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
	const hidden = await page.waitForFunction(() => {
		const h = document.getElementById('hidePage');
		return h && !h.classList.contains('d-none');
	}, { timeout: 8000 }).then(() => true).catch(() => false);
	if (hidden) fail('分析图页面显示"方案不存在"（URL 三参数无效）');
	const ok = await page.waitForFunction(cid => !!document.querySelector('#' + cid + ' canvas'), g.container, { timeout: 90000 }).then(() => true).catch(() => false);
	if (!ok) fail('分析图计算/渲染超时（90s）');
	await page.waitForTimeout(2000);
}

// 填输入框（前缀按图区分）+ 点"重新生成"；只影响本次图，不落库
async function applyGraphSettings(page, type, s) {
	const g = GRAPHS[type];
	const map = { start: 'start', end: 'end', step: 'step', ...g.flags };
	const any = Object.keys(s).some(k => s[k] !== undefined);
	if (!any) return;
	for (const [key, flagName] of Object.entries(map)) {
		const v = s[flagName];
		if (v !== undefined && v !== true) await page.fill(`#${g.prefix}-${key}`, String(v));
	}
	await page.click(`#${g.prefix}-generate-btn`);
	const ok = await page.waitForFunction(cid => !!document.querySelector('#' + cid + ' canvas'), g.container, { timeout: 90000 }).then(() => true).catch(() => false);
	if (!ok) fail('自定义参数后重算超时');
	await page.waitForTimeout(2000);
}

async function readGraphInputs(page, type) {
	const g = GRAPHS[type];
	return await page.evaluate((prefix) => {
		const out = {};
		for (const id of ['roi', 'salePrice', 'orderQuantity', 'start', 'step', 'end']) {
			const el = document.getElementById(prefix + '-' + id);
			out[id] = el ? el.value : null;
		}
		return out;
	}, g.prefix);
}

// 提取 ECharts option：序列（首/中/尾 + 保本点）、x 轴、markArea 色带
// canvas 出现 ≠ 数据就绪（计算是同步的，会阻塞主线程），轮询等 xAxis/series 有数据
async function readGraphOption(page, type) {
	const g = GRAPHS[type];
	return await page.evaluate(async (containerId) => {
		const inst = window.echarts ? window.echarts.getInstanceByDom(document.getElementById(containerId)) : null;
		if (!inst) return null;
		let o = null;
		for (let i = 0; i < 120; i++) {
			o = inst.getOption();
			const x = o.xAxis && o.xAxis[0] && o.xAxis[0].data;
			if (x && x.length > 0 && o.series && o.series.length > 0) break;
			await new Promise(r => setTimeout(r, 500));
		}
		const xArr = (o.xAxis && o.xAxis[0] && o.xAxis[0].data) || [];
		const series = (o.series || []).map(s => {
			const arr = s.data || [];
			let breakEven = null;
			if (s.name === '利润' && arr.length > 0) {
				for (let i = 0; i < arr.length; i++) {
					if ((arr[i] || 0) >= 0) { breakEven = { index: i, x: xArr[i], profit: arr[i] }; break; }
				}
			}
			return {
				name: s.name, type: s.type,
				count: arr.length,
				first: arr[0], middle: arr[Math.floor(arr.length / 2)], last: arr[arr.length - 1],
				breakEven,
			};
		});
		const markAreas = [];
		(o.series || []).forEach(s => {
			const ma = s.markArea && s.markArea.data;
			if (Array.isArray(ma)) {
				ma.forEach(seg => {
					if (Array.isArray(seg) && seg.length >= 2 && seg[0].xAxis !== undefined && seg[1].xAxis !== undefined) {
						markAreas.push({ series: s.name, name: seg[0].name || '', start: seg[0].xAxis, end: seg[1].xAxis, color: seg[0].itemStyle && seg[0].itemStyle.color });
					}
				});
			}
		});
		// dataZoom：图上可拖动的区间缩放滑条（拖动看局部区间）
		const dz = (o.dataZoom && o.dataZoom[0]) || null;
		const dataZoom = dz ? { type: dz.type || '', start: dz.start, end: dz.end, startValue: dz.startValue !== undefined ? dz.startValue : null, endValue: dz.endValue !== undefined ? dz.endValue : null } : null;
		return {
			xAxis: { count: xArr.length, first: xArr[0], last: xArr[xArr.length - 1] },
			series, markAreas, dataZoom,
		};
	}, g.container);
}

// 主动缩放 dataZoom（百分比 0-100）——只影响显示/截图，不改底层数据；双变量图点位密集时用来放大看局部
async function applyDataZoom(page, type) {
	const g = GRAPHS[type];
	const zs = flags['zoom-start'], ze = flags['zoom-end'];
	if ((zs === undefined || zs === true) && (ze === undefined || ze === true)) return;
	const start = zs !== undefined && zs !== true ? Number(zs) : 0;
	const end = ze !== undefined && ze !== true ? Number(ze) : 100;
	if (!(start >= 0 && end <= 100 && start < end)) fail('--zoom-start/--zoom-end 需为 0~100 百分比且 start < end');
	await page.evaluate(({ container, start, end }) => {
		const inst = window.echarts.getInstanceByDom(document.getElementById(container));
		if (inst) inst.dispatchAction({ type: 'dataZoom', start, end });
	}, { container: g.container, start, end });
	await page.waitForTimeout(800);
}

async function saveShot(page, planName, kind) {
	const dir = flags.out && flags.out !== true ? String(flags.out) : CFG.reportDir;
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `graph-${kind}-${safeName(planName)}-${stamp()}.png`);
	// 图页 DOM 重，fullPage + 动画等待会卡超时；用 animations:'disabled' + 90s；主图在 viewport 内
	await page.screenshot({ path: file, animations: 'disabled', timeout: 90000 });
	return file;
}

// ──────────────────────────── 命令实现 ────────────────────────────
async function cmdGraph(page, type) {
	const g = GRAPHS[type];
	const key = args[0];
	if (!key) fail(`用法：${type} <方案名|ID> [--group] [${Object.keys(g.flags).join(' ')}] [--start] [--end] [--step]`);
	const groups = await listGroups(page, wsIdRef);
	const plan = await resolvePlan(page, wsIdRef, key, flags.group);
	const group = plan.groupId ? groups.find(x => x.id === plan.groupId) : null;

	// 广告校验：roi 图必须有广告；sale 图无广告时 ROI 输入框被站点禁用（图可开，ROI 用方案值）
	const params = await readPlanParams(page, wsIdRef, plan.id);
	const adName = params && params.modelPlanParamsAdvertising && params.modelPlanParamsAdvertising.name;
	if (type === 'roi' && !adName) {
		fail(`方案"${plan.name}"未设置广告投放，ROI 图无意义（站点会 toast「无法查看ROI图表」）。请先用 plan_params_ops.js set 设广告。`);
	}

	await openGraph(page, type, wsIdRef, plan.groupId, plan.id);
	await applyGraphSettings(page, type, flags);
	const inputs = await readGraphInputs(page, type);
	const opt = await readGraphOption(page, type);
	// 主动缩放 dataZoom（可选）：先缩放再截图
	await applyDataZoom(page, type);
	const shot = await saveShot(page, plan.name, type);

	if (SHOT_TYPE === null) {
		const points = Math.round((parseFloat(inputs.end) - parseFloat(inputs.start)) / parseFloat(inputs.step) + 1);
		const heavy = points > 10000;
		log(`${type === 'roi' ? 'ROI 图' : '售价图'}：${wsNameRef} -> ${group ? group.name : '?'} -> ${plan.name}${adName ? `（广告：${adName}）` : '（未设广告，ROI 锁定）'}`);
		log(`截图：${shot}`);
		log('');
		log('【输入】');
		log(`  ${type === 'roi' ? '售价=' + inputs.salePrice : 'ROI=' + inputs.roi}  单量=${inputs.orderQuantity}  ${g.scan}范围=${inputs.start}~${inputs.end} 步长=${inputs.step}`);
		log(`  计算次数≈${points} 点（=(结束-开始)/步长+1）${heavy ? '  ⚠ 超过 1 万：精度越高算力越高，建议缩小区间或加大步长' : ''}`);
		log('');
		log('【X 轴】');
		log(`  ${g.scan}: ${opt.xAxis.count} 个点  ${opt.xAxis.first} → ${opt.xAxis.last}`);
		log('');
		log('【序列】（首/中/尾）');
		for (const s of opt.series) {
			log(`  ${s.name}（${s.count} 点）: ${fmtNum(s.first)} / ${fmtNum(s.middle)} / ${fmtNum(s.last)}${s.breakEven ? `  → 保本${g.scan}=${s.breakEven.x}（利润 ${fmtNum(s.breakEven.profit)}）` : ''}`);
		}
		log('');
		log('【色带 markArea】');
		if (opt.markAreas.length === 0) log('  (本图无 markArea 色带)');
		for (const a of opt.markAreas) log(`  ${a.name}  ${g.scan} ${fmtNum(a.start)} ~ ${fmtNum(a.end)}  ${a.color || ''}`);
		log('');
		log('【dataZoom 缩放条】');
		if (opt.dataZoom) log(`  ${opt.dataZoom.type}：显示 ${fmtNum(opt.dataZoom.start)}% ~ ${fmtNum(opt.dataZoom.end)}%（图上有滑条可拖动看局部区间）`);
		else log('  (无 dataZoom)');
	}

	result({
		ok: true, cmd: type, workspace: wsNameRef, plan: plan.name, group: group ? group.name : null,
		advertising: adName || null, inputs,
		points: Math.round((parseFloat(inputs.end) - parseFloat(inputs.start)) / parseFloat(inputs.step) + 1),
		xAxis: opt.xAxis, series: opt.series, markAreas: opt.markAreas, dataZoom: opt.dataZoom, screenshot: shot,
	});
}

function fmtNum(n) {
	if (n === null || n === undefined) return '—';
	if (typeof n === 'number') return (Math.abs(n) >= 1000 ? n.toFixed(2) : n.toFixed(4));
	return String(n);
}

// 全局引用（cmdGraph 内使用）
let wsIdRef = null, wsNameRef = null;

// ──────────────────────────── 入口 ────────────────────────────
(async () => {
	const handlers = { roi: () => true, sale: () => true };
	if (!handlers[CMD]) {
		console.log('未知命令：' + CMD);
		console.log('可用：roi | sale | shot roi | shot sale');
		process.exit(1);
	}
	const b = await openPage(WORKBENCH);
	try {
		const ws = await ensureWorkspace(b.page, flags.workspace && flags.workspace !== true ? String(flags.workspace) : null);
		wsIdRef = ws.id; wsNameRef = ws.name;
		await cmdGraph(b.page, CMD);
	} finally {
		if (flags.close) {
			try { const s = await b.browser.newBrowserCDPSession(); await s.send('Browser.close'); } catch (_) { }
		}
		await b.browser.close().catch(() => { });
	}
})().catch(e => {
	console.error('FATAL: ' + (e && e.message ? e.message : e));
	result({ ok: false, cmd: CMD, error: String(e && e.message ? e.message : e) });
	process.exit(1);
});
