// three.js dictionary page (Keith Murray doc: title S01 and end card S05 share this file, as in production). Camera glides over a 3D page; DOM type by GSAP.
// Parameterized production scene (contract transovo.editable-elements/1). Camera, motion path, easing, light setup,
// geometry and the GSAP type tweens (CFG.type in index.html) are identical to the original; only literal colours,
// strings, fonts and the portrait/logo sources come from resolved props P (ms/ms-props-core.js -> ms/ms-resolve.js).
import * as THREE from './lib/three.module.js';
import { MSRuntime, rgba, fitText, overlaps, safeArea, rectOf, projectBounds } from './ms/ms-props-core.js';
const C = window.CFG;
await S.init({ start: C.start, dur: C.dur }); const tl = S.tl;
const rt = await MSRuntime.boot(); const P0 = rt.P; const MAN = rt.manifest;
const elDef = id => MAN.elements.find(x => x.id === id);
const splits = []; { const oc = S.chars; S.chars = (...a) => { const sp = oc(...a); splits.push(sp); return sp; }; }
const cv = document.getElementById('c3'); const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); r.setSize(1920, 1080, false); r.setPixelRatio(1);
r.outputColorSpace = THREE.SRGBColorSpace; r.setClearColor(P0.colors.background, 1);
const sc = new THREE.Scene(); sc.fog = new THREE.Fog(P0.colors.background, 9, 26);
const cam = new THREE.PerspectiveCamera(32, 1920 / 1080, 0.1, 100);
// page texture (repainted on setProps; same deterministic seed every paint)
const pc = document.createElement('canvas'); pc.width = 4096; pc.height = 2560; const g = pc.getContext('2d');
const lex = "aberration abstruse acumen alliteration amplitude antithesis apocalyptic articulate astronomical audacious bombastic cadence cerebellum cognizant colossal comical complex concept convoluted cosmic delivery dialect diction eloquent enigma erudite escapism esoteric euphony extraterrestrial galactic grandiloquent hostile hyperbole idiom incantation incubation instantaneous intellectual interplanetarian kinetic lexicon loquacious lyrical magical medulla metaphor mystical mythological notion paragraph phonetic poetry polysyllabic profound psychopath rhetoric sesquipedalian sychosymatic syllable symphonic telepathic transparent vernacular vocabulary vocabulous volatile".split(' ');
let hwRect = null;
function paintPage(P) { const B = rt.family(P.fonts.body), T = P.colors.text, E = P.elements;
  const grd = g.createRadialGradient(2000, 1200, 200, 2000, 1200, 2600); grd.addColorStop(0, P.colors.pageInner); grd.addColorStop(1, P.colors.pageOuter); g.fillStyle = grd; g.fillRect(0, 0, 4096, 2560);
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.textBaseline = 'top';
  for (let col = 0; col < 4; col++) { let y = 120; const x0 = 140 + col * 980; g.fillStyle = rgba(T, .10); g.fillRect(x0 - 40, 100, 2, 2360);
    while (y < 2400) { const hw = lex[Math.floor(rnd() * lex.length)];
      g.font = `600 46px ${B}`; g.fillStyle = rgba(T, .62); g.fillText(hw, x0, y); const w0 = g.measureText(hw + ' ').width;
      g.font = `italic 400 40px ${B}`; g.fillStyle = rgba(T, .40); g.fillText(['n.', 'adj.', 'v.'][Math.floor(rnd() * 3)], x0 + w0, y + 4);
      g.font = `400 38px ${B}`; g.fillStyle = rgba(T, .34); let line = '1. '; let yy = y + 56;
      for (let k = 0; k < 10 + rnd() * 14; k++) { const w = lex[Math.floor(rnd() * lex.length)] + ' '; if (g.measureText(line + w).width > 860) { g.fillText(line, x0, yy); yy += 48; line = ''; } line += w; } g.fillText(line, x0, yy); y = yy + 70; } }
  // the real entry (col 2, highlighted): editable element "headword"; original 700px bar, grows only if the text needs it
  g.font = `600 64px ${B}`; const hwW = Math.max(700, Math.ceil(g.measureText(E.headword.text).width) + 20); hwRect = { x: 2090, y: 1130, w: hwW, h: 78 };
  g.fillStyle = rgba(E.headword.highlight, .92); g.fillRect(2090, 1130, hwW, 78); g.fillStyle = E.headword.color; g.fillText(E.headword.text, 2100, 1136); }
paintPage(P0);
const tex = new THREE.CanvasTexture(pc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
const page = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshStandardMaterial({ map: tex, roughness: .9 })); page.rotation.x = -Math.PI / 2; sc.add(page);
// photo print lying on the page: editable element "portrait" (image asset, cover-cropped to 4:3 around focalPoint)
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('image load failed')); i.src = src; });
function coverCrop(t, img, aspect, fp) { const ia = img.width / img.height; t.repeat.set(1, 1); t.offset.set(0, 0); if (Math.abs(ia - aspect) < 1e-3) return;
  if (ia > aspect) { const w = aspect / ia; t.repeat.x = w; t.offset.x = Math.max(0, Math.min(1 - w, fp.x - w / 2)); } else { const h = ia / aspect; t.repeat.y = h; t.offset.y = Math.max(0, Math.min(1 - h, (1 - fp.y) - h / 2)); } }
