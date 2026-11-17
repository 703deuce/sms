#!/usr/bin/env node
// Live-preview proof: load the SAME bundle in headless Chromium as a browser editor would, call setProps, confirm it
// updates without a reload, refuses non-live props, and that motion (camera + tween schedule) is unchanged.
import { launch } from 'puppeteer-core'; import http from 'node:http'; import handler from 'serve-handler';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.dirname(new URL(import.meta.url).pathname); const OUT = path.join(ROOT, 'out/preview'); fs.mkdirSync(OUT, { recursive: true });
const rd = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const theme = rd('project/theme.json'), reg = rd('assets/registry.json').assets;
const A = rd('variants/A_midnight_playfair.json'), B = rd('variants/B_paper_anton.json');
const server = http.createServer((q, s) => handler(q, s, { public: ROOT, cleanUrls: false })); await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const assetUrls = Object.fromEntries(Object.entries(reg).map(([id, e]) => [id, `${base}/${e.file}`]));
const browser = await launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--font-render-hinting=none'], defaultViewport: { width: 1920, height: 1080 } });
const page = await browser.newPage(); let docRequests = 0;
page.on('request', r => { if (r.resourceType() === 'document') docRequests++; }); page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.evaluateOnNewDocument(h => { window.__MS_HOST = h; }, { theme, overrides: {}, assetUrls, mode: 'live' });
await page.goto(`${base}/bundle/S01/index.html`, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__ready && window.__msReady');
await page.evaluate(() => { window.__loadToken = Math.random().toString(36).slice(2); });
const token = await page.evaluate(() => window.__loadToken);
const T = 4.0; const log = { steps: [] };
const shot = async (name) => { await page.evaluate(async t => { await window.__scene.seek(t); await new Promise(r => requestAnimationFrame(r)); }, T); await page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: 1920, height: 1080 } }); };
const step = async (name, patch, file) => { const res = patch ? await page.evaluate(p => window.__scene.setProps(p), patch) : { ok: true, issues: [] };
  const st = await page.evaluate(() => ({ token: window.__loadToken, nav: performance.getEntriesByType('navigation').length, title: document.getElementById('km').textContent, font: document.getElementById('km').style.fontFamily, bg: getComputedStyle(document.documentElement).getPropertyValue('--deep') }));
  if (file) await shot(file); log.steps.push({ name, file, ok: res.ok, applyMs: res.applyMs, issues: res.issues.map(i => `${i.severity}:${i.code}${i.element ? ':' + i.element : ''}`), sameDocument: st.token === token, navigationEntries: st.nav, titleDom: st.title, titleFont: st.font, cssBackground: st.bg.trim() }); };
await step('0 loaded with project theme (original props)', null, '1_original.png');
await step('1 customer edits the title text only', { scenes: { S01: { elements: { title: { text: 'Def Squad\nKeith' } } } } }, '2_title_text.png');
await step('2 film-wide palette + fonts (variant A theme patch)', { theme: A.theme }, '3_theme_A.png');
await step('3 element edits from variant A (title, headword, logo on)', { scenes: A.scenes }, '4_variant_A_live.png');
await step('4 refused: render_editable prop through setProps (portrait.grade)', { scenes: { S01: { elements: { portrait: { grade: 'archive_bw_warm' } } } } }, null);
await step('5 null removes an override: title back to its token/default text', { scenes: { S01: { elements: { title: { text: null } } } } }, '4b_title_override_removed.png');
// ---- motion parity: same page, three prop sets, camera + tween schedule per frame ----
const trace = async () => page.evaluate(async () => { const out = { cam: [], sched: null }; for (let i = 0; i < 167; i++) { await window.__scene.seek(i / 30); out.cam.push(window.__msTrace()); }
  out.sched = S.tl.getChildren(false, true, false).map(tw => ({ t: +tw.startTime().toFixed(4), d: +tw.duration().toFixed(4), target: (tw.targets()[0].id || (tw.targets()[0].parentElement?.id === 'km' ? 'char' : '?')), n: tw.targets().length, stagger: tw.vars.stagger ?? null, ease: tw.vars.ease || null })); return out; });
const reset = { theme: theme, scenes: { S01: { tokens: {}, elements: { title: { text: 'Keith\nMurray' }, pronunciation: { text: '/ˈkēth ˈmər-ē/' }, headword: { text: 'Mur·ray, Keith' }, location: { text: 'Central Islip, Long Island' }, logo: { visible: false } } } } };
const r0 = await page.evaluate(p => window.__scene.setProps(p), reset); await shot('5_reset_to_original.png');
const t0 = await trace();
await page.evaluate(p => window.__scene.setProps(p), { theme: A.theme, scenes: A.scenes }); const tA = await trace();
const Bl = JSON.parse(JSON.stringify(B)); delete Bl.scenes.S01.render; delete Bl.scenes.S01.elements.portrait;   // live-only subset of B
await page.evaluate(p => window.__scene.setProps(p), { theme: B.theme, scenes: Bl.scenes }); await shot('6_variant_B_live.png'); const tB = await trace();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nonTitle = s => s.filter(x => x.target !== 'char');
const charSched = s => s.filter(x => x.target === 'char');
log.motion = {
  cameraTraceIdentical_A: same(t0.cam, tA.cam), cameraTraceIdentical_B: same(t0.cam, tB.cam),
  nonTitleTweensIdentical_A: same(nonTitle(t0.sched), nonTitle(tA.sched)).toString() + ' (logo tween added: ' + (nonTitle(tA.sched).length - nonTitle(t0.sched).length) + ')',
  originalSchedule: t0.sched.filter(x => x.target !== 'char'), 
  titleCharTween: { original: charSched(t0.sched), A: charSched(tA.sched), B: charSched(tB.sched) },
  nonTitleTweensIdentical_A_excludingLogo: same(nonTitle(t0.sched), nonTitle(tA.sched).filter(x => x.target !== 'logo')), nonTitleTweensIdentical_B_excludingLogo: same(nonTitle(t0.sched), nonTitle(tB.sched).filter(x => x.target !== 'logo')),
  logoTweenStartA: nonTitle(tA.sched).find(x => x.target === 'logo')?.t ?? null, locationTweenStart: nonTitle(t0.sched).find(x => x.target === 'loc')?.t,
  resetOk: r0.ok, documentRequests: docRequests, sameDocumentThroughout: (await page.evaluate(() => window.__loadToken)) === token };
fs.writeFileSync(path.join(OUT, 'preview_log.json'), JSON.stringify(log, null, 1));
console.log(JSON.stringify({ steps: log.steps.map(s => [s.name, s.ok, s.applyMs, s.sameDocument, s.issues.join(' ')]), motion: { ...log.motion, originalSchedule: undefined } }, null, 1));
await browser.close(); server.close();
