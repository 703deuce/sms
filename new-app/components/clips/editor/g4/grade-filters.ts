/**
 * G4a preview: SVG filters for any ColorSpec, created on demand (keyframed color steps and live
 * panel drags produce specs that are not known at render time).
 *
 *   [exposure table] → feColorMatrix (E4 affine) → [post tables] → [sharpen] → [vignette] → [grain]
 *
 * color-interpolation-filters=sRGB, so every primitive is the per-channel sRGB math of
 * color-grade.ts / color_grade.py (tables = feFuncX type=table, 256 entries). The export bakes the
 * pointwise part into a .cube (≤ 2 levels interpolation difference, same as E4); the spatial part
 * is the same kernel / mask / noise (color_fx.py), drawn at the preview's display scale.
 * `spatialOnly` = just sharpen / vignette / grain (the WebGL mirror already applied the grade).
 */
import {
  gradeParts,
  isIdentitySpec,
  isV2Spec,
  lookForSpec,
  lookKey,
  svgCurveTables,
  svgMatrixValues,
  svgTable,
  type ColorSpec,
} from '@/lib/clips/editor/color'
import {
  GRAIN_PAD,
  hasGradeFields,
  grainCell,
  grainCells,
  grainOffset,
  hasFx,
  SHARPEN_DIVISOR,
  sharpenKernel,
  specFx,
  vignetteMask,
} from '@/lib/clips/editor/color-grade'

const NS = 'http://www.w3.org/2000/svg'
const MAX_FILTERS = 96

type Entry = { el: SVGFilterElement; used: number; grain?: { img: SVGFEImageElement; gw: number; gh: number } }

export type GradeCssOpts = { spatialOnly?: boolean }

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  return e
}

function funcs(parent: SVGElement, tabs: [string, string, string]) {
  ;(['feFuncR', 'feFuncG', 'feFuncB'] as const).forEach((t, i) => parent.appendChild(el(t, { type: 'table', tableValues: tabs[i]! })))
}

