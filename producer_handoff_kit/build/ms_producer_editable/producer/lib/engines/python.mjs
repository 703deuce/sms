// Python engine adapter (OpenCV / skia-python / PIL frame renderers + FFmpeg). The bundle declares its command template;
// resolved props are passed as a JSON file; assets are passed as verified local cache paths keyed by asset id.
import fs from 'node:fs'; import path from 'node:path'; import { run, mkdirp, writeJson } from '../util.mjs'; import { CFG } from '../config.mjs';
export async function renderPython({ bundleDir, bundleDoc, resolved, out, workDir, assetPathsFor, store, cacheDir, mode = 'render', still }) {
  mkdirp(workDir); if (out) mkdirp(path.dirname(out)); const ap = await assetPathsFor(); const deps = {};
  for (const id of (bundleDoc.dependencies && bundleDoc.dependencies.assets) || []) { const r = await store.fetchAsset(id, cacheDir); deps[id] = r.path; }
  const propsFile = path.join(workDir, 'props.json'); writeJson(propsFile, { resolved, assets: Object.fromEntries(Object.entries(ap).map(([k, v]) => [k, v.path])), deps });
  const R = bundleDoc.render; const py = R.python === 'cv' ? CFG.cvPython : CFG.python;
  const args = R.args.map(a => a.replace('{bundle}', bundleDir).replace('{props}', propsFile).replace('{out}', out).replace('{work}', workDir).replace('{mode}', mode).replace('{still}', String(still ?? '')));
  const t0 = Date.now(); const r = await run(py, [path.join(bundleDir, R.script), ...args], { cwd: bundleDir });
  let rep = {}; const rf = path.join(workDir, 'report.json'); if (fs.existsSync(rf)) rep = JSON.parse(fs.readFileSync(rf, 'utf8'));
  if (rep.issues && rep.issues.some(i => i.severity === 'error')) return { ok: false, issues: rep.issues };
  return { ok: true, out, frames: rep.frames, renderMs: Date.now() - t0, issues: rep.issues || [], describe: rep.describe || null, log: r.out.slice(-500) };
}
