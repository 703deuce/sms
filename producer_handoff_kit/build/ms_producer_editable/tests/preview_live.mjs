// Stage 3: live preview in the reference editor host (sandboxed iframe, postMessage bridge, bounds, timings, fallback).
// The editor is loaded from http://localhost:8787 and scenes from http://127.0.0.1:8787 -> different origins (as in production).
import { launch } from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path';
import { CFG } from '../producer/lib/config.mjs'; import { CHROME_ARGS } from '../producer/lib/engines/browser.mjs';
import { simJob, OUT } from './lib.mjs';
export async function openEditor() {
  const browser = await launch({ executablePath: CFG.chrome, headless: true, args: CHROME_ARGS, defaultViewport: { width: 2400, height: 1200, deviceScaleFactor: 1 } });
  const page = await browser.newPage(); const logs = []; page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 200))); page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto('http://localhost:8787/_sim/editor/index.html', { waitUntil: 'load' }); await page.waitForFunction('!!window.hostApi');
  return { browser, page, logs };
}
export async function loadScene(page, projectId, version, sceneId, extra = {}) { const j = await simJob(projectId, 'read', {});
  const t0 = Date.now(); const r = await page.evaluate(a => hostApi.load(a), { projectId, version, sceneId, jobToken: j.jobToken, ...extra }); r.loadMs = Date.now() - t0; return r; }
// screenshot of the scene iframe at native resolution (host scale removed) at time t
export async function shotAt(page, t, out) { await page.evaluate(async t => { await hostApi.call('seek', t); document.getElementById('wrap').style.transform = 'none'; const b = document.getElementById('boxes'); if (b) b.style.display = 'none'; await new Promise(r => setTimeout(r, 150)); }, t);
  const el = await page.$('#wrap iframe'); await el.screenshot({ path: out }); await page.evaluate(() => { const b = document.getElementById('boxes'); if (b) b.style.display = ''; }); return out; }
if (import.meta.url === `file://${process.argv[1]}`) {
  const R = {}; const { browser, page, logs } = await openEditor();
  try {
    const L = await loadScene(page, 'km_doc_2min', 1, 'S01'); R.load = { mode: L.mode, loadMs: L.loadMs, elements: L.describe.elements.map(e => ({ id: e.id, bounds: e.bounds })) };
    // security posture of the frame
    R.security = await page.evaluate(() => { const f = document.querySelector('#wrap iframe'); return { sandbox: f.getAttribute('sandbox'), src: f.src.replace(/\/_scene\/[^/]+\/\d+\/[a-f0-9]+\//, '/_scene/<bundle>/<exp>/<sig>/'), hostOrigin: location.origin }; });
    const fr = page.frames().find(f => f.url().includes('/_scene/'));
    R.security.frameCanReadParent = await fr.evaluate(() => { try { return !!window.parent.document.body; } catch (e) { return false; } });
    R.security.frameOrigin = await fr.evaluate(() => self.origin);
    R.security.frameExternalFetchBlocked = await fr.evaluate(async () => { try { await fetch('https://example.com/'); return false; } catch { return true; } });
    R.security.disallowedMethod = await page.evaluate(() => hostApi.call('eval', '1+1').then(() => 'allowed', e => e.message));
    // live edits: text, colour, theme, font; timings
    const t = 172 / 30; await page.evaluate(t => hostApi.call('seek', t), t);
    R.edits = {};
    R.edits.text = await page.evaluate(() => hostApi.setProps({ scenes: { S01: { elements: { location: { text: 'Central Islip, New York' } } } } }));
    R.edits.color = await page.evaluate(() => hostApi.setProps({ scenes: { S01: { elements: { title: { color: '#FFD166' } } } } }));
    R.edits.colorReset = await page.evaluate(() => hostApi.setProps({ scenes: { S01: { elements: { title: { color: null } } } } }));
    const { KEITH_THEME } = await import('./milestone_keith.mjs');
    R.edits.theme = await page.evaluate(th => hostApi.setProps({ theme: th }), KEITH_THEME);
    R.edits.invalidRange = await page.evaluate(() => hostApi.setProps({ scenes: { S01: { elements: { title: { fontSize: 5000 } } } } }));
    R.edits.invalidProtected = await page.evaluate(() => hostApi.setProps({ scenes: { S01: { elements: { title: { rotation: 30 } } } } }));
    R.edits.overflowRejected = await page.evaluate(() => hostApi.setProps({ scenes: { S01: { elements: { year: { text: 'MCMXCIII — the year it all began' } } } } }));
    R.edits.layoutRollback = await page.evaluate(() => hostApi.setProps({ scenes: { S01: { elements: { location: { text: 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW' } } } } }));
    const after = await page.evaluate(() => hostApi.call('getProps')); R.stateAfterInvalid = { location: after.resolved.elements.location.text, year: after.resolved.elements.year.text, titleSize: after.resolved.elements.title.fontSize };
    R.edits.forcedPreview = await page.evaluate(() => hostApi.setProps({ scenes: { S01: { elements: { year: { text: 'MCMXCIII — the year it all began' } } } } }, { force: true }));
    await page.evaluate(() => hostApi.setProps({ scenes: { S01: { elements: { year: { text: null } } } } }));
    R.timings = Object.fromEntries(Object.entries(R.edits).map(([k, v]) => [k, { ok: v.ok, rejected: !!v.rejected, applyMs: v.applyMs, roundTripMs: v.roundTripMs, provided: v.provided, stage: v.stage, codes: (v.issues || []).filter(i => i.severity !== 'info').map(i => i.code) }]));
    const d = await page.evaluate(() => hostApi.describe()); R.boundsAfterEdit = d.elements.map(e => ({ id: e.id, bounds: e.bounds }));
    R.savedJob = await page.evaluate(() => hostApi.save());
    fs.mkdirSync(path.join(OUT, 'preview'), { recursive: true });
    await page.screenshot({ path: path.join(OUT, 'preview', 'editor_host_S01.png') });
    R.previewShot = await shotAt(page, t, path.join(OUT, 'preview', 'live_S01_edited_f172.png'));
    // fallback paths
    R.fallbackForced = await loadScene(page, 'km_doc_2min', 1, 'S01', { forceFallback: true }); delete R.fallbackForced.describe;
    R.fallbackPosterSrc = await page.evaluate(() => (document.getElementById('poster') || {}).src ? 'set' : 'missing');
    R.phil_sh04 = await loadScene(page, 'phil_30s', 1, 'sh04'); delete R.phil_sh04.describe;
    const P = await loadScene(page, 'phil_30s', 1, 'S04'); R.phil_S04 = { mode: P.mode, loadMs: P.loadMs, elements: P.describe.elements.map(e => ({ id: e.id, bounds: e.bounds })) };
    R.phil_S04.edit = await page.evaluate(() => hostApi.setProps({ scenes: { S04: { elements: { labelA: { title: 'ROOF' } } } } }).then(r => ({ ok: r.ok, applyMs: r.applyMs, roundTripMs: r.roundTripMs, codes: (r.issues || []).map(i => i.code) })));
    await page.screenshot({ path: path.join(OUT, 'preview', 'editor_host_phil_S04.png') });
  } finally { R.logs = logs.filter(l => !/^(log|debug|info)/.test(l)).slice(0, 30); await browser.close(); }
  fs.writeFileSync(path.join(OUT, 'preview_live.json'), JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1).slice(0, 9000));
}
