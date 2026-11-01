/**
 * TR-SHADER preview: WebGL2 gl-transitions (byte-identical GLSL to the worker export).
 */
import {
  GL_TRANSITIONS_LICENSE,
  PRELUDE,
  SHADERS,
  SELFTEST,
  type ShaderType,
} from '@/lib/clips/editor/g4/transition-shaders.gen'
import { compileGlProgram, corsKnown, corsState, GRADE_GL_VERTEX_SHADER, markNoCors } from './grade-gl'

export type { ShaderType }
export type TransitionGlStatus = { ok: boolean; reason?: string }

const TYPES = Object.keys(SHADERS) as ShaderType[]

function gradient(w: number, h: number, invert: boolean): Uint8Array {
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let r = (x * 8) % 256
      let g = (y * 14) % 256
      let b = (x * y) & 255
      if (invert) {
        r = 255 - r
        g = 255 - g
        b = 255 - b
      }
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
      out[i + 3] = 255
    }
  }
  return out
}

function readPixelsFlipped(gl: WebGL2RenderingContext, w: number, h: number): Uint8Array {
  const raw = new Uint8Array(w * h * 4)
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw)
  const out = new Uint8Array(raw.length)
  const row = w * 4
  for (let y = 0; y < h; y++) {
    out.set(raw.subarray((h - 1 - y) * row, (h - y) * row), y * row)
  }
  return out
}

function compareSelftest(got: Uint8Array, ref: number[]): { max: number; mean: number } {
  const n = Math.min(got.length, ref.length)
  let max = 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const d = Math.abs(got[i]! - ref[i]!)
    if (d > max) max = d
    sum += d
  }
  return { max, mean: n ? sum / n : 0 }
}

export class TransitionGL {
  private static inst: TransitionGL | null | undefined
  static status: Record<string, TransitionGlStatus> = {}
  readonly canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private progs = new Map<ShaderType, WebGLProgram>()
  private fromTex: WebGLTexture
  private toTex: WebGLTexture
  private slowStreak = 0
  private sessionOff = false
  private tested = new Set<ShaderType>()

  static get(): TransitionGL | null {
    if (TransitionGL.inst !== undefined) return TransitionGL.inst
    try {
      TransitionGL.inst = new TransitionGL()
    } catch (e) {
      TransitionGL.inst = null
      for (const t of TYPES) TransitionGL.status[t] = { ok: false, reason: e instanceof Error ? e.message : 'WebGL2 unavailable' }
    }
    return TransitionGL.inst
  }

  static ok(type: ShaderType): boolean {
    const s = TransitionGL.status[type]
    return Boolean(s?.ok) && !TransitionGL.get()?.sessionOff
  }

  private constructor() {
    this.canvas = document.createElement('canvas')
    const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true })
    if (!gl) throw new Error('WebGL2 unavailable')
    this.gl = gl
    this.fromTex = gl.createTexture()!
    this.toTex = gl.createTexture()!
    for (const tex of [this.fromTex, this.toTex]) {
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  }

  private program(type: ShaderType): WebGLProgram {
    let p = this.progs.get(type)
    if (p) return p
    const frag = GL_TRANSITIONS_LICENSE + '\n' + PRELUDE + SHADERS[type].src
    p = compileGlProgram(this.gl, GRADE_GL_VERTEX_SHADER, frag)
    const gl = this.gl
    gl.useProgram(p)
    const loc = gl.getAttribLocation(p, 'aPos') >= 0 ? gl.getAttribLocation(p, 'aPos') : gl.getAttribLocation(p, 'in_pos')
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    }
    gl.uniform1i(gl.getUniformLocation(p, 'uFrom'), 0)
    gl.uniform1i(gl.getUniformLocation(p, 'uTo'), 1)
    this.progs.set(type, p)
    return p
  }

  private selfTest(type: ShaderType): string | null {
    if (this.tested.has(type)) return TransitionGL.status[type]?.ok ? null : (TransitionGL.status[type]?.reason ?? 'selfTest failed')
    this.tested.add(type)
    const w = 160
    const h = 90
    const a = gradient(w, h, false)
    const b = gradient(w, h, true)
    try {
      this.drawInternal(type, 0.5, a, b, w, h, w, h)
      const rgba = readPixelsFlipped(this.gl, w, h)
      const rgb = new Uint8Array(Math.min(4096, w * h * 3))
      for (let i = 0, j = 0; j < rgb.length && i < rgba.length; i += 4, j += 3) {
        rgb[j] = rgba[i]!
        rgb[j + 1] = rgba[i + 1]!
        rgb[j + 2] = rgba[i + 2]!
      }
      const ref = SELFTEST[type]?.[1]
      if (!ref?.length) throw new Error('missing SELFTEST')
      const { max, mean } = compareSelftest(rgb, ref)
      if (max > 8 || mean > 1.0) {
        TransitionGL.status[type] = { ok: false, reason: `selfTest max=${max} mean=${mean.toFixed(2)}` }
        return TransitionGL.status[type]!.reason!
      }
      TransitionGL.status[type] = { ok: true }
      return null
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'selfTest error'
      TransitionGL.status[type] = { ok: false, reason: msg }
      return msg
    }
  }

  private drawInternal(
    type: ShaderType,
    progress: number,
    from: TexImageSource | Uint8Array,
    to: TexImageSource | Uint8Array,
    w: number,
    h: number,
    exportW: number,
    exportH: number,
  ) {
    const gl = this.gl
    if (this.canvas.width !== w) this.canvas.width = w
    if (this.canvas.height !== h) this.canvas.height = h
    gl.viewport(0, 0, w, h)
    const prog = this.program(type)
    gl.useProgram(prog)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.fromTex)
    if (from instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, from)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, from)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.toTex)
    if (to instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, to)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, to)
    gl.uniform1f(gl.getUniformLocation(prog, 'progress'), progress)
    gl.uniform1f(gl.getUniformLocation(prog, 'ratio'), exportW / exportH)
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), exportW, exportH)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    const err = gl.getError()
    if (err !== gl.NO_ERROR) throw new Error(`WebGL error ${err}`)
  }

  draw(
    type: ShaderType,
    progress: number,
    fromSrc: TexImageSource,
    toSrc: TexImageSource,
    w: number,
    h: number,
    exportW: number,
    exportH: number,
  ) {
    if (this.sessionOff) throw new Error('slow')
    const st = this.selfTest(type)
    if (st) throw new Error(st)
    const t0 = performance.now()
    this.drawInternal(type, progress, fromSrc, toSrc, w, h, exportW, exportH)
    const dt = performance.now() - t0
    if (dt > 50) {
      this.slowStreak++
      if (this.slowStreak >= 3) {
        this.sessionOff = true
        for (const ty of TYPES) TransitionGL.status[ty] = { ok: false, reason: 'slow' }
      }
    } else this.slowStreak = 0
  }

  static corsOk(src: TexImageSource): 'ok' | 'no' | 'pending' {
    if (src instanceof HTMLCanvasElement || src instanceof ImageBitmap) return 'ok'
    if (src instanceof HTMLVideoElement || src instanceof HTMLImageElement) {
      const url = src.currentSrc || src.getAttribute('src') || ''
      if (!url) return 'pending'
      const known = corsKnown(url)
      if (known) return known
      return corsState(url)
    }
    return 'ok'
  }

  static onSecurityError(src: TexImageSource) {
    if (src instanceof HTMLVideoElement || src instanceof HTMLImageElement) {
      const url = src.currentSrc || src.getAttribute('src') || ''
      if (url) markNoCors(url)
    }
  }
}

export { corsKnown, corsState, markNoCors }
