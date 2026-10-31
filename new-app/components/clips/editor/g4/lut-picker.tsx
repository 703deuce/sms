'use client'

/** G4a: import / pick a .cube LUT for the selected item + its intensity. Manual only, no credits. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import { CubeParseError, parseCube } from '@/lib/clips/editor/color-grade'
import { LUT_MAX_BYTES, type WorkspaceLut } from '@/lib/clips/luts-shared'
import type { ColorSpec } from '@/lib/clips/editor/color'
import { lutError, primeLut } from './lut-cache'

let cached: WorkspaceLut[] | null = null

export function LutPicker({
  spec,
  onLive,
  onCommit,
  disabled,
}: {
  spec: ColorSpec
  onLive: (s: ColorSpec) => void
  onCommit: (s: ColorSpec, key?: string) => void
  disabled?: boolean
}) {
  const [luts, setLuts] = useState<WorkspaceLut[] | null>(cached)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/clips/luts')
      const j = (await r.json().catch(() => null)) as { data?: { luts?: WorkspaceLut[] }; error?: string } | null
      if (!r.ok || !j?.data?.luts) throw new Error(j?.error ?? `HTTP ${r.status}`)
      cached = j.data.luts
      setLuts(j.data.luts)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load LUTs')
      setLuts((l) => l ?? [])
    }
  }, [])
  useEffect(() => {
    if (!cached) void load()
  }, [load])

  const upload = async (f: File) => {
    setErr(null)
    if (!/\.cube$/i.test(f.name)) return setErr('Import a .cube LUT')
    if (f.size > LUT_MAX_BYTES) return setErr('LUT file is over 12 MB')
    let parsed
    try {
      parsed = parseCube(await f.text())
    } catch (e) {
      return setErr(e instanceof CubeParseError ? e.message : 'Could not read the .cube file')
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const r = await fetch('/api/clips/luts', { method: 'POST', body: fd })
      const j = (await r.json().catch(() => null)) as { data?: { lut?: WorkspaceLut }; error?: string } | null
      if (!r.ok || !j?.data?.lut) throw new Error(j?.error ?? `HTTP ${r.status}`)
      const lut = j.data.lut
      primeLut(lut.id, parsed)
      cached = [...(cached ?? []), lut]
      setLuts(cached)
      onCommit({ ...spec, lut: { id: lut.id } })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    const r = await fetch(`/api/clips/luts/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (r.ok) {
      cached = (cached ?? []).filter((l) => l.id !== id)
      setLuts(cached)
    }
  }

  const cur = spec.lut
  const curMissing = cur && luts && !luts.some((l) => l.id === cur.id)
  const loadErr = lutError(cur?.id)
  return (
    <div className="space-y-2" data-testid="color-lut">
      <div className="flex items-center gap-2">
        <Button size="xs" variant="outline" disabled={disabled || busy} onClick={() => fileRef.current?.click()} data-testid="color-lut-import">
          {busy ? 'Importing…' : 'Import .cube'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".cube"
          className="hidden"
          data-testid="color-lut-file"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void upload(f)
          }}
        />
        {cur ? (
          <Button size="xs" variant="ghost" disabled={disabled} onClick={() => onCommit({ ...spec, lut: undefined })} data-testid="color-lut-none">
            Remove LUT
          </Button>
        ) : null}
      </div>
      {err ? <p className="text-[11px] text-destructive" data-testid="color-lut-error">{err}</p> : null}
      {loadErr ? <p className="text-[11px] text-destructive">LUT preview unavailable: {loadErr}</p> : null}
      <div className="flex max-h-32 flex-col gap-0.5 overflow-auto" role="listbox" aria-label="LUTs">
        {(luts ?? []).map((l) => (
          <div key={l.id} className="flex items-center gap-1">
            <button
              type="button"
              role="option"
              aria-selected={cur?.id === l.id}
              disabled={disabled}
              onClick={() => onCommit({ ...spec, lut: { id: l.id, intensity: cur?.intensity } })}
              className={cn('flex-1 truncate rounded px-2 py-1 text-left text-[11px]', cur?.id === l.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
              title={`${l.filename} · ${l.size}³`}
              data-testid={`color-lut-item-${l.id}`}
            >
              {l.name}
            </button>
            <button type="button" className="px-1 text-[11px] text-muted-foreground hover:text-destructive" title="Delete LUT (projects that use it keep it)" onClick={() => void remove(l.id)}>
              ×
            </button>
          </div>
        ))}
        {luts && !luts.length ? <p className="text-[11px] text-muted-foreground">No LUTs yet — import a .cube (3D, up to 65³).</p> : null}
        {curMissing ? <p className="text-[11px] text-muted-foreground">Using a deleted LUT (still applied).</p> : null}
      </div>
      {cur ? (
        <SliderRow
          label="LUT intensity"
          value={cur.intensity ?? 100}
          min={0}
          max={100}
          unit="%"
          disabled={disabled}
          testId="color-lut-intensity"
          onLive={(v) => onLive({ ...spec, lut: { id: cur.id, intensity: v } })}
          onCommit={(v) => onCommit({ ...spec, lut: v > 0 ? { id: cur.id, intensity: v } : undefined }, 'lut-intensity')}
        />
      ) : null}
    </div>
  )
}
