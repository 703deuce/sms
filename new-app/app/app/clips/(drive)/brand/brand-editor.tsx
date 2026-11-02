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
import {
  brandImageOverlayPreviewStyle,
  defaultBrandSettings,
  type BrandTemplateSettings,
  type BrandWatermarkPosition,
} from '@/lib/clips/brand'
import { BRAND_FONTS } from '@/lib/clips/brand-kit'
import { BRAND_STARTERS } from '@/lib/clips/brand-starters'
import { captionFontStack } from '@/lib/clips/caption-fonts'
import { captionStyleOptions } from '@/lib/clips/editor/starter-templates'
import { cn } from '@/lib/utils'

const WATERMARK_GRID: { id: BrandWatermarkPosition; label: string }[] = [
  { id: 'TL', label: 'tl' },
  { id: 'TC', label: 'tc' },
  { id: 'TR', label: 'tr' },
  { id: 'ML', label: 'ml' },
  { id: 'C', label: 'mc' },
  { id: 'MR', label: 'mr' },
  { id: 'BL', label: 'bl' },
  { id: 'BC', label: 'bc' },
  { id: 'BR', label: 'br' },
]

type BrandRow = {
  name: string
  settings: BrandTemplateSettings
  logoKey: string | null
  isDefault: boolean
  headingFont: string | null
  captionFont: string | null
  palette: string[] | null
  watermarkKey: string | null
  watermarkPosition: BrandWatermarkPosition | null
  watermarkOpacity: number | null
  watermarkSizePct: number | null
}

