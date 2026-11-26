// assemble.mjs: compile a declarative assembly recipe (transovo.assembly/1) into ffmpeg arguments. No shell, no free-form
// filter strings: every filter name is whitelisted and every value is charset-checked, so a recipe from storage cannot inject.
import { run } from './util.mjs'; import { CFG } from './config.mjs'; import fs from 'node:fs'; import path from 'node:path';
const FILTERS = new Set(['fps', 'format', 'setsar', 'tpad', 'trim', 'setpts', 'eq', 'colorbalance', 'vignette', 'noise', 'fade', 'scale', 'crop', 'pad', 'curves', 'hue', 'unsharp', 'gblur', 'colorchannelmixer', 'lut3d_off']);
const SAFE = /^[A-Za-z0-9_.+\-*/#]+$/;
// decoder threads per input: decoding is bit-exact at any thread count, so this only bounds memory (a 40-input graph with
// default frame threading on 8 cores reached ~6 GB and was OOM-killed). Encoder threading is untouched.
const DEC = ['-threads', String(process.env.MS_DECODE_THREADS || 2)];
function val(v, bound) { if (typeof v === 'string' && v.startsWith('$')) { const b = bound[v.slice(1)]; if (b == null) throw new Error('unbound recipe value ' + v); v = b; }
  if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) v = '0x' + v.slice(1).toUpperCase();
  const s = String(v); if (!SAFE.test(s)) throw new Error('unsafe recipe value: ' + s.slice(0, 40)); return s; }
export function filt(f, bound, ctx = {}) { const { f: name, ...p } = f; if (!FILTERS.has(name)) throw new Error('filter not allowed: ' + name);
  if (name === 'fade' && p.fromEnd != null) { p.st = (ctx.totalFrames / ctx.fps - p.fromEnd).toFixed(3); delete p.fromEnd; }
  if (name === 'trim' && p.end_frame === '$total') p.end_frame = ctx.totalFrames;
  const kv = Object.entries(p).map(([k, v]) => { if (!/^[a-z_]+$/.test(k)) throw new Error('bad filter option ' + k); return `${k}=${val(v, bound)}`; }); return kv.length ? `${name}=${kv.join(':')}` : name; }