function grayPngUrl(data: Uint8Array, w: number, h: number): string {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const v = data[i]!
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

const maskCache = new Map<string, string>()

export class GradeFilterBank {
  private svg: SVGSVGElement | null = null
  private defs: SVGDefsElement | null = null
  private cache = new Map<string, Entry>()
  private tick = 0
  /** Export frame size (grain cell grid follows the export resolution). */
  play = { w: 720, h: 1280 }
  /** Legacy E4 looks already rendered by <ColorLookDefs> (keeps their exact old filter ids). */
  staticKeys = new Set<string>()

  attach(host: Element | null) {
    if (!host || typeof document === 'undefined') return
    if (this.svg && this.svg.parentNode === host) return
    this.detach()
    const svg = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', 'data-testid': 'g4-grade-defs' })
    svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none')
    const defs = el('defs', {})
    svg.appendChild(defs)
    host.appendChild(svg)
    this.svg = svg
    this.defs = defs
  }

  detach() {
    this.svg?.remove()
    this.svg = null
    this.defs = null
    this.cache.clear()
  }

  /** CSS `filter` for a spec ('' = none). */
  css(spec: ColorSpec | null | undefined, opts: GradeCssOpts = {}): string {
    if (!spec || isIdentitySpec(spec)) return ''
    if (opts.spatialOnly && !hasFx(spec)) return ''
    const key = lookKey(spec)
    if (!opts.spatialOnly && !hasGradeFields(spec) && this.staticKeys.has(key)) return `url(#e4look-${key})`
    if (!this.defs) return ''
    const id = `g4-${key}${opts.spatialOnly ? '-sp' : ''}`
    let entry = this.cache.get(id)
    if (!entry) {
      entry = this.build(id, spec, Boolean(opts.spatialOnly))
      this.cache.set(id, entry)
      this.gc()
    }
    entry.used = ++this.tick
    return `url(#${id})`
  }

  /** Grain moves every export frame (30 fps): same per-frame cell offset as color_fx.py. */
  setFrame(frame: number) {
    const [ox, oy] = grainOffset(frame)
    for (const e of this.cache.values()) {
      if (!e.grain) continue
      const { img, gw, gh } = e.grain
      const x = String(-ox / gw)
      const y = String(-oy / gh)
      if (img.getAttribute('x') !== x) img.setAttribute('x', x)
      if (img.getAttribute('y') !== y) img.setAttribute('y', y)
    }
  }

  private gc() {
    if (this.cache.size <= MAX_FILTERS) return
    const old = [...this.cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, this.cache.size - MAX_FILTERS)
    for (const [id, e] of old) {
      e.el.remove()
      this.cache.delete(id)
    }
  }

  private build(id: string, spec: ColorSpec, spatialOnly: boolean): Entry {
    const f = el('filter', {
      id,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      filterUnits: 'objectBoundingBox',
      primitiveUnits: 'objectBoundingBox',
      'color-interpolation-filters': 'sRGB',
    })
    const entry: Entry = { el: f, used: 0 }
    let last = 'SourceGraphic'
    const step = (node: SVGElement, name: string) => {
      node.setAttribute('in', last)
      node.setAttribute('result', name)
      f.appendChild(node)
      last = name
    }
    if (!spatialOnly) {
      if (isV2Spec(spec)) {
        const p = gradeParts(spec)
        if (p.pre) {
          const ct = el('feComponentTransfer', {})
          const t = svgTable(p.pre)
          funcs(ct, [t, t, t])
          step(ct, 'pre')
        }
        step(el('feColorMatrix', { type: 'matrix', values: svgMatrixValues({ m: p.m, o: p.o, curve: null }) }), 'mat')
        if (p.post) {
          const ct = el('feComponentTransfer', {})
          funcs(ct, [svgTable(p.post[0]), svgTable(p.post[1]), svgTable(p.post[2])])
          step(ct, 'post')
        }
      } else {
        const look = lookForSpec(spec)
        step(el('feColorMatrix', { type: 'matrix', values: svgMatrixValues(look) }), 'mat')
        const tabs = svgCurveTables(look)
        if (tabs) {
          const ct = el('feComponentTransfer', {})
          funcs(ct, tabs)
          step(ct, 'post')
        }
      }
    }
    const fx = specFx(spec)
    if (fx.sharpen) {
      step(
        el('feConvolveMatrix', {
          order: 5,
          kernelMatrix: sharpenKernel(fx.sharpen).join(' '),
          divisor: SHARPEN_DIVISOR,
          edgeMode: 'duplicate',
          preserveAlpha: 'true',
        }),
        'sharp',
      )
    }
    if (fx.vignette) {
      const mk = `v${fx.vignette}`
      let url = maskCache.get(mk)
      if (!url) {
        url = grayPngUrl(vignetteMask(fx.vignette, 180, 320), 180, 320)
        maskCache.set(mk, url)
      }
      const img = el('feImage', { x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: 'none', result: 'vm' })
      img.setAttribute('href', url)
      f.appendChild(img)
      const comp = el('feComposite', { in2: 'vm', operator: 'arithmetic', k1: 1, k2: 0, k3: 0, k4: 0 })
      step(comp, 'vig')
    }
    if (fx.grain) {
      const c = grainCell(this.play.h)
      const gw = Math.ceil(this.play.w / c)
      const gh = Math.ceil(this.play.h / c)
      const gk = `g${fx.grain}_${gw}x${gh}`
      let url = maskCache.get(gk)
      if (!url) {
        url = grayPngUrl(grainCells(fx.grain, gw, gh), gw + GRAIN_PAD, gh + GRAIN_PAD)
        maskCache.set(gk, url)
      }
      const img = el('feImage', {
        x: 0,
        y: 0,
        width: (gw + GRAIN_PAD) / gw,
        height: (gh + GRAIN_PAD) / gh,
        preserveAspectRatio: 'none',
        result: 'gm',
        'image-rendering': 'pixelated',
      })
      img.setAttribute('href', url)
      f.appendChild(img)
      step(el('feComposite', { in2: 'gm', operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: -0.5 }), 'grain')
      entry.grain = { img, gw, gh }
    }
    if (f.childNodes.length === 0) step(el('feOffset', { dx: 0, dy: 0 }), 'id')
    this.defs!.appendChild(f)
    return entry
  }
}