let curImg = P0.elements.portrait.image.asset; const im = await loadImg(rt.url(curImg));
const ptex = new THREE.Texture(im); ptex.needsUpdate = true; ptex.colorSpace = THREE.SRGBColorSpace; coverCrop(ptex, im, 4 / 3, P0.elements.portrait.focalPoint);
const pr = new THREE.Group(); const borderMat = new THREE.MeshStandardMaterial({ color: P0.elements.portrait.borderColor, roughness: .8 }); const border = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 3.3), borderMat);
const ph = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 3.0), new THREE.MeshStandardMaterial({ map: ptex, roughness: .7 })); ph.position.z = 0.005; pr.add(border); pr.add(ph);
pr.rotation.x = -Math.PI / 2; pr.rotation.z = 0.06; pr.position.set(5.3, 0.02, -0.9); sc.add(pr);
const sh = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35 })); sh.rotation.x = -Math.PI / 2; sh.rotation.z = 0.06; sh.position.set(5.45, 0.01, -0.75); sc.add(sh);
const hemi = new THREE.HemisphereLight(P0.colors.text, P0.colors.background, 1.1); sc.add(hemi); const key = new THREE.DirectionalLight(0xfff1d8, 2.0); key.position.set(-4, 6, 3); sc.add(key);
const lamp = new THREE.PointLight(P0.colors.accent, 6, 9); lamp.position.set(1.2, 1.2, 0.2); sc.add(lamp);
// headword proxy: invisible plane over the highlight bar, only used for projected (screen-space) bounds of WebGL text
const hwProxy = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ visible: false })); page.add(hwProxy);
const placeProxy = () => { const k = 16 / 4096; hwProxy.scale.set(hwRect.w * k, hwRect.h * k, 1); hwProxy.position.set(-8 + (hwRect.x + hwRect.w / 2) * k, 5 - (hwRect.y + hwRect.h / 2) * k, 0.001); };
placeProxy();
// camera path (Catmull-Rom through keys, eased)
const keys = C.cam.map(k => ({ p: new THREE.Vector3(...k.p), l: new THREE.Vector3(...k.l) }));
const cp = new THREE.CatmullRomCurve3(keys.map(k => k.p)), cl = new THREE.CatmullRomCurve3(keys.map(k => k.l));
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const camHook = t => { const u = ease(Math.min(1, Math.max(0, t / C.dur))); cam.position.copy(cp.getPoint(u)); cam.lookAt(cl.getPoint(u)); lamp.intensity = 4 + 2 * Math.sin(t * 1.3); r.render(sc, cam); };
S.hooks.push(camHook);
// ---------- DOM application (text, fonts, colours, logo) + autofit ----------
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let layoutIssues = []; const logoNat = new Map();
async function prepLogo(P) { if (!P.elements.logo) return; const L = P.elements.logo; const id = L.image && L.image.asset; if (!L.visible || !id || logoNat.has(id)) return;
  const i = await loadImg(rt.url(id)).catch(() => ({ naturalWidth: 1, naturalHeight: 1 })); logoNat.set(id, { w: i.naturalWidth || 1, h: i.naturalHeight || 1 }); }
