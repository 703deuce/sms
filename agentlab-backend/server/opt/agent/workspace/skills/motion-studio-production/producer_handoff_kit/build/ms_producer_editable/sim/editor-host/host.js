// Reference editor host: sandboxed scene iframe + postMessage bridge + capability fallback. Exposes window.hostApi for tests.
const API = '/api/motion-studio'; let known = new Set(), frame = null, sceneOrigin = null, pending = new Map(), seq = 0, session = null, token = null, ready = null, edits = { schema: 'transovo.edit-patch/1', scenes: {} }, cur = null;
const $ = id => document.getElementById(id);
async function api(method, p, body) { const r = await fetch(API + p, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j; }
window.addEventListener('message', ev => {
  if (!frame || ev.source !== frame.contentWindow || ev.origin !== 'null' && ev.origin !== sceneOrigin) return;   // sandboxed (opaque) iframe -> origin "null"; only our frame's window is accepted
  const m = ev.data; if (!m || m.ms !== 1) return;
  if (m.event === 'hello') return post({ id: ++seq, method: 'init', args: [session.host] });
  if (m.event === 'ready') { ready && ready(m.describe); return; }
  const p = pending.get(m.id); if (p) { pending.delete(m.id); m.ok ? p.res(m.result) : p.rej(new Error(m.error)); }
});
const post = (msg) => frame.contentWindow.postMessage({ ms: 1, ...msg }, '*');   // target "*" is required for an opaque-origin frame; the frame checks ev.origin === host
function call(method, ...args) { const id = ++seq; return new Promise((res, rej) => { pending.set(id, { res, rej }); post({ id, method, args }); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 60000); }); }
function webglOk() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
function render(d) { $('title').textContent = `${session.projectId} v${session.version} / ${d.sceneId}`; const wrap = $('wrap'); const sc = Math.min(($('stage').clientWidth - 20) / d.format.width, ($('stage').clientHeight - 20) / d.format.height);
  wrap.style.transform = `scale(${sc})`; wrap.style.width = d.format.width + 'px'; wrap.style.height = d.format.height + 'px';
  let bx = $('boxes'); if (!bx) { bx = document.createElement('div'); bx.id = 'boxes'; wrap.appendChild(bx); } bx.innerHTML = '';
  for (const e of d.elements) if (e.bounds && e.bounds.w) { const b = document.createElement('div'); b.className = 'bx'; Object.assign(b.style, { left: e.bounds.x + 'px', top: e.bounds.y + 'px', width: e.bounds.w + 'px', height: e.bounds.h + 'px', borderStyle: e.bounds.space === 'projected' ? 'dashed' : 'solid' }); b.innerHTML = `<span>${e.id}</span>`; bx.appendChild(b); }
  $('props').innerHTML = d.elements.map(e => `<b>${e.label || e.id}</b><br>` + Object.entries(e.properties).map(([k, p]) => `${k} <small>(${p.tier}, ${p.type})</small>: <code>${JSON.stringify(p.value).slice(0, 60)}</code>`).join('<br>')).join('<hr>');
  $('issues').innerHTML = (d.issues || []).map(i => `<div class="${i.severity}">${i.severity} ${i.code} ${i.element || ''} ${i.message || ''}</div>`).join(''); }
window.hostApi = {
  async load({ projectId, version, sceneId, jobToken, forceFallback }) {
    known = new Set(); edits = { schema: 'transovo.edit-patch/1', scenes: {} }; token = jobToken; session = { projectId, version, ...(await api('POST', `/projects/${projectId}/versions/${version}/scenes/${sceneId}/session`, {})) }; cur = sceneId; sceneOrigin = session.sceneOrigin; Object.keys(session.host.fonts || {}).forEach(k => known.add(k)); Object.keys(session.host.assetUrls || {}).forEach(k => known.add(k));
    const wrap = $('wrap'); wrap.innerHTML = ''; const live = session.livePreview === 'live' && webglOk() && !forceFallback;
    $('cap').textContent = `capability: ${session.livePreview}; mode: ${live ? 'live iframe' : 'fallback (' + (session.fallback ? 'poster' : 'none') + ')'}`;
    if (!live) { const img = document.createElement('img'); img.id = 'poster'; img.src = session.fallback && session.fallback.poster ? session.host.assetUrls[session.fallback.poster] || '' : ''; wrap.appendChild(img); return { mode: 'fallback', capability: session.livePreview }; }
    frame = document.createElement('iframe'); frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('allow', ''); frame.referrerPolicy = 'no-referrer';
    const sz = session.host.theme && 0; frame.width = 1920; frame.height = 1080;
    const d0 = await new Promise((res, rej) => { ready = res; setTimeout(() => rej(new Error('scene not ready')), 120000); frame.src = session.sceneUrl + '?host=' + encodeURIComponent(location.origin); wrap.appendChild(frame); });
    frame.width = d0.format.width; frame.height = d0.format.height; render(d0); return { mode: 'live', describe: d0 };
  },
  // fonts / assets the patch references that the frame does not know yet are fetched (records + signed URLs) and provided first
  async provide(ids) { const need = ids.filter(id => !known.has(id)); if (!need.length) return { provided: 0 }; const p = await api('POST', `/projects/${session.projectId}/preview-assets`, { ids: need });
    await call('provide', { fonts: p.fonts, assetUrls: p.assetUrls, assets: p.assets }); need.forEach(id => known.add(id)); return { provided: need.length, missing: p.missing }; },
  call, async setProps(patch, opts) { const t0 = performance.now(); const prov = await hostApi.provide(refIds(patch)); const r = await call('setProps', patch, opts); r.provided = prov.provided; r.roundTripMs = Math.round(performance.now() - t0);
    if (r.ok || (r.issues && !r.rejected)) { edits.scenes[cur] = mergeInto(edits.scenes[cur] || {}, patch.scenes ? patch.scenes[cur] || {} : patch); if (patch.theme) edits.theme = mergeInto(edits.theme || {}, patch.theme); }
    render(await call('describe')); return r; },
  async describe(t) { const d = await call('describe', t); render(d); return d; },
  edits: () => JSON.parse(JSON.stringify(edits)),
  // save = submit the accumulated edits as ONE deterministic_render job (Transovo creates the job + wakes a worker)
  async save() { return { schema: 'transovo.motion-job/1', mode: 'deterministic_render', projectId: session.projectId, baseVersion: session.version, edits: hostApi.edits(), output: { master: true, previews: true } }; },
};
function mergeInto(a, b) { const o = JSON.parse(JSON.stringify(a)); for (const [k, v] of Object.entries(b || {})) { if (v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object') o[k] = mergeInto(o[k], v); else if (v === null) delete o[k]; else o[k] = v; } return o; }
function refIds(o) { const ids = new Set(); JSON.stringify(o || {}, (k, v) => { if (k === 'asset' && typeof v === 'string') ids.add(v); if (k === 'faces' && Array.isArray(v)) v.forEach(x => ids.add(x)); return v; }); return [...ids]; }
