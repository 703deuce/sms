/**
 * G4a preview runtime: one per PreviewStage. Applies a ColorSpec to a layer element:
 *   • no 3D stage → the full SVG chain on the layer (grade-filters.ts);
 *   • HSL ranges / LUT → each media element inside is replaced by its WebGL mirror (baked grid =
 *     the export's .cube, grade-gl.ts) and the layer keeps only the spatial fx (sharpen, vignette,
 *     grain). If mirroring is impossible (no WebGL2, CORS), the SVG chain without the 3D stage is
 *     used and `notice` says why.
 */
import { bakeGrid, lookKey, type ColorSpec } from '@/lib/clips/editor/color'
import { GRID, needs3d } from '@/lib/clips/editor/color-grade'
import { GradeFilterBank } from './grade-filters'
import { GradeMirrors, type Media } from './grade-gl'
import { lutFor } from './lut-cache'

const MAX_GRIDS = 24

export class GradePreview {
  readonly bank = new GradeFilterBank()
  readonly mirrors = new GradeMirrors()
  private grids = new Map<string, { grid: Float32Array; used: number }>()
  private n = 0
  private keep = new Set<Media>()
  private reasons = new Set<string>()
  /** Why the 3D stage (HSL / LUT) is not shown right now, or null. */
  notice: string | null = null

  /** Call at the start of each tick. */
  begin(frame: number) {
    this.keep = new Set()
    this.reasons = new Set()
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
    const key = `${lookKey(spec)}${spec.lut ? (lut ? '+L' : '-L') : ''}`
    let g = this.grids.get(key)
    if (!g) {
      g = { grid: bakeGrid(spec, GRID, lut), used: 0 }
      this.grids.set(key, g)
      if (this.grids.size > MAX_GRIDS) {
        const old = [...this.grids.entries()].sort((a, b) => a[1].used - b[1].used)[0]
        if (old) this.grids.delete(old[0])
      }
    }
    g.used = ++this.n
    return { grid: g.grid, key }
  }

  /** Grade `layer` (and its media) with `spec`; returns the CSS filter that was set. */
  apply(layer: HTMLElement | null, spec: ColorSpec | undefined | null, media: Media[]): string {
    if (!layer) return ''
    let css: string
    if (spec && needs3d(spec) && media.length) {
      const { grid, key } = this.gridFor(spec)
      const states = media.map((m) => this.mirrors.sync(m, grid, GRID, key))
      if (states.every((s) => s === 'ok' || s === 'skip')) {
        media.forEach((m) => this.keep.add(m))
        css = this.bank.css(spec, { spatialOnly: true })
      } else {
        media.forEach((m) => this.mirrors.release(m))
        if (states.includes('fail')) this.reasons.add(`HSL / LUT preview off: ${this.mirrors.blocked ?? 'unavailable'} (the export still applies them)`)
        css = this.bank.css(spec)
      }
    } else {
      css = this.bank.css(spec)
    }
    if (layer.style.filter !== css) layer.style.filter = css
    return css
  }

  /** Chain of filters for adjustment layers (pointwise 3D stage is never used there). */
  chain(specs: ColorSpec[]): string {
    return specs
      .map((s) => this.bank.css(s))
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
export const stageFrame: { video: HTMLVideoElement | null; srcMs: number; outMs: number } = { video: null, srcMs: 0, outMs: 0 }