const has = id => MAN.elements.some(x => x.id === id);
function applyDom(P) { const c = P.colors, e = P.elements, iss = []; const root = document.documentElement.style;
  root.setProperty('--deep', c.background); root.setProperty('--pine', c.primary); root.setProperty('--bone', c.text); root.setProperty('--lime', c.accent); root.setProperty('--brick', c.secondary);
  const setFont = (n, sel) => { n.style.fontFamily = rt.family(sel); n.style.fontWeight = String(sel.weight || 400); };
  const fitOf = id => elDef(id).layout.fitBox, minOf = (id, d) => (elDef(id).properties.fontSize || {}).autoFitMin || d;
  if (has('title')) { const km = $('km'); km.innerHTML = e.title.text.split('\n').map(esc).join('<br>'); km.style.whiteSpace = 'nowrap'; setFont(km, e.title.font); km.style.color = e.title.color;
    fitText(km, e.title.fontSize, fitOf('title'), minOf('title', 160), iss, 'title'); }
  if (has('pronunciation')) { const pron = $('pron'); pron.innerHTML = esc(e.pronunciation.text) + ' &nbsp;<span class="it">' + esc(e.pronunciation.partOfSpeech) + '</span>'; setFont(pron, e.pronunciation.font); pron.style.color = rgba(e.pronunciation.color, .72); pron.style.whiteSpace = 'nowrap';
    fitText(pron, 46, fitOf('pronunciation'), 34, iss, 'pronunciation'); }
  if (has('location')) { const loc = $('loc'); loc.textContent = e.location.text; setFont(loc, e.location.font); loc.style.color = e.location.color; loc.style.whiteSpace = 'nowrap'; fitText(loc, 46, fitOf('location'), 34, iss, 'location'); }
  if (has('year')) { const yr = $('yr'); yr.textContent = e.year.text; setFont(yr, e.year.font); yr.style.color = e.year.color; yr.style.whiteSpace = 'nowrap'; fitText(yr, 150, fitOf('year'), 110, iss, 'year'); }
  if (has('definition')) { const d = $('see'), D = e.definition; d.innerHTML = `<span class="it">${esc(D.label)}</span> ${esc(D.before)}<span class="hl" id="fb">${esc(D.highlight)}</span>${esc(D.after)}`; setFont(d, D.font); d.style.color = D.color;
    d.style.setProperty('--lime', D.highlightColor); fitText(d, 58, fitOf('definition'), 44, iss, 'definition'); }
  if ($('fade')) $('fade').style.background = c.background;
  if (has('logo')) { const lg = $('logo'), L = e.logo, lid = L.image && L.image.asset;
    if (L.visible && lid) { const src = rt.url(lid); const pos = elDef('logo').layout.positions[L.position]; const nat = logoNat.get(lid) || { w: 1, h: 1 };
      let h = L.height, w = h * nat.w / nat.h; if (w > pos.maxW) { w = pos.maxW; h = w * nat.h / nat.w; }
      Object.assign(lg.style, { display: 'block', width: w + 'px', height: h + 'px', left: (pos.anchor === 'right' ? pos.x - w : pos.x) + 'px', top: (pos.vAnchor === 'bottom' ? pos.y - h : pos.y) + 'px' });
      if (L.tint === 'original') { lg.style.backgroundImage = `url("${src}")`; lg.style.webkitMaskImage = lg.style.maskImage = 'none'; lg.style.backgroundColor = 'transparent'; }
      else { lg.style.backgroundImage = 'none'; lg.style.webkitMaskImage = lg.style.maskImage = `url("${src}")`; lg.style.backgroundColor = L.tint === 'accent' ? c.accent : c.text; }
      if (nat.w < w || nat.h < h) iss.push({ severity: 'warning', code: 'IMAGE_UPSCALED', element: 'logo', message: `logo source ${nat.w}x${nat.h} shown at ${Math.round(w)}x${Math.round(h)}` });
    } else if (L.visible && !lid) { lg.style.display = 'none'; iss.push({ severity: 'error', code: 'ASSET_MISSING', element: 'logo', message: 'logo is visible but no logo asset is set (element or theme.brand.logo)' }); }
    else lg.style.display = 'none'; }
  // hold-frame layout checks (overlap between editable DOM elements, action-safe area)
  const boxes = {}; for (const n of document.querySelectorAll('[data-el]')) if (n.style.display !== 'none' && has(n.dataset.el)) boxes[n.dataset.el] = rectOf(n);
  overlaps(boxes, MAN.allowedOverlaps || [], iss); safeArea(boxes, MAN.safeArea.action, iss);
  layoutIssues = iss; }
await prepLogo(P0); applyDom(P0); C.type(S, tl); C.slots && C.slots(S, tl, P0);
S.ready();
rt.attach({
  async apply(P) {   // live edit: same functions as the export path, no reload
    while (splits.length) splits.pop().revert();
    S.tl.clear(); gsap.set(document.querySelectorAll('[data-el], #fade'), { clearProps: 'opacity,transform' }); S.hooks.length = 0; S.hooks.push(camHook);
    r.setClearColor(P.colors.background, 1); sc.fog.color.set(P.colors.background);
    paintPage(P); tex.needsUpdate = true; placeProxy();
    if (P.elements.portrait.image.asset !== curImg) { ptex.image = await loadImg(rt.url(P.elements.portrait.image.asset)); curImg = P.elements.portrait.image.asset; }
    coverCrop(ptex, ptex.image, 4 / 3, P.elements.portrait.focalPoint); ptex.needsUpdate = true;
    borderMat.color.set(P.elements.portrait.borderColor); hemi.color.set(P.colors.text); hemi.groundColor.set(P.colors.background); lamp.color.set(P.colors.accent);
    await prepLogo(P); applyDom(P); C.type(S, S.tl); C.slots && C.slots(S, S.tl, P); S._p = 0;
  },
  layout: () => layoutIssues,
  boundsNeedSeek: true,
  bounds() { const out = {}; for (const n of document.querySelectorAll('[data-el]')) out[n.dataset.el] = n.style.display !== 'none' ? rectOf(n) : null;
    sc.updateMatrixWorld(true); out.headword = projectBounds(THREE, hwProxy, cam, 1920, 1080); out.portrait = projectBounds(THREE, ph, cam, 1920, 1080); return out; }
});
// QA hook (read-only): camera + lamp state for motion-parity checks
window.__msTrace = () => ({ cam: cam.position.toArray().map(v => +v.toFixed(6)), quat: cam.quaternion.toArray().map(v => +v.toFixed(6)), lamp: +lamp.intensity.toFixed(6) });