export function BrandEditor({ initialTab = 'kit' }: { initialTab?: 'kit' | 'templates' }) {
  const [tab, setTab] = useState<'kit' | 'templates'>(initialTab)
  const [name, setName] = useState('Default brand')
  const [settings, setSettings] = useState<BrandTemplateSettings | null>(null)
  const [logoKey, setLogoKey] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [useDefault, setUseDefault] = useState(true)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const wmFileRef = useRef<HTMLInputElement>(null)
  const [headingFont, setHeadingFont] = useState<string | null>('Inter')
  const [captionFont, setCaptionFont] = useState<string | null>('Inter')
  const [palette, setPalette] = useState<string[]>(['#111827', '#FACC15'])
  const [watermarkKey, setWatermarkKey] = useState<string | null>(null)
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null)
  const [watermarkPosition, setWatermarkPosition] = useState<BrandWatermarkPosition>('BR')
  const [watermarkSizePct, setWatermarkSizePct] = useState(12)
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.8)

  const signAsset = async (key: string | null) => {
    if (!key) return null
    const signed = await clipsFetch<{ url: string }>(`/api/clips/brand/logo?key=${encodeURIComponent(key)}`)
    return signed.url
  }

  useEffect(() => {
    void clipsFetch<{ template: BrandRow | null; logoUrl: string | null }>('/api/clips/brand').then(async (d) => {
      if (d.template) {
        const t = d.template
        setName(t.name)
        setSettings(t.settings)
        setLogoKey(t.logoKey)
        setUseDefault(t.isDefault)
        setHeadingFont(t.headingFont ?? 'Inter')
        setCaptionFont(t.captionFont ?? 'Inter')
        setPalette(Array.isArray(t.palette) && t.palette.length ? t.palette : ['#111827', '#FACC15'])
        setWatermarkKey(t.watermarkKey)
        setWatermarkPosition((t.watermarkPosition ?? 'BR') as BrandWatermarkPosition)
        setWatermarkSizePct(typeof t.watermarkSizePct === 'number' ? t.watermarkSizePct : 12)
        setWatermarkOpacity(typeof t.watermarkOpacity === 'number' ? t.watermarkOpacity : 0.8)
        setWatermarkUrl(t.watermarkKey ? await signAsset(t.watermarkKey) : null)
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
        body: JSON.stringify({
          name,
          settings,
          logoKey,
          isDefault: useDefault,
          headingFont,
          captionFont,
          palette,
          watermarkKey,
          watermarkPosition,
          watermarkOpacity,
          watermarkSizePct,
        }),
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
      setLogoUrl(await signAsset(key))
    } finally {
      setBusy(false)
    }
  }

  const uploadWatermark = async (file: File) => {
    setBusy(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/clips/brand/logo', { method: 'POST', body: form })
      const json = (await res.json()) as { data?: { logoKey: string }; error?: string }
      if (!res.ok) throw new Error(json.error || res.statusText)
      const key = json.data!.logoKey
      setWatermarkKey(key)
      setWatermarkUrl(await signAsset(key))
    } finally {
      setBusy(false)
    }
  }

  const patchPalette = (index: number, hex: string) => {
    setPalette((prev) => {
      const next = [...prev]
      next[index] = hex
      return next.slice(0, 5)
    })
  }

  const addSwatch = () => {
    setPalette((prev) => (prev.length >= 5 ? prev : [...prev, '#38bdf8']))
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

        <div className="space-y-2 border-t pt-3" data-testid="brand-kit-fonts">
          <p className="text-xs font-medium">Typography</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Heading font</Label>
              <Select value={headingFont ?? 'Inter'} onValueChange={setHeadingFont}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_FONTS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Caption font</Label>
              <Select value={captionFont ?? 'Inter'} onValueChange={setCaptionFont}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_FONTS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-2" data-testid="brand-kit-palette">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Palette (up to 5)</p>
            <Button type="button" size="sm" variant="outline" disabled={palette.length >= 5} onClick={addSwatch}>
              Add swatch
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {palette.map((c, i) => (
              <label key={i} className="flex flex-col items-center gap-1 text-[10px]">
                <input
                  type="color"
                  value={c}
                  onChange={(e) => patchPalette(i, e.target.value)}
                  className="size-9 cursor-pointer rounded border border-border"
                />
                {c}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t pt-3" data-testid="brand-kit-watermark">
          <p className="text-xs font-medium">Watermark</p>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Image (PNG or SVG)</p>
            <input
              ref={wmFileRef}
              type="file"
              accept="image/png,image/svg+xml"
              className="text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadWatermark(f)
              }}
            />
            {watermarkUrl ? (
              <div className="mt-2 flex items-center gap-2">
                <img src={watermarkUrl} alt="" className="max-h-10 rounded border bg-muted object-contain p-1" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setWatermarkKey(null)
                    setWatermarkUrl(null)
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>Position</Label>
            <div className="grid w-fit grid-cols-3 gap-1">
              {WATERMARK_GRID.map((cell) => (
                <button
                  key={cell.id}
                  type="button"
                  aria-label={cell.label}
                  className={cn(
                    'size-8 rounded border text-[9px] uppercase',
                    watermarkPosition === cell.id ? 'border-primary bg-primary/15 text-primary' : 'border-border',
                  )}
                  onClick={() => setWatermarkPosition(cell.id)}
                >
                  {cell.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Watermark size ({watermarkSizePct}%)</Label>
            <Slider
              min={4}
              max={30}
              value={[watermarkSizePct]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] : v
                if (typeof n === 'number') setWatermarkSizePct(n)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Watermark opacity ({Math.round(watermarkOpacity * 100)}%)</Label>
            <Slider
              min={0.1}
              max={1}
              step={0.05}
              value={[watermarkOpacity]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] : v
                if (typeof n === 'number') setWatermarkOpacity(n)
              }}
            />
          </div>
        </div>

        <PrimaryButton size="sm" disabled={busy} onClick={() => void save()}>Save brand kit</PrimaryButton>
      </Panel>
      <Panel title="Live preview" description="Caption, logo, and watermark on a 9:16 frame." className="flex justify-center">
      <div className="relative aspect-[9/16] w-full max-w-sm overflow-hidden rounded-xl border border-border bg-black shadow-lg ring-1 ring-white/10">
        <CaptionOverlay
          words={[{ w: 'Brand headline', s: 0, e: 1.2, spk: 0 }]}
          edits={{
            v: 2,
            trim: { in: 0, out: 5000 },
            cutRanges: [],
            wordFixes: {},
            captions: {
              enabled: true,
              ...settings.captionPreset,
              font: captionFont ?? undefined,
              colors: { a: settings.primaryColor },
            },
            layout: { mode: 'speaker_follow', shotOverrides: [] },
          }}
          currentTimeSec={0.4}
          boxHeightPx={640}
        />
        <p
          className="pointer-events-none absolute left-3 top-3 z-[5] text-sm font-bold text-white drop-shadow"
          style={{ fontFamily: captionFontStack(headingFont ?? 'Inter') }}
        >
          Heading
        </p>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            style={brandImageOverlayPreviewStyle(settings.logoPosition, settings.logoSizePct, settings.logoOpacity)}
          />
        ) : null}
        {watermarkUrl ? (
          <img
            src={watermarkUrl}
            alt=""
            style={brandImageOverlayPreviewStyle(watermarkPosition, watermarkSizePct, watermarkOpacity)}
          />
        ) : null}
      </div>
      </Panel>
    </div>
      )}
    </div>
  )
}
