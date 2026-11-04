'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { byId as CLASSIC_BY_ID } from '@/lib/clips/caption-presets'
import { captionFontStack } from '@/lib/clips/caption-fonts'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { COLOR_PRESETS } from '@/lib/clips/editor/color'
import {
  applyStarterLook,
  captionPresetPatch,
  captionStyleOptions,
  STARTER_LOOKS,
  templateInventory,
} from '@/lib/clips/editor/starter-templates'
import { newTextItem, normalizeTextItems, TEXT_PRESETS } from '@/lib/clips/editor/text-items'
import { t6CaptionPresetsEnabled, t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import { bgRemovalUiEnabled } from '@/lib/clips/editor/bg-removal'
import { layoutPackFromEdits } from '@/lib/clips/layout-packs'
import type { ExportAspect } from '@/lib/clips/export-aspect'

function Section({ title, count, children, testId }: { title: string; count?: number; children: ReactNode; testId: string }) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {count != null ? <span className="font-normal normal-case tabular-nums">{count}</span> : null}
      </p>
      {children}
    </section>
  )
}

const tile = (active: boolean) =>
  cn('rounded-lg border px-2 py-2 text-left text-[11px] transition-colors hover:bg-accent', active ? 'border-primary ring-2 ring-primary/20' : 'border-border')

/**
 * E4 Templates (CapCut "Templates" tab). Existing assets first — layouts (T6 template tiles or the
 * export layout options, rendered by the shell's existing pickers via `layoutSlot`), the existing
 * caption styles, text styles and workspace brand kits — then the new Starter looks on top.
 * Every tap is one edits change (one undo step).
 */
export function TemplatesPanel({
  edits,
  onEdits,
  layoutSlot,
  brandTemplates,
  onApplyBrand,
  playheadMs,
  durationMs,
  onOpenBgRemoval,
}: {
  edits: ClipEditsV2
  onEdits: (e: ClipEditsV2) => void
  /** Shell passes <TemplateLayoutPanel> (T6 on) or <LayoutQuickPicker> (T6 off). */
  layoutSlot: ReactNode
  brandTemplates: { id: string; name: string }[]
  onApplyBrand: (id: string) => void
  playheadMs: number
  durationMs: number
  onOpenBgRemoval?: () => void
}) {
  const pathname = usePathname()
  const t6Templates = t6TemplatesEnabled()
  const t6Captions = t6CaptionPresetsEnabled()
  const inv = templateInventory(t6Templates, t6Captions)
  const captionOpts = captionStyleOptions(t6Captions)
  const brandId = (edits.brand as { templateId?: string } | undefined)?.templateId
  const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  const returnTo = encodeURIComponent(pathname)
  const aspect = (edits.aspectRatio ?? '9:16') as ExportAspect

  const saveLayoutPack = async () => {
    const name = window.prompt('Name this layout pack')
    if (!name?.trim()) return
    try {
      const payload = layoutPackFromEdits(edits, aspect)
      const res = await fetch('/api/clips/layout-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), payload }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'save_failed')
      toast.success('Layout pack saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save layout pack')
    }
  }

  return (
    <div className="space-y-5 p-3 text-sm" data-testid="templates-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/app/clips/templates?tab=layouts&returnTo=${returnTo}`}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Browse all templates →
        </Link>
        <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => void saveLayoutPack()}>
          Save layout…
        </button>
      </div>
      <Section title="Layouts" count={inv.layouts} testId="templates-layouts">
        {layoutSlot}
      </Section>

      <Section title="Caption styles" count={captionOpts.length} testId="templates-captions">
        <div className="grid grid-cols-2 gap-2">
          {captionOpts.map((o) => {
            const classic = CLASSIC_BY_ID[o.id]
            return (
              <button
                key={o.id}
                type="button"
                data-testid={`templates-caption-${o.id}`}
                data-active={edits.captions.presetId === o.id ? 'true' : 'false'}
                className={cn(tile(edits.captions.presetId === o.id), 'bg-black/80 text-white')}
                onClick={() => onEdits(captionPresetPatch(edits, o.id))}
              >
                <span
                  className="block truncate text-[13px] font-black"
                  style={{ fontFamily: o.font ? captionFontStack(o.font) : undefined }}
                >
                  {o.name}
                </span>
                <span className="text-[11px] text-white/60">{o.kind === 'cp' ? 'Caption preset v2' : 'Classic'}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Text styles" count={TEXT_PRESETS.length} testId="templates-text">
        <div className="grid grid-cols-3 gap-2">
          {TEXT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`templates-text-${p.id}`}
              className={cn(tile(false), 'bg-black/80 text-center')}
              title={`Add "${p.label}" text at the playhead`}
              onClick={() => {
                const it = newTextItem(newId(), playheadMs, durationMs, p.id)
                onEdits({ ...edits, textItems: normalizeTextItems([...(edits.textItems ?? []), it], durationMs) })
              }}
            >
              <span
                style={{
                  fontFamily: captionFontStack(p.style.font === 'Montserrat' ? 'Montserrat Black' : p.style.font),
                  color: p.style.color,
                  background: p.style.box?.color,
                  padding: p.style.box ? '0 3px' : undefined,
                }}
              >
                {p.label.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Brand kits" count={brandTemplates.length} testId="templates-brand">
        {brandTemplates.length ? (
          <div className="grid grid-cols-2 gap-2">
            {brandTemplates.map((b) => (
              <button
                key={b.id}
                type="button"
                data-testid={`templates-brand-${b.id}`}
                data-active={brandId === b.id ? 'true' : 'false'}
                className={tile(brandId === b.id)}
                onClick={() => onApplyBrand(b.id)}
              >
                <span className="block truncate font-medium">{b.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No brand kits yet — save one from the Brand panel.</p>
        )}
      </Section>

      <Section title="Starter looks" count={STARTER_LOOKS.length} testId="templates-starters">
        <p className="text-[11px] text-muted-foreground">One tap: layout + captions + title + color. Undo reverts it all.</p>
        <div className="grid grid-cols-2 gap-2">
          {STARTER_LOOKS.map((l) => (
            <button
              key={l.id}
              type="button"
              data-testid={`templates-starter-${l.id}`}
              className={tile(false)}
              onClick={() => onEdits(applyStarterLook(edits, l, { t6Templates, t6Captions, durationMs, newId }))}
            >
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="size-3" aria-hidden />
                {l.name}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {t6Templates ? l.layoutTemplate : l.layoutMode.replace('_', ' ')} · {t6Captions ? l.caption : l.captionFallback}
                {l.color ? ` · ${COLOR_PRESETS[l.color]?.label ?? l.color}` : ''}
              </span>
            </button>
          ))}
        </div>
        {bgRemovalUiEnabled() ? (
          <button
            type="button"
            className={cn(
              tile(false),
              'mt-2 inline-flex w-full items-center justify-center gap-2 border-primary/30 bg-primary/5 font-medium',
            )}
            data-testid="bg-remove-toggle"
            onClick={() => onOpenBgRemoval?.()}
          >
            Remove background
          </button>
        ) : null}
      </Section>
    </div>
  )
}
