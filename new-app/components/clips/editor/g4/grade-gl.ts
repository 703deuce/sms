/**
 * G4a preview of the 3D stage (HSL ranges, imported LUTs): WebGL2 samples the SAME baked grid the
 * export writes to its .cube, with ffmpeg lut3d's tetrahedral formula and its 8-bit truncation —
 * so the mirrored pixels equal the export's (± float rounding). A self-test renders a synthetic
 * strip through the shader at start-up and compares it with color-grade.ts `tetra`; any mismatch
 * > 1 level disables this path (the preview then shows the SVG chain without the 3D stage and the
 * stage says so).
 *
 * Mirrors: each graded <video>/<img> gets a sibling <canvas> with the same class + inline style
 * (so object-fit / position / transforms / CSS filters match); the source is hidden by a data
 * attribute. Pixels can only be read from CORS-clean media: the media URL is probed first and
 * only then is `crossOrigin="anonymous"` set (a failed probe never touches the element).
 */
import { tetra } from '@/lib/clips/editor/color-grade'

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = vec2((aPos.x + 1.0) * 0.5, (1.0 - aPos.y) * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`

const FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler3D;
uniform sampler2D uSrc; uniform sampler3D uLut; uniform int uSize;
// G4b chroma key (ffmpeg colorkey on the ungraded pixel → alpha; despill → colour, before the LUT).
uniform int uUseLut; uniform int uKey; uniform vec3 uKeyRgb; uniform float uSim; uniform float uBlend;
uniform int uSpill; uniform int uSpillType; uniform float uSpillAmt;
in vec2 vUv; out vec4 o;
vec3 L(int r, int g, int b) { return texelFetch(uLut, ivec3(r, g, b), 0).rgb; }
void main() {
  vec3 c = floor(texture(uSrc, vUv).rgb * 255.0 + 0.5) / 255.0;
  float a = 1.0;
  if (uKey == 1) {
    vec3 d = c * 255.0 - uKeyRgb;
    float diff = sqrt(dot(d, d) / (255.0 * 255.0 * 3.0));
    a = uBlend > 0.0001 ? floor(clamp((diff - uSim) / uBlend, 0.0, 1.0) * 255.0) / 255.0 : (diff > uSim ? 1.0 : 0.0);
    if (uSpill == 1) {
      float sm = uSpillType == 1 ? max(c.b - (c.r * 0.5 + c.g * 0.5), 0.0) : max(c.g - (c.r * 0.5 + c.b * 0.5), 0.0);
      if (uSpillType == 1) c.b = max(c.b - sm * uSpillAmt, 0.0); else c.g = max(c.g - sm * uSpillAmt, 0.0);
      c = floor(clamp(c, 0.0, 1.0) * 255.0) / 255.0;
    }
  }
  if (uUseLut == 0) { o = vec4(c, a); return; }
  int lm = uSize - 1;
  vec3 s = clamp(c * float(lm), 0.0, float(lm));
  ivec3 p = ivec3(floor(s));
  ivec3 n = min(p + 1, ivec3(lm));
  vec3 d = s - vec3(p);
  vec3 c000 = L(p.x, p.y, p.z); vec3 c111 = L(n.x, n.y, n.z);
  vec3 v;
  if (d.r > d.g) {
    if (d.g > d.b) v = (1.0 - d.r) * c000 + (d.r - d.g) * L(n.x, p.y, p.z) + (d.g - d.b) * L(n.x, n.y, p.z) + d.b * c111;
    else if (d.r > d.b) v = (1.0 - d.r) * c000 + (d.r - d.b) * L(n.x, p.y, p.z) + (d.b - d.g) * L(n.x, p.y, n.z) + d.g * c111;
    else v = (1.0 - d.b) * c000 + (d.b - d.r) * L(p.x, p.y, n.z) + (d.r - d.g) * L(n.x, p.y, n.z) + d.g * c111;
  } else {
    if (d.b > d.g) v = (1.0 - d.b) * c000 + (d.b - d.g) * L(p.x, p.y, n.z) + (d.g - d.r) * L(p.x, n.y, n.z) + d.r * c111;
    else if (d.b > d.r) v = (1.0 - d.g) * c000 + (d.g - d.b) * L(p.x, n.y, p.z) + (d.b - d.r) * L(p.x, n.y, n.z) + d.r * c111;
    else v = (1.0 - d.g) * c000 + (d.g - d.r) * L(p.x, n.y, p.z) + (d.r - d.b) * L(n.x, n.y, p.z) + d.b * c111;
  }
  // ffmpeg lut3d (8-bit): av_clip_uint8(v * 255) truncates.
  o = vec4((floor(clamp(v, 0.0, 1.0) * 255.0) + 0.5) / 255.0, a);
}`

export type GlStatus = { ok: boolean; reason?: string }

/** G4b chroma key for the mirror (layer-fx.ts chromaParams). */
export type GlKey = { rgb: [number, number, number]; similarity: number; blend: number; despill: null | { type: 0 | 1; amount: number } }

export class GradeGL {
  private static inst: GradeGL | null | undefined
  readonly canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private srcTex: WebGLTexture
  private lutTex: WebGLTexture
  private lutKey = ''
  private uSize: WebGLUniformLocation | null
  private u: Record<string, WebGLUniformLocation | null> = {}
  static status: GlStatus = { ok: false, reason: 'not started' }

  static get(): GradeGL | null {
    if (GradeGL.inst !== undefined) return GradeGL.inst
    try {
      const g = new GradeGL()
      const err = g.selfTest()
      GradeGL.inst = err ? null : g
      GradeGL.status = err ? { ok: false, reason: err } : { ok: true }
    } catch (e) {
      GradeGL.inst = null
      GradeGL.status = { ok: false, reason: e instanceof Error ? e.message : 'WebGL2 unavailable' }
    }
    return GradeGL.inst
  }

  private constructor() {
    this.canvas = document.createElement('canvas')
    const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true })
    if (!gl) throw new Error('WebGL2 unavailable')
    this.gl = gl
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
    this.prog = prog
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    this.srcTex = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.lutTex = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.uniform1i(gl.getUniformLocation(prog, 'uSrc'), 0)
    gl.uniform1i(gl.getUniformLocation(prog, 'uLut'), 1)
    this.uSize = gl.getUniformLocation(prog, 'uSize')
    for (const n of ['uUseLut', 'uKey', 'uKeyRgb', 'uSim', 'uBlend', 'uSpill', 'uSpillType', 'uSpillAmt']) this.u[n] = gl.getUniformLocation(prog, n)
  }

  private setKey(lut: boolean, k: GlKey | null) {
    const gl = this.gl
    gl.uniform1i(this.u.uUseLut!, lut ? 1 : 0)
    gl.uniform1i(this.u.uKey!, k ? 1 : 0)
    if (!k) return
    gl.uniform3f(this.u.uKeyRgb!, k.rgb[0], k.rgb[1], k.rgb[2])
    gl.uniform1f(this.u.uSim!, k.similarity)
    gl.uniform1f(this.u.uBlend!, k.blend)
    gl.uniform1i(this.u.uSpill!, k.despill ? 1 : 0)
    gl.uniform1i(this.u.uSpillType!, k.despill?.type ?? 0)
    gl.uniform1f(this.u.uSpillAmt!, k.despill?.amount ?? 0)
  }

  private setLut(grid: Float32Array, size: number, key: string) {
    if (key === this.lutKey) return
    const gl = this.gl
    const rgba = new Float32Array(size * size * size * 4)
    for (let i = 0, j = 0; i < grid.length; i += 3, j += 4) {
      rgba[j] = grid[i]!
      rgba[j + 1] = grid[i + 1]!
      rgba[j + 2] = grid[i + 2]!
      rgba[j + 3] = 1
    }
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex)
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA32F, size, size, size, 0, gl.RGBA, gl.FLOAT, rgba)
    gl.uniform1i(this.uSize, size)
    this.lutKey = key
  }

  /** Grade `src` into this.canvas (w × h). Throws SecurityError on tainted media. */
  draw(src: TexImageSource, w: number, h: number, grid: Float32Array | null, size: number, key: string, chroma: GlKey | null = null) {
    const gl = this.gl
    if (this.canvas.width !== w) this.canvas.width = w
    if (this.canvas.height !== h) this.canvas.height = h
    gl.viewport(0, 0, w, h)
    if (grid) this.setLut(grid, size, key)
    this.setKey(Boolean(grid), chroma)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  /** null = OK, else the reason the shader does not reproduce color-grade.ts tetra. */
  selfTest(): string | null {
    const S = 5
    const grid = new Float32Array(S * S * S * 3)
    let seed = 7
    for (let i = 0; i < grid.length; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
      grid[i] = ((seed >>> 8) & 0xffff) / 0xffff
    }
    const W = 64
    const H = 4
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    if (!ctx) return 'no 2D canvas'
    const img = ctx.createImageData(W, H)
    const want: number[] = []
    for (let i = 0; i < W * H; i++) {
      const r = (i * 37) % 256
      const g = (i * 91 + 13) % 256
      const b = (i * 53 + 101) % 256
      img.data.set([r, g, b, 255], i * 4)
      const v = tetra(grid, S, [(r / 255) * (S - 1), (g / 255) * (S - 1), (b / 255) * (S - 1)])
      want.push(...v.map((x) => Math.floor(Math.min(1, Math.max(0, x)) * 255)))
    }
    ctx.putImageData(img, 0, 0)
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false)
    this.draw(c, W, H, grid, S, 'selftest')
    const out = new Uint8Array(W * H * 4)
    this.gl.readPixels(0, 0, W, H, this.gl.RGBA, this.gl.UNSIGNED_BYTE, out)
    // readPixels rows are bottom-up; the shader's vUv flips y so row 0 of the output = row 0 of src.
    let bad = 0
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        const j = ((H - 1 - y) * W + x) * 4
        for (let ch = 0; ch < 3; ch++) if (Math.abs(out[j + ch]! - want[i * 3 + ch]!) > 1) bad++
      }
    this.lutKey = ''
    return bad > 2 ? `self-test mismatch (${bad} values)` : null
  }
}

