/**
 * G4a preview runtime: one per PreviewStage. Applies a ColorSpec to a layer element:
 *   • no 3D stage → the full SVG chain on the layer (grade-filters.ts);
 *   • HSL ranges / LUT → each media element inside is replaced by its WebGL mirror (baked grid =
 *     the export's .cube, grade-gl.ts) and the layer keeps only the spatial fx (sharpen, vignette,
 *     grain). If mirroring is impossible (no WebGL2, CORS), the SVG chain without the 3D stage is
 *     used and `notice` says why.
 *
 * EF-12: active unmasked adjustment layers with HSL/LUT compose their pointwise grade into the
 * clip grid (`setAdjust3d`) before mirrors run; those layers' wrappers use spatial-only CSS.
 */
import { bakeGrid, gradeParts, gradeRgb, lookKey, type ColorSpec } from '@/lib/clips/editor/color'
import { GRID, hasPointwiseV2, needs3d } from '@/lib/clips/editor/color-grade'
import { GradeFilterBank } from './grade-filters'
import { GradeMirrors, type GlKey, type Media } from './grade-gl'
import { lutFor } from './lut-cache'
import { shakeCss } from '@/lib/clips/editor/fx-library'

const MAX_GRIDS = 24

function composeGrids(base: Float32Array, stack: ColorSpec[], size: number): Float32Array {
  let grid = base
  for (const adj of stack) {
    const lut = adj.lut ? lutFor(adj.lut.id) : null
    const parts = hasPointwiseV2(adj) ? gradeParts(adj) : undefined
    const out = new Float32Array(grid.length)
    for (let i = 0; i < size * size * size; i++) {
      const o = i * 3
      const rgb: [number, number, number] = [grid[o]!, grid[o + 1]!, grid[o + 2]!]
      const v = gradeRgb(adj, rgb, lut, parts)
      out[o] = v[0]
      out[o + 1] = v[1]
      out[o + 2] = v[2]
    }
    grid = out
  }
  return grid
}

export class GradePreview {
  readonly bank = new GradeFilterBank()
  readonly mirrors = new GradeMirrors()
  private grids = new Map<string, { grid: Float32Array; used: number }>()
  private n = 0
  private keep = new Set<Media>()
  private reasons = new Set<string>()
  /** EF-12: active adjust layers (bottom → top) composed into clip grids this tick. */
  private adjust3d: ColorSpec[] | null = null
  /** Why the 3D stage (HSL / LUT) is not shown right now, or null. */
  notice: string | null = null

  /** EF-12: call each tick before grading main / B-roll / clones. */
  setAdjust3d(specs: ColorSpec[] | null) {
    this.adjust3d = specs?.length ? specs : null
  }

  note(reason: string) {
    this.reasons.add(reason)
  }

  /** Call at the start of each tick. */
  begin(frame: number) {
    this.keep = new Set()
    this.reasons = new Set()
    this.adjust3d = null
    this.bank.setFrame(frame)
  }

  /** Call at the end of each tick (drops stale mirrors). Returns the notice. */
  end(): string | null {
    this.mirrors.prune(this.keep)
    this.notice = this.reasons.size ? [...this.reasons][0]! : null
    return this.notice
  }

  gridFor(spec: ColorSpec): { grid: Float32Array; key: string } {
    const lut = spec.lut ? lutFor(spec.lut.id) : null
    let key = `${lookKey(spec)}${spec.lut ? (lut ? '+L' : '-L') : ''}`
    let grid = bakeGrid(spec, GRID, lut)
    if (this.adjust3d?.length) {
      key += `|a:${this.adjust3d.map((s) => lookKey(s)).join('+')}`
      grid = composeGrids(grid, this.adjust3d, GRID)
    }
    let g = this.grids.get(key)
    if (!g) {
      g = { grid, used: 0 }
      this.grids.set(key, g)
      if (this.grids.size > MAX_GRIDS) {
        const old = [...this.grids.entries()].sort((a, b) => a[1].used - b[1].used)[0]
        if (old) this.grids.delete(old[0])
      }
    }
    g.used = ++this.n
    return { grid: g.grid, key }
  }

  /**
   * Grade `layer` (and its media) with `spec`; returns the CSS filter that was set. G4b `chroma`:
   * the media is mirrored through the WebGL key (alpha from the ungraded pixel, despill), and the
   * rest of the grade stays on the layer as CSS (3D stage in the mirror when needed).
   */
  apply(layer: HTMLElement | null, spec: ColorSpec | undefined | null, media: Media[], chroma: GlKey | null = null): string {
    if (!layer) return ''
    let css: string
    const clip3d = Boolean(spec && needs3d(spec))
    const d3 = clip3d || Boolean(this.adjust3d?.length)
    if ((d3 || chroma) && media.length) {
      const g = d3 && spec ? this.gridFor(spec) : null
      const states = media.map((m) => this.mirrors.sync(m, g?.grid ?? null, GRID, g?.key ?? 'id', chroma))
      if (states.every((s) => s === 'ok' || s === 'skip')) {
        media.forEach((m) => this.keep.add(m))
        css = this.bank.css(spec, { spatialOnly: d3 })
      } else {
        media.forEach((m) => this.mirrors.release(m))
        if (states.includes('fail')) {
          const what = chroma && d3 ? 'Chroma key / HSL / LUT' : chroma ? 'Chroma key' : 'HSL / LUT'
          this.reasons.add(`${what} preview off: ${this.mirrors.blocked ?? 'unavailable'} (the export still applies ${chroma && !d3 ? 'it' : 'them'})`)
        }
        css = this.bank.css(spec)
      }
    } else {
      css = this.bank.css(spec)
    }
    if (layer.style.filter !== css) layer.style.filter = css
    this.setShake(layer, this.shake([spec]))
    return css
  }

  /** G4b shake (CSS transform = the export's scale + crop) for the current frame. */
  shake(specs: (ColorSpec | null | undefined)[]): string {
    const { w, h } = this.bank.play
    return specs
      .map((s) => shakeCss(s?.fx?.shake ?? 0, w, h, this.bank.frame))
      .filter(Boolean)
      .join(' ')
  }

  /** Set / clear the shake transform (only ever clears a transform this runtime set). */
  setShake(layer: HTMLElement | null, tf: string) {
    if (!layer) return
    if (tf) {
      if (layer.style.transform !== tf) layer.style.transform = tf
      layer.dataset.g4shake = '1'
    } else if (layer.dataset.g4shake) {
      layer.style.transform = ''
      delete layer.dataset.g4shake
    }
  }

  /** Chain of filters for adjustment layers (EF-12: spatial-only when the layer uses the 3D stage). */
  chain(specs: ColorSpec[]): string {
    return specs
      .map((s) => this.bank.css(s, needs3d(s) ? { spatialOnly: true } : undefined))
      .filter(Boolean)
      .join(' ')
  }

  dispose() {
    this.mirrors.releaseAll()
    this.bank.detach()
  }
}

/** Media elements of a layer (not our mirrors). */
export function layerMedia(layer: Element | null): Media[] {
  if (!layer) return []
  return Array.from(layer.querySelectorAll<HTMLVideoElement | HTMLImageElement>('video, img'))
}

/** The stage's main <video> (scopes / Auto / eyedropper read its frame at the playhead). */
export const stageFrame: { video: HTMLVideoElement | null; srcMs: number; outMs: number; offsetMs?: number } = { video: null, srcMs: 0, outMs: 0 }
