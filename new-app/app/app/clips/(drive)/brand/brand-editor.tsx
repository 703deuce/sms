'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/app/primary-button'
import { Panel } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { clipsFetch } from '@/lib/clips-api'
import { BrandTemplatesManager } from '@/components/clips/brand-templates-manager'
import { defaultBrandSettings, type BrandTemplateSettings } from '@/lib/clips/brand'
import { BRAND_STARTERS } from '@/lib/clips/brand-starters'
import { captionStyleOptions } from '@/lib/clips/editor/starter-templates'
import { cn } from '@/lib/utils'

export function BrandEditor({ initialTab = 'kit' }: { initialTab?: 'kit' | 'templates' }) {
  const [tab, setTab] = useState<'kit' | 'templates'>(initialTab)
  const [name, setName] = useState('Default brand')
  const [settings, setSettings] = useState<BrandTemplateSettings | null>(null)
  const [logoKey, setLogoKey] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [useDefault, setUseDefault] = useState(true)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void clipsFetch<{
      template: { name: string; settings: BrandTemplateSettings; logoKey: string | null; isDefault: boolean } | null
      logoUrl: string | null
    }>('/api/clips/brand').then((d) => {
      if (d.template) {
        setName(d.template.name)
        setSettings(d.template.settings)
        setLogoKey(d.template.logoKey)
        setUseDefault(d.template.isDefault)
      } else {
        setSettings(defaultBrandSettings())
      }
      setLogoUrl(d.logoUrl)
    })
  }, [])

  const save = async () => {
    if (!settings) return
    setBusy(true)
    try {
      await clipsFetch('/api/clips/brand', {
        method: 'PUT',
        body: JSON.stringify({ name, settings, logoKey, isDefault: useDefault }),
      })
      toast.success('Brand kit saved')
    } catch {
      toast.error('Could not save brand kit')
    } finally {
      setBusy(false)
    }
  }

  const uploadLogo = async (file: File) => {
    setBusy(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/clips/brand/logo', { method: 'POST', body: form })
      const json = (await res.json()) as { data?: { logoKey: string }; error?: string }
      if (!res.ok) throw new Error(json.error || res.statusText)
      const key = json.data!.logoKey
      setLogoKey(key)
      const signed = await clipsFetch<{ url: string }>(`/api/clips/brand/logo?key=${encodeURIComponent(key)}`)
      setLogoUrl(signed.url)
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  const cap = settings.captionPreset || {}
  const captionOpts = captionStyleOptions(true)

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b pb-2">
        {(['kit', 'templates'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 text-sm capitalize',
              tab === t ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground',
            )}
            onClick={() => setTab(t)}
          >
            {t === 'kit' ? 'Kit' : 'Templates'}
          </button>
        ))}
      </div>

      {tab === 'templates' ? (
        <div className="space-y-8">
          <BrandTemplatesManager />
          <section data-testid="brand-starter-kits">
            <h2 className="mb-3 text-sm font-semibold">Starter kits</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BRAND_STARTERS.map((s) => (
                <article key={s.id} className="rounded-xl border p-3">
                  <p className="font-medium">{s.name}</p>
                  <div className="mt-2 flex gap-1">
                    {(s.columns.palette ?? []).slice(0, 5).map((c) => (
                      <span key={c} className="size-4 rounded-full border" style={{ background: c }} />
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="mt-3"
                    type="button"
                    onClick={() => {
                      void fetch('/api/clips/brand/templates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: s.name, settings: s.settings, ...s.columns }),
                      }).then(async (res) => {
                        if (!res.ok) throw new Error('save_failed')
                        toast.success('Added to Brand templates')
                      }).catch(() => toast.error('Could not save template'))
                    }}
                  >
                    Use
                  </Button>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Brand kit" description="Logo, colors, and default caption style for new projects." className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="brand-name">Template name</Label>
          <Input id="brand-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="brand-default">Use as default for new projects</Label>
          <Switch id="brand-default" checked={useDefault} onCheckedChange={setUseDefault} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium">Logo (PNG or SVG)</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml"
            className="text-xs"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadLogo(f)
            }}
          />
          {logoKey && <p className="text-[10px] text-muted-foreground">{logoKey}</p>}
        </div>
        <div className="space-y-2">
          <Label>Logo position</Label>
          <Select
            value={settings.logoPosition}
            onValueChange={(v) =>
              setSettings({ ...settings, logoPosition: v as BrandTemplateSettings['logoPosition'] })
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['TL', 'TR', 'BL', 'BR'].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Logo size ({settings.logoSizePct}%)</Label>
          <Slider
            min={5}
            max={25}
            value={[settings.logoSizePct]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v
              setSettings({ ...settings, logoSizePct: typeof n === 'number' ? n : settings.logoSizePct })
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Logo opacity</Label>
          <Slider
            min={0.1}
            max={1}
            step={0.05}
            value={[settings.logoOpacity]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v
              setSettings({ ...settings, logoOpacity: typeof n === 'number' ? n : settings.logoOpacity })
            }}
          />
        </div>
        <p className="text-xs font-medium pt-2">Default captions</p>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {captionOpts.map((p) => {
            const id = p.id
            const active = cap.presetId === id
            return (
              <button
                key={id}
                type="button"
                className={`rounded border p-2 text-left text-xs ${active ? 'border-primary' : 'border-border'}`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    captionPreset: {
                      presetId: id,
                      position: cap.position ?? 'bottom',
                    },
                  })
                }
              >
                {p.name}
              </button>
            )
          })}
        </div>
        <label className="block text-xs">Default music mood</label>
        <input
          className="w-full rounded border px-2 py-1 text-xs"
          value={settings.defaultMusicMood}
          onChange={(e) => setSettings({ ...settings, defaultMusicMood: e.target.value })}
        />
        <label className="block text-xs">Primary color</label>
        <input
          className="w-full rounded border px-2 py-1 text-xs"
          value={settings.primaryColor}
          onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
        />
        <PrimaryButton size="sm" disabled={busy} onClick={() => void save()}>Save brand kit</PrimaryButton>
      </Panel>
      <Panel title="Live preview" description="Caption and logo placement on a 9:16 frame." className="flex justify-center">
      <div className="relative aspect-[9/16] w-full max-w-sm overflow-hidden rounded-xl border border-border bg-black shadow-lg ring-1 ring-white/10">
        <CaptionOverlay
          words={[{ w: 'Brand', s: 0, e: 1.2, spk: 0 }]}
          edits={{
            v: 2,
            trim: { in: 0, out: 5000 },
            cutRanges: [],
            wordFixes: {},
            captions: { enabled: true, ...settings.captionPreset, colors: { a: settings.primaryColor } },
            layout: { mode: 'speaker_follow', shotOverrides: [] },
          }}
          currentTimeSec={0.4}
          boxHeightPx={640}
        />
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="pointer-events-none absolute z-10"
            style={{
              opacity: settings.logoOpacity,
              width: `${settings.logoSizePct}%`,
              top: settings.logoPosition.includes('T') ? 12 : undefined,
              bottom: settings.logoPosition.includes('B') ? 12 : undefined,
              left: settings.logoPosition.includes('L') ? 12 : undefined,
              right: settings.logoPosition.includes('R') ? 12 : undefined,
            }}
          />
        )}
      </div>
      </Panel>
    </div>
      )}
    </div>
  )
}
