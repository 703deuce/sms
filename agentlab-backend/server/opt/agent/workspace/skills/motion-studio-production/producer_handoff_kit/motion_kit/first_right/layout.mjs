#!/usr/bin/env node
// layout.mjs — layout math before drawing (SKILL.md Stage 4c step 2).
// Inputs: the scene plan (layers, their slot on the design system's grid, the words that bring them on/off), audio/words.json,
// the grid (design/grid.json, from design/system.md) and the output size. Output: design/layout.json with a fixed box per layer
// and its on-screen window from the word anchors. Refuses: text slots outside the safe area, slots too small for the planned
// lines at the readable minimum, and slots that overlap in the same time window unless marked allowOverlap with a reason.
//
//   node layout.mjs --plan design/plan.json --words audio/words.json --grid design/grid.json [--size 1080x1920] [--out design/layout.json]
// Exit 0 ok (file written), 1 rejected (nothing written unless --write-anyway), 2 bad input.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const HERE = path.dirname(fileURLToPath(import.meta.url)); createRequire(import.meta.url)(path.join(HERE, 'components/ms-core.js')); const C = globalThis.MSCore;
export const TEXT_KINDS = new Set(['title', 'number', 'lowerThird', 'label', 'caption', 'text', 'kicker', 'source']);

// ---------- words ----------
const norm = w => String(w).toLowerCase().normalize('NFKD').replace(/[\u2019']/g, '').replace(/[^\p{L}\p{N}$%.-]+/gu, '').replace(/[.]+$/, '');
/** Accepts {L1:[{w,t0,t1}]}, [{w|word|text, t0|s|start, t1|e|end}], or {words:[...]}. Seconds. -> [{line, i, w, key, t0, t1}] */
export function loadWords(j) {
  const out = []; const push = (line, arr) => arr.forEach((x, i) => { const w = x.w ?? x.word ?? x.text; const t0 = x.t0 ?? x.s ?? x.start; const t1 = x.t1 ?? x.e ?? x.end;
    if (w == null || !Number.isFinite(+t0)) return; out.push({ line, i, w, key: norm(w), t0: +t0, t1: +(t1 ?? t0) }); });
  if (Array.isArray(j)) push('_', j); else if (Array.isArray(j.words)) push('_', j.words); else for (const [k, v] of Object.entries(j)) if (Array.isArray(v)) push(k, v);
  return out.sort((a, b) => a.t0 - b.t0);
}
/** ref: "L1:flipped#2" | "flipped" | {line, word, nth, offsetMs} | {ms} | "end" | "start" */
export function resolveRef(ref, words, ctx) {
  if (ref == null || ref === 'start') return { ms: 0, anchored: false };
  if (ref === 'end') return { ms: ctx.durationMs, anchored: false };
  if (typeof ref === 'object' && Number.isFinite(ref.ms)) return { ms: ref.ms, anchored: false };
  let line, word, nth = 1, offsetMs = 0, edge = 't0';
  if (typeof ref === 'string') { const m = /^(?:([^:]+):)?([^#@]+)(?:#(\d+))?(?:@(t0|t1))?$/.exec(ref.trim()); if (!m) throw new Error('bad word ref ' + ref); [, line, word] = m; nth = +(m[3] || 1); edge = m[4] || 't0'; }
  else ({ line, word, nth = 1, offsetMs = 0, edge = 't0' } = ref);
  const cands = words.filter(w => w.key === norm(word) && (!line || w.line === line));
  if (cands.length < nth) throw new Error(`word "${word}"${line ? ' in ' + line : ''}${nth > 1 ? ' #' + nth : ''} not in words.json`);
  const w = cands[nth - 1]; if (!line && cands.length > 1 && nth === 1) ctx.warn(`"${word}" occurs ${cands.length}x; using the first (${w.t0}s). Use "line:word#n" to be exact`);
  return { ms: Math.round(w[edge] * 1000) - ctx.offsetMs + offsetMs, wordMs: Math.round(w[edge] * 1000) - ctx.offsetMs, word: w.w, line: w.line, filmMs: Math.round(w[edge] * 1000), anchored: true };
}

// ---------- grid ----------
export function gridSlot(slot, grid, W, H) {
  if (slot === 'frame' || (grid.fullBleed || []).includes(slot)) return { x: 0, y: 0, w: W, h: H, full: true };
  const a = typeof slot === 'string' ? grid.areas?.[slot] : slot; if (!a) throw new Error('unknown slot ' + JSON.stringify(slot));
  if (a.box) return scaleBox(a.box, grid, W, H);
  const k = Math.min(W, H) / Math.min(grid.base?.w || W, grid.base?.h || H);
  let R; if (!grid.margin || grid.margin === 'safe') { const sa = C.safeArea(W, H); R = { ...sa.rect }; }
  else { const m = grid.margin; R = { x: m.l * k, y: m.t * k, w: W - (m.l + m.r) * k, h: H - (m.t + m.b) * k }; }
  const g = (grid.gutter ?? 0) * k, rg = (grid.rowGutter ?? grid.gutter ?? 0) * k, nc = grid.columns, nr = grid.rows;
  const cw = (R.w - (nc - 1) * g) / nc, rh = (R.h - (nr - 1) * rg) / nr;
  const [c0, c1] = Array.isArray(a.col) ? a.col : [a.col, a.col], [r0, r1] = Array.isArray(a.row) ? a.row : [a.row, a.row];
  if (c0 < 1 || c1 > nc || r0 < 1 || r1 > nr || c1 < c0 || r1 < r0) throw new Error('slot outside the grid: ' + JSON.stringify(a));
  return { x: R.x + (c0 - 1) * (cw + g), y: R.y + (r0 - 1) * (rh + rg), w: (c1 - c0 + 1) * cw + (c1 - c0) * g, h: (r1 - r0 + 1) * rh + (r1 - r0) * rg };
}
function scaleBox(b, grid, W, H) { const sx = W / (grid.base?.w || W), sy = H / (grid.base?.h || H); return { x: b.x * sx, y: b.y * sy, w: b.w * sx, h: b.h * sy }; }
const rb = b => ({ x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.w * 10) / 10, h: Math.round(b.h * 10) / 10 });

// ---------- planner ----------
export function plan({ plan, words, grid, W, H }) {
  const errors = [], warnings = []; const WD = loadWords(words); const sa = C.safeArea(W, H), floor = C.capFloor(W, H);
  const capRatio = grid.capRatio || 0.7, lh = grid.lineHeight || 1.1;
  const out = { schema: 'ms.layout/1', size: { w: W, h: H }, fps: plan.fps || 30, safeArea: { kind: sa.kind, rect: rb(sa.rect), cutout: sa.cutout }, capFloorPx: +floor.toFixed(2), grid: { columns: grid.columns, rows: grid.rows, margin: grid.margin || 'safe' }, scenes: [] };
  let cursor = 0;
  for (const s of plan.scenes) {
    const offsetMs = s.offsetMs ?? cursor, durationMs = s.durationMs; if (!Number.isFinite(durationMs)) { errors.push(`${s.sceneId}: durationMs required`); continue; }
    cursor = offsetMs + durationMs;
    const ctx = { offsetMs, durationMs, warn: m => warnings.push(`${s.sceneId}: ${m}`) };
    const S = { sceneId: s.sceneId, offsetMs, durationMs, layers: [] };
    for (const l of s.layers) {
      const where = `${s.sceneId}/${l.id}`;
      try {
        let box = l.box ? scaleBox(l.box, grid, W, H) : gridSlot(l.slot, grid, W, H); const full = !!box.full; delete box.full;
        const inR = resolveRef(l.in, WD, ctx), outR = resolveRef(l.out ?? 'end', WD, ctx);
        const inMs = Math.max(0, inR.ms), outMs = Math.min(durationMs, outR.ms);
        if (outMs <= inMs) errors.push(`${where}: window ${inMs}–${outMs} ms is empty (check in/out words)`);
        if (inR.anchored && (inR.ms < 0 || inR.ms > durationMs)) errors.push(`${where}: its word "${inR.word}" (${inR.filmMs} ms) is outside the scene ${offsetMs}–${offsetMs + durationMs} ms`);
        const textKind = TEXT_KINDS.has(l.kind);
        const L = { id: l.id, kind: l.kind, textKind, slot: l.slot ?? 'box', box: rb(box), window: { inMs, outMs }, film: { inMs: inMs + offsetMs, outMs: outMs + offsetMs } };
        if (full || l.role) L.role = l.role || 'background';
        if (l.text != null) L.text = l.text; if (l.lines) L.lines = l.lines; if (l.faces) L.faces = l.faces; if (l.faceManual) L.faceManual = l.faceManual;
        if (l.plateFor) L.plateFor = l.plateFor; if (l.allowOverlap) L.allowOverlap = l.allowOverlap;
        if (inR.anchored && l.hit !== false) L.hit = { word: inR.word, line: inR.line, filmMs: inR.filmMs, expectMs: inR.wordMs, toleranceMs: 200 };
        if (textKind) {
          const e = C.safeExcess(box, sa); if (C.isOut(e)) errors.push(`${where}: text slot leaves the ${sa.kind} safe area by ${JSON.stringify(Object.fromEntries(Object.entries(e).filter(([, v]) => v > 0)))}`);
          const lines = l.lines || (l.text != null ? String(l.text).split('\n').length : 1), minFont = floor / capRatio, needH = lines * minFont * lh;
          if (l.role !== 'credit' && box.h + 0.5 < needH) errors.push(`${where}: slot ${Math.round(box.h)}px tall cannot hold ${lines} line(s) at the readable minimum (${needH.toFixed(0)}px: cap ${floor.toFixed(1)}px)`);
          if (l.text) { const estW = Math.max(...String(l.text).split('\n').map(x => x.length)) * 0.5 * minFont; if (estW > box.w * lines * 1.05) warnings.push(`${where}: "${String(l.text).slice(0, 30)}" may not fit ${Math.round(box.w)}px x ${lines} line(s) even at the minimum size (estimate); the piece will error if so`); }
        }
        if (l.allowOverlap) for (const a of [].concat(l.allowOverlap)) if (!a || typeof a !== 'object' || !a.with || !String(a.reason || '').trim()) errors.push(`${where}: allowOverlap entries need {with, reason}`);
        S.layers.push(L);
      } catch (e) { errors.push(`${where}: ${e.message}`); }
    }
    // overlaps in the same time window
    const ok = (a, b) => [].concat(a.allowOverlap || []).some(x => x && (x.with === b.id || x.with === '*') && x.reason) || [].concat(a.plateFor || []).includes(b.id);
    for (let i = 0; i < S.layers.length; i++) for (let j = i + 1; j < S.layers.length; j++) {
      const a = S.layers[i], b = S.layers[j]; if (a.role === 'background' || b.role === 'background') continue;
      if (!(a.window.inMs < b.window.outMs && b.window.inMs < a.window.outMs)) continue;
      const it = C.inter(a.box, b.box); if (!it || it.w < 0.5 || it.h < 0.5) continue;
      if (ok(a, b) || ok(b, a)) continue;
      errors.push(`${S.sceneId}: ${a.id} and ${b.id} overlap by ${Math.round(it.w)}x${Math.round(it.h)}px during ${Math.max(a.window.inMs, b.window.inMs)}–${Math.min(a.window.outMs, b.window.outMs)} ms; give them separate slots or allowOverlap [{with, reason}]`);
    }
    out.scenes.push(S);
  }
  out.errors = errors; out.warnings = warnings; return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k === '--write-anyway') a.force = true; else a[k.replace(/^--/, '')] = process.argv[++i]; }
  if (!a.plan || !a.words || !a.grid) { console.error('usage: node layout.mjs --plan plan.json --words words.json --grid grid.json [--size WxH] [--out layout.json]'); process.exit(2); }
  const P = JSON.parse(fs.readFileSync(a.plan, 'utf8')), G = JSON.parse(fs.readFileSync(a.grid, 'utf8')), WJ = JSON.parse(fs.readFileSync(a.words, 'utf8'));
  let W, H; if (a.size) [W, H] = a.size.split('x').map(Number); else ({ w: W, h: H } = P.size || {}); if (!W || !H) { console.error('size required (--size WxH or plan.size)'); process.exit(2); }
  const L = plan({ plan: P, words: WJ, grid: G, W, H });
  const out = a.out || 'layout.json';
  console.log(`layout ${L.errors.length ? 'REJECTED' : 'OK'}  ${W}x${H}  ${L.scenes.reduce((n, s) => n + s.layers.length, 0)} layers in ${L.scenes.length} scene(s)  cap floor ${L.capFloorPx}px  ${L.safeArea.kind}`);
  for (const s of L.scenes) for (const l of s.layers) console.log(`  ${s.sceneId} ${l.id.padEnd(16)} ${String(l.kind).padEnd(10)} box ${l.box.x},${l.box.y} ${l.box.w}x${l.box.h}  ${l.window.inMs}–${l.window.outMs}ms${l.hit ? `  hit "${l.hit.word}" @${l.hit.filmMs}ms` : ''}`);
  for (const e of L.errors) console.log('  ✗ ' + e); for (const w of L.warnings) console.log('  ! ' + w);
  if (!L.errors.length || a.force) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, JSON.stringify(L, null, 1)); console.log('  -> ' + out); }
  process.exit(L.errors.length ? 1 : 0);
}