const chain = (fs_, bound, ctx) => fs_.map(f => filt(f, bound, ctx)).join(',');
/** inputs: { segments: {segId: path}, overlays: {ovId: [paths]}, audio: path }; bound: theme-bound values */
export function compile(recipe, inputs, bound, outFile, pass, passlog) {
  const ctx = { totalFrames: recipe.totalFrames, fps: recipe.format.fps }; const ins = [], fg = []; let n = 0;
  const segLabels = recipe.segments.map((s, i) => { ins.push(...DEC, '-i', inputs.segments[s.id]); fg.push(`[${n}:v]${chain(s.filters || [], bound, ctx) || 'null'}[v${i}]`); n++; return `[v${i}]`; });
  // groups split at xfade transitions
  const cuts = (recipe.transitions || []).map(t => ({ ...t, idx: recipe.segments.findIndex(s => s.id === t.after) })).sort((a, b) => a.idx - b.idx);
  let groups = [], start = 0; for (const c of cuts) { groups.push(segLabels.slice(start, c.idx + 1)); start = c.idx + 1; } groups.push(segLabels.slice(start));
  groups.forEach((g, i) => fg.push(`${g.join('')}concat=n=${g.length}:v=1:a=0${recipe.groupFilters ? ',' + chain(recipe.groupFilters, bound, ctx) : ''}[g${i}]`));
  let cur = '[g0]'; cuts.forEach((c, i) => { fg.push(`${cur}[g${i + 1}]xfade=transition=${val(c.transition, bound)}:duration=${val(c.durationSec, bound)}:offset=${(+c.offsetSec).toFixed(4)}[x${i}]`); cur = `[x${i}]`; });
  if (recipe.baseFilters) { fg.push(`${cur}${chain(recipe.baseFilters, bound, ctx)}[base]`); cur = '[base]'; }
  (recipe.overlays || []).forEach((o, k) => { const parts = inputs.overlays[o.id]; const labs = parts.map(p => { ins.push(...DEC, '-i', p); return `[${n++}:v]`; });
    const pre = labs.length > 1 ? `${labs.join('')}concat=n=${labs.length}:v=1:a=0,` : labs[0];
    fg.push(`${pre}${labs.length > 1 ? '' : ''}${chain(o.filters || [{ f: 'setpts', expr: 'PTS-STARTPTS' }], bound, ctx).replace('setpts=expr=', 'setpts=')}[o${k}]`);
    const opts = Object.entries(o.overlay || { x: 0, y: 0 }).map(([kk, v]) => { if (!/^[a-z_]+$/.test(kk)) throw new Error('bad overlay opt'); return `${kk}=${val(v, bound)}`; }).join(':');
    fg.push(`${cur}[o${k}]overlay=${opts}[ov${k}]`); cur = `[ov${k}]`; });
  fg.push(`${cur}${chain(recipe.post || [], bound, ctx).replace(/setpts=expr=/g, 'setpts=') || 'null'}[out]`);
  ins.push('-i', inputs.audio); const aIdx = n;
  const e = recipe.encode; const v = ['-c:v', 'libx264', '-preset', e.preset || 'medium', ...(e.tune ? ['-tune', e.tune] : []), '-profile:v', 'high', '-level:v', e.level || '4.2', '-pix_fmt', 'yuv420p', '-r', String(recipe.format.fps), ...(e.gop ? ['-g', String(e.gop)] : []), ...(e.bt709 ? ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'] : []),
    ...(e.twoPass ? ['-b:v', e.bitrate, '-maxrate', e.maxrate, '-bufsize', e.bufsize, '-pass', String(pass), '-passlogfile', passlog] : ['-crf', String(e.crf || 18)]), '-frames:v', String(recipe.totalFrames)];
  const a = recipe.audio; const aud = ['-map', `${aIdx}:a`, ...(a.filters ? ['-af', a.filters.map(x => filtAudio(x)).join(',')] : []), '-c:a', 'aac', '-b:a', a.bitrate || '128k', ...(a.rate ? ['-ar', String(a.rate)] : []), ...(a.shortest ? ['-shortest'] : []), '-movflags', '+faststart'];
  const head = ['-v', 'error', '-y', ...ins, '-filter_complex', fg.join(';'), '-map', '[out]', ...v];
  return pass === 1 ? [...head, '-an', '-f', 'mp4', '/dev/null'] : [...head, ...aud, outFile];
}
function filtAudio(x) { const { f, ...p } = x; if (!['apad', 'atrim'].includes(f)) throw new Error('audio filter not allowed ' + f); const kv = Object.entries(p).map(([k, v]) => `${k}=${val(v, {})}`); return kv.length ? `${f}=${kv.join(':')}` : f; }
export async function assemble(recipe, inputs, bound, outFile, { workDir }) {
  fs.mkdirSync(workDir, { recursive: true }); const passlog = path.join(workDir, 'x264pass'); const t0 = Date.now();
  if (recipe.encode.twoPass) await run(CFG.ffmpeg, compile(recipe, inputs, bound, outFile, 1, passlog), { cwd: workDir });
  await run(CFG.ffmpeg, compile(recipe, inputs, bound, outFile, 2, passlog), { cwd: workDir });
  return { out: outFile, ms: Date.now() - t0 };
}
// per-frame md5 of the pre-encode picture (proves untouched ranges are bit-identical before compression)
export async function framemd5(recipe, inputs, bound, outTxt) { const args = compile(recipe, inputs, bound, '/dev/null', 2, '/tmp/x'); const i = args.indexOf('-map');
  const pre = args.slice(0, args.indexOf('-c:v')); await run(CFG.ffmpeg, [...pre.filter((x, k) => !(x === '-y')), '-f', 'framemd5', outTxt]); return outTxt; }
