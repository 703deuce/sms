// deps.mjs: dependency analysis between a base version and a candidate version (which scenes / master must re-render, and why).
const flat = (o, p = '', out = {}) => { if (o && typeof o === 'object' && !Array.isArray(o)) { for (const [k, v] of Object.entries(o)) if (k !== '__src' && k !== 'hash' && k !== 'issues') flat(v, p ? p + '.' + k : k, out); } else out[p] = JSON.stringify(o); return out; };
export function diffResolved(a, b) { const A = flat(a || {}), B = flat(b || {}); return [...new Set([...Object.keys(A), ...Object.keys(B)])].filter(k => A[k] !== B[k]).sort(); }
/** scenes: [{sceneId, editable, themeAware, oldKey, newKey, oldResolved, newResolved}], recipe, themeChanged */
export function analyze({ scenes, recipe, oldBound, newBound, themeChanged, narration }) {
  const out = { scenes: [], master: null, transitions: [], warnings: [] };
  for (const s of scenes) {
    const changed = s.oldKey !== s.newKey; const paths = s.editable ? diffResolved(s.oldResolved, s.newResolved) : [];
    const r = { sceneId: s.sceneId, rerender: changed, reason: changed ? (paths.length ? 'resolved props changed: ' + paths.slice(0, 8).join(', ') + (paths.length > 8 ? ` (+${paths.length - 8})` : '') : 'bundle or runtime changed') : 'unchanged: identical render key, clip reused', changedPaths: paths };
    if (!s.editable && themeChanged) { r.note = 'not theme-aware: colours/fonts are baked into this scene; it keeps the original look'; out.warnings.push({ severity: 'warning', code: 'NOT_THEME_AWARE', scene: s.sceneId, message: `${s.sceneId} has no editable manifest; the project theme change does not apply to it` }); }
    if (narration && s.editable && paths.some(p => (narration[s.sceneId] || []).some(n => p.startsWith('elements.' + n)))) r.narrationLinked = true;
    out.scenes.push(r);
  }
  const changedIds = out.scenes.filter(s => s.rerender).map(s => s.sceneId);
  for (const t of recipe.transitions || []) { const i = recipe.segments.findIndex(x => x.id === t.after); const nb = [recipe.segments[i]?.source.scene, recipe.segments[i + 1]?.source.scene].filter(Boolean);
    if (nb.some(x => changedIds.includes(x))) out.transitions.push({ after: t.after, reason: 'adjacent scene re-rendered; transition is rebuilt in master re-assembly' }); }
  const boundChanged = JSON.stringify(oldBound) !== JSON.stringify(newBound);
  out.master = { reassemble: changedIds.length > 0 || boundChanged, reason: [changedIds.length ? 'segments changed: ' + changedIds.join(', ') : null, boundChanged ? 'theme-bound master values changed: ' + Object.keys(newBound).filter(k => oldBound[k] !== newBound[k]).join(', ') : null].filter(Boolean).join('; ') || 'unchanged' };
  return out;
}
