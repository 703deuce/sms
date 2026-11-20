// package.mjs: project version documents, render keys, dependency analysis helpers.
import { canon, sha256 } from './util.mjs';
import { resolve } from '../runtime/ms-resolve.js';
export const PROJECT_SCHEMA = 'transovo.motion-project/1';
// font selection labels are display text in the editor, not render input -> excluded from the render key
const strip = r => { const o = JSON.parse(JSON.stringify(r, (k, v) => (k === '__src' ? undefined : v && typeof v === 'object' && Array.isArray(v.faces) && 'label' in v ? (({ label, ...x }) => x)(v) : v))); delete o.issues; delete o.hash; return o; };
export function fontMap(doc, extra = []) { return Object.fromEntries([...(doc.fontRecords || []), ...extra].map(f => [f.fontId, f])); }
export function assetMetaMap(assetsById) { return assetsById; }
// resolved props of one editable scene in one version (same resolver the browser runs)
export function resolveScene(manifest, doc, ctx) { return resolve(manifest, doc.theme, doc.overrides || {}, { mode: 'render', fonts: fontMap(doc, ctx.extraFonts), assets: ctx.assets || {} }); }
// renderKey: identical key => identical clip (same bundle bytes, same resolved props, same render settings, same runtime pins)
export function sceneRenderKey({ bundleId, resolved, runtimeLock }) { return 'rk_' + sha256(canon({ bundleId, props: resolved ? strip(resolved) : null, runtimeLock })).slice(0, 40); }
export function masterRenderKey({ recipe, segmentClips, themeBound, runtimeLock }) { return 'mk_' + sha256(canon({ recipe, segmentClips, themeBound, runtimeLock })).slice(0, 40); }
export function collectRefs(doc) { const ids = new Set(); JSON.stringify(doc, (k, v) => { if (typeof v === 'string' && /^(ast|fnt|bnd)_[a-f0-9]{32}$/.test(v)) ids.add(v); if (typeof v === 'string' && /^fnt_[a-f0-9]{32}\.\d+$/.test(v)) ids.add(v.split('.')[0]); return v; }); return [...ids].sort(); }
// theme-bound values of the assembly recipe (e.g. fade colour = colors.primary)
export function themeBound(recipe, theme) { const out = {}; for (const [k, tok] of Object.entries(recipe.themeBindings || {})) { const v = tok.split('.').reduce((o, x) => o && o[x], theme); out[k] = v && typeof v === 'object' && 'value' in v ? v.value : v; } return out; }