// ── CORS probe (cached per URL) ────────────────────────────────────────────

const cors = new Map<string, 'ok' | 'no' | 'pending'>()
/** URLs whose pixels could not be read even though they loaded (draw threw). */
const tainted = new Set<string>()

/**
 * G4c: hosts that never send Access-Control-Allow-Origin (checked live: cdn.pixabay.com answers a
 * request carrying an Origin header without it). Their media load plain (no crossOrigin, no probe),
 * so they no longer log a CORS error on every editor load; the grade preview says why it is 2D.
 */
const NO_CORS_HOSTS = [/(^|\.)pixabay\.com$/i]

export function isNoCorsHost(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return NO_CORS_HOSTS.some((re) => re.test(host))
  } catch {
    return false
  }
}

export function corsState(url: string): 'ok' | 'no' | 'pending' {
  const s = cors.get(url)
  if (s) return s
  if (isNoCorsHost(url)) {
    cors.set(url, 'no')
    return 'no'
  }
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/') || (typeof location !== 'undefined' && url.startsWith(location.origin))) {
    cors.set(url, 'ok')
    return 'ok'
  }
  cors.set(url, 'pending')
  void fetch(url, { mode: 'cors', headers: { Range: 'bytes=0-1' }, credentials: 'omit' })
    .then((r) => {
      cors.set(url, r.ok || r.status === 206 ? 'ok' : 'no')
      void r.body?.cancel().catch(() => {})
    })
    .catch(() => cors.set(url, 'no'))
  return 'pending'
}

