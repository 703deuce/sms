'use client'

import { CLIP_FONT_MANIFEST } from '@/lib/clips/font-manifest'
import type { TemplateTextLayerOverride } from '@/lib/clips/real-video-templates/sequence-contract'
import {
  TEMPLATE_TEXT_ANIM_PRESETS,
  TEMPLATE_TEXT_STYLE_PRESETS,
} from '@/lib/clips/real-video-templates/template-text-presets'
import type { VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import type { StudioDraft } from '@/lib/clips/real-video-templates/slot-workflow'

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'

function layerOf(draft: StudioDraft, textId: string, family: VideoTemplateRelease['family']): TemplateTextLayerOverride {
  const authored = family.texts.find(t => t.id === textId)
  return {
    stylePresetId: draft.textLayers?.[textId]?.stylePresetId ?? authored?.stylePresetId,
    animPresetId: draft.textLayers?.[textId]?.animPresetId ?? authored?.animPresetId,
    font: draft.textLayers?.[textId]?.font ?? authored?.font,
  }
}

function patchLayer(
  draft: StudioDraft,
  textId: string,
  patch: Partial<TemplateTextLayerOverride>,
): StudioDraft {
  const nextLayer: TemplateTextLayerOverride = { ...draft.textLayers?.[textId], ...patch }
  return { ...draft, textLayers: { ...draft.textLayers, [textId]: nextLayer } }
}

export function TemplateTextPanel({
  release,
  draft,
  onCommitDraft,
}: {
  release: VideoTemplateRelease
  draft: StudioDraft
  onCommitDraft: (draft: StudioDraft) => void
}) {
  const fonts = CLIP_FONT_MANIFEST.filter(r => r.browserGitBlobSha1 && r.workerFile).slice(0, 24)

  return (
    <div className="space-y-4" data-testid="template-text-panel">
      {release.family.texts.map(text => {
        const layer = layerOf(draft, text.id, release.family)
        return (
          <section key={text.id} className="space-y-2 rounded-lg border border-border p-2" aria-labelledby={`tpl-text-${text.id}`}>
            <h3 id={`tpl-text-${text.id}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {text.id.replace('_', ' ')}
            </h3>
            <label className="block space-y-1 text-xs font-medium">
              Copy · max {text.maxChars}
              <input
                className={inputClass}
                maxLength={text.maxChars}
                aria-label={text.id + ' copy'}
                value={draft.texts[text.id] ?? text.defaultText}
                onChange={e =>
                  onCommitDraft({ ...draft, texts: { ...draft.texts, [text.id]: e.target.value } })}
              />
            </label>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">Text style</p>
              <ul className="grid grid-cols-2 gap-1.5" role="list">
                {TEMPLATE_TEXT_STYLE_PRESETS.map(preset => {
                  const active = layer.stylePresetId === preset.id
                  return (
                    <li key={preset.id}>
                      <button
                        type="button"
                        data-testid={`template-style-${text.id}-${preset.id}`}
                        aria-pressed={active}
                        className={
                          'flex w-full flex-col gap-1 rounded-lg border p-1.5 text-left text-[10px] ' +
                          (active ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:bg-muted/60')
                        }
                        onClick={() => onCommitDraft(patchLayer(draft, text.id, { stylePresetId: preset.id }))}
                      >
                        <span
                          className="flex h-7 items-center justify-center rounded font-black uppercase tracking-tight"
                          style={{
                            background: preset.swatch.fill,
                            color: preset.swatch.fill,
                            WebkitTextStroke: preset.swatch.stroke ? `1px ${preset.swatch.stroke}` : undefined,
                            fontFamily: '"Anton", sans-serif',
                            fontSize: 11,
                          }}
                        >
                          Aa
                        </span>
                        <span className="leading-tight">{preset.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">Animation</p>
              <ul className="flex flex-wrap gap-1" role="list">
                {TEMPLATE_TEXT_ANIM_PRESETS.map(preset => {
                  const active = layer.animPresetId === preset.id
                  return (
                    <li key={preset.id}>
                      <button
                        type="button"
                        data-testid={`template-anim-${text.id}-${preset.id}`}
                        aria-pressed={active}
                        className={
                          'rounded-full border px-2 py-1 text-[10px] ' +
                          (active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60')
                        }
                        onClick={() => onCommitDraft(patchLayer(draft, text.id, { animPresetId: preset.id }))}
                      >
                        {preset.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <label className="block space-y-1 text-xs font-medium">
              Font
              <select
                className={inputClass}
                aria-label={`${text.id} font`}
                value={layer.font ?? text.font}
                onChange={e => onCommitDraft(patchLayer(draft, text.id, { font: e.target.value }))}
              >
                {fonts.map(row => (
                  <option key={row.id} value={row.id} style={{ fontFamily: row.id }}>
                    {row.id}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )
      })}
    </div>
  )
}
