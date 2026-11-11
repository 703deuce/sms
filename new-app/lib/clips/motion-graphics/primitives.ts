/**
 * Declarative charts and infographics compiled to the editor's existing ASS
 * shape/text layer representation. The SAME items are previewed in React and
 * burned by worker/clips_worker/text_items.py; no generated JS is executed.
 */
import type { TextItem } from '@/lib/clips/editor/text-items'
import type { MotionGraphic, MotionPlan } from './contract'

type Shape = 'rect' | 'rounded' | 'circle' | 'arrow'
const widthAt1920 = (aspect: MotionPlan['format']) =>
  aspect === '9:16' ? 1080 : aspect === '1:1' ? 1920 : 3413

function timing(g: MotionGraphic) {
  const duration = g.endMs - g.startMs
  const mk = (type: 'fade' | 'zoom' | 'slide_up') => ({
    type, unit: 'block' as const, durMs: Math.max(100, Math.min(500, duration / 4)),
  })
  return { in: mk('zoom'), out: mk('fade') }
}
function shape(
  g: MotionGraphic, suffix: string, kind: Shape, x: number, y: number,
  w: number, h: number, color: string,
): TextItem {
  return {
    id: 'mg_' + g.id + '__' + suffix,
    startMs: g.startMs, endMs: g.endMs, text: '',
    kind: 'shape', shape: { type: kind, w: Math.round(w), h: Math.round(h) },
    x, y, style: { font: 'Montserrat', size: 36, color, align: 'center', case: 'none' },
    anim: timing(g),
  }
}
function label(
  g: MotionGraphic, suffix: string, text: string, x: number, y: number,
  fontSize: number, font: TextItem['style']['font'] = 'Montserrat',
): TextItem {
  return {
    id: 'mg_' + g.id + '__' + suffix,
    startMs: g.startMs, endMs: g.endMs, text,
    x, y, style: {
      font, size: Math.max(24, Math.min(240, Math.round(fontSize))),
      color: g.style.textColor, align: 'center', case: 'none',
      stroke: { color: '#000000', width: 3 },
    }, anim: timing(g),
  }
}

export function expandedShapeGraphic(
  g: MotionGraphic, format: MotionPlan['format'],
  font: TextItem['style']['font'] = 'Montserrat',
): TextItem[] {
  const x0 = g.box.x * 100, y0 = g.box.y * 100
  const boxW = g.box.width * 100, boxH = g.box.height * 100
  const pixW = g.box.width * widthAt1920(format)
  const pixH = g.box.height * 1920
  if (g.templateId === 'diagram') {
    if (!g.steps || g.steps.length < 2) throw new Error('diagram_requires_steps')
    const n = g.steps.length
    if (boxH < 12 || boxW < 20) throw new Error('diagram_box_too_small')
    const perH = boxH / n
    const out: TextItem[] = []
    g.steps.forEach((text, i) => {
      const y = y0 + perH * (i + .5)
      out.push(shape(g, 'node_' + i, 'rounded', x0 + boxW / 2, y,
        pixW * .85, pixH / n * .72, g.style.backgroundColor ?? '#0F172A'))
      out.push(label(g, 'step_' + i, text, x0 + boxW / 2, y,
        Math.min(65, (pixH / n) * .28), font))
      if (i < n - 1) out.push(shape(g, 'arrow_' + i, 'arrow',
        x0 + boxW * .92, y0 + perH * (i + 1), pixW * .07, pixH / n * .27,
        g.style.accentColor))
    })
    return out
  }
  if (g.templateId === 'bar_chart') {
    if (!g.bars?.length) throw new Error('chart_requires_bars')
    if (boxW < 20 || boxH < 12) throw new Error('chart_box_too_small')
    const n = g.bars.length
    const maxValue = Math.max(...g.bars.map(v => v.value))
    if (!(maxValue > 0)) throw new Error('chart_requires_positive_value')
    const out: TextItem[] = []
    const cell = boxW / n
    const usableH = boxH * .6
    g.bars.forEach((bar, i) => {
      const hFrac = (bar.value / maxValue) * usableH
      const cx = x0 + cell * (i + .5)
      const bottom = y0 + boxH * .79
      const cy = bottom - hFrac / 2
      out.push(shape(g, 'bar_' + i, 'rounded', cx, cy,
        (pixW / n) * .58, Math.max(20, hFrac / 100 * 1920),
        g.style.accentColor))
      out.push(label(g, 'value_' + i, String(bar.value), cx,
        Math.max(y0 + 3, bottom - hFrac - boxH * .1),
        Math.min(54, pixH * .11), font))
      out.push(label(g, 'label_' + i, bar.label, cx,
        y0 + boxH * .93, Math.min(48, pixH * .105), font))
    })
    return out
  }
  throw new Error('not_a_shape_template')
}

/** A graphic's entire group of independently editable text/shape layers. */
export function isGraphicItemId(itemId: string, graphicId: string) {
  return itemId === 'mg_' + graphicId || itemId.startsWith('mg_' + graphicId + '__')
}
