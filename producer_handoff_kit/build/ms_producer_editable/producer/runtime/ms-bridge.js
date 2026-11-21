// ms-bridge.js: controlled postMessage interface between the Transovo editor (parent) and a sandboxed scene iframe.
// The scene never touches the parent; the parent never runs scene code. Only whitelisted methods; strict origin check.
const METHODS = ['setProps', 'getProps', 'validate', 'describe', 'seek', 'ping', 'provide'];
const q = new URLSearchParams(location.search); const HOST = q.get('host');     // editor origin, given in the iframe src
const inFrame = window.parent && window.parent !== window;
let initResolve; const initP = new Promise(r => initResolve = r);
function ok(ev) { return inFrame && HOST && ev.source === window.parent && ev.origin === HOST && ev.data && ev.data.ms === 1; }
const reply = (msg) => window.parent.postMessage({ ms: 1, ...msg }, HOST);
if (inFrame) window.addEventListener('message', ev => { if (ok(ev) && ev.data.method === 'init') { initResolve(ev.data.args[0]); reply({ id: ev.data.id, ok: true, result: { accepted: true } }); } });
export const startBridge = {
  waitInit() { if (!inFrame || !HOST) throw new Error('no host payload: load with window.__MS_HOST or inside the editor iframe with ?host=<origin>'); reply({ event: 'hello' }); return initP; },
  serve(rt) {
    if (!inFrame || !HOST) return;
    window.addEventListener('message', async ev => {
      if (!ok(ev) || ev.data.method === 'init') return; const { id, method, args = [] } = ev.data;
      if (!METHODS.includes(method)) return reply({ id, ok: false, error: 'method_not_allowed' });
      try { const sc = window.__scene; const result = method === 'ping' ? { pong: true } : method === 'seek' ? (await sc.seek(args[0]), { t: args[0] }) : await sc[method](...args);
        reply({ id, ok: true, result: JSON.parse(JSON.stringify(result ?? null)) }); }
      catch (e) { reply({ id, ok: false, error: String(e && e.message || e).slice(0, 300) }); }
    });
    rt.describe().then(d => reply({ event: 'ready', describe: d }));
  }
};