export function markNoCors(url: string) {
  cors.set(url, 'no')
}

/** G4afix: a crossOrigin load of `url` succeeded (media-cors.ts) — no probe needed. */
export function markCorsOk(url: string, force = false) {
  if (force || cors.get(url) !== 'no') cors.set(url, 'ok')
}

/** Known state without starting a probe. */
export function corsKnown(url: string): 'ok' | 'no' | 'pending' | undefined {
  return cors.get(url) ?? (isNoCorsHost(url) ? 'no' : undefined)
}

// ── mirrors ────────────────────────────────────────────────────────────────

export type Media = HTMLVideoElement | HTMLImageElement
export type SyncState = 'ok' | 'skip' | 'wait' | 'fail'
type Mirror = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; key: string; t: number }
const MAX_SIDE = 1280

let styleInjected = false
function injectStyle() {
  if (styleInjected || typeof document === 'undefined') return
  const st = document.createElement('style')
  st.textContent = '[data-g4-src="1"]{opacity:0 !important}'
  document.head.appendChild(st)
  styleInjected = true
}

/** Live mirrors; `sync` per tick for each media element that needs the 3D stage. */
export class GradeMirrors {
  private m = new Map<Media, Mirror>()
  /** Last reason a mirror could not run (shown by the stage). */
  blocked: string | null = null

  /**
   * 'ok' = `el` is shown through its graded mirror; 'skip' = nothing to show yet (no frame / no
   * grid); 'wait' = CORS probe / reload in flight; 'fail' = cannot mirror (reason in `blocked`).
   */
  sync(el: Media, grid: Float32Array | null, size: number, key: string, chroma: GlKey | null = null): SyncState {
    if (!grid && !chroma) {
      this.release(el)
      return 'skip'
    }
    const gl = GradeGL.get()
    if (!gl) {
      this.blocked = GradeGL.status.reason ?? 'WebGL2 unavailable'
      this.release(el)
      return 'fail'
    }
    const url = el.currentSrc || el.getAttribute('src') || ''
    if (!url) return 'skip'
    // G4afix: media already loaded in CORS mode (media-cors.ts) is pixel-readable — skip the probe.
    if (el.crossOrigin === 'anonymous' && (el instanceof HTMLVideoElement ? el.readyState >= 2 : el.complete && el.naturalWidth > 0) && !tainted.has(url)) markCorsOk(url, true)
    const st = corsState(url)
    if (st !== 'ok') {
      if (st === 'no') this.blocked = 'this media does not allow pixel access (CORS)'
      this.release(el)
      return st === 'no' ? 'fail' : 'wait'
    }
    if (el.crossOrigin !== 'anonymous') {
      // Reload once with CORS (time / play state restored).
      const v = el instanceof HTMLVideoElement ? el : null
      const t = v?.currentTime ?? 0
      const playing = v ? !v.paused : false
      el.crossOrigin = 'anonymous'
      // G4afix: media-cors.ts falls back to a plain load if this CORS reload fails.
      el.dataset.g4cors = url
      if (v) {
        v.load()
        v.addEventListener(
          'loadedmetadata',
          () => {
            v.currentTime = t
            if (playing) void v.play().catch(() => {})
          },
          { once: true },
        )
      } else {
        const s = el.src
        el.src = ''
        el.src = s
      }
      return 'wait'
    }
    const vw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth
    const vh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight
    if (!vw || !vh || (el instanceof HTMLVideoElement && el.readyState < 2)) return this.m.get(el) ? 'ok' : 'skip'
    let mir = this.m.get(el)
    if (!mir) {
      injectStyle()
      const canvas = document.createElement('canvas')
      canvas.setAttribute('data-g4-mirror', '1')
      canvas.setAttribute('aria-hidden', 'true')
      const ctx = canvas.getContext('2d')
      if (!ctx) return 'fail'
      el.after(canvas)
      mir = { canvas, ctx, key: '', t: -1 }
      this.m.set(el, mir)
    }
    const sc = Math.min(1, MAX_SIDE / Math.max(vw, vh))
    const w = Math.max(2, Math.round(vw * sc))
    const h = Math.max(2, Math.round(vh * sc))
    const c = mir.canvas
    if (c.className !== el.className) c.className = el.className
    const css = el.style.cssText
    if (c.style.cssText !== css) c.style.cssText = css
    const t = el instanceof HTMLVideoElement ? el.currentTime : 0
    const mkey = chroma ? `${key}|k${chroma.rgb.join(',')}:${chroma.similarity}:${chroma.blend}:${chroma.despill?.amount ?? 0}` : key
    if (mir.key !== mkey || mir.t !== t || c.width !== w || c.height !== h || (el instanceof HTMLVideoElement && !el.paused)) {
      try {
        gl.draw(el, w, h, grid, size, key, chroma)
      } catch {
        tainted.add(url)
        markNoCors(url)
        this.blocked = 'this media does not allow pixel access (CORS)'
        this.release(el)
        return 'fail'
      }
      if (c.width !== w) c.width = w
      if (c.height !== h) c.height = h
      mir.ctx.clearRect(0, 0, w, h)
      mir.ctx.drawImage(gl.canvas, 0, 0)
      mir.key = mkey
      mir.t = t
    }
    if (el.getAttribute('data-g4-src') !== '1') el.setAttribute('data-g4-src', '1')
    return 'ok'
  }

  release(el: Media) {
    const mir = this.m.get(el)
    if (!mir) return
    mir.canvas.remove()
    this.m.delete(el)
    el.removeAttribute('data-g4-src')
  }

  /** Drop mirrors of elements that are gone or no longer graded in 3D. */
  prune(keep: Set<Media>) {
    for (const el of [...this.m.keys()]) if (!keep.has(el) || !el.isConnected) this.release(el)
  }

  releaseAll() {
    for (const el of [...this.m.keys()]) this.release(el)
  }
}
