'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TemplateStage, TemplateTitleOverlay } from '@/components/clips/editor/template-stage'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { resolveTemplateGeometryById } from '@/lib/clips/templates/geometry'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'
import { T6_TEMPLATES_BY_ID } from '@/lib/clips/templates/registry'
import { t6CaptionPresetsEnabled, t6TitleAutoEnabled } from '@/lib/clips/t6-feature-flags'

const TEMPLATE_IDS = Object.keys(T6_TEMPLATES_BY_ID)
const TITLES = ['white_on_black', 'white_on_dark_blur', 'black_on_light_blur', 'white_box_black'] as const
const CPS = ['cp1', 'cp2', 'cp3', 'cp4', 'cp5', 'cp6', 'cp7', 'cp8', 'cp9', 'cp10', 'cp11'] as const

export default function T62AcceptanceDevPage() {
  if (process.env.NODE_ENV === 'production') return null

  const bounds = { clipStartMs: 0, clipEndMs: 11_000 }
  const [edits, setEdits] = useState<ClipEditsV2>(() => normalizeEdits(defaultEdits(bounds), bounds))
  const [loaded, setLoaded] = useState(false)
  const [timeSec, setTimeSec] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [persist, setPersist] = useState<ClipEditsV2 | null>(null)
  const primaryRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    fetch('/clips/t62/fixture-a.json')
      .then((r) => r.json())
      .then((d) => {
        const base = normalizeEdits({ ...defaultEdits(bounds), ...d.edits }, bounds)
        setEdits(base)
        setLoaded(true)
        const saved = localStorage.getItem('t62-edits')
        if (saved) setEdits(normalizeEdits(JSON.parse(saved), bounds))
      })
  }, [])

  useEffect(() => {
    const tick = () => {
      const v = primaryRef.current
      if (v) setTimeSec(v.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const persistEdits = useCallback((next: ClipEditsV2) => {
    setEdits(next)
    localStorage.setItem('t62-edits', JSON.stringify(next))
    void fetch('/api/dev/t6-2/edits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captions: next.captions, layout: next.layout, exportTemplate: next.exportTemplate }),
    })
  }, [])

  const aiMeta = useMemo(
    () =>
      signalsOrDefaults({
        clipType: 'gaming',
        signals: { facecam_box: { x: 0, y: 0.73, w: 0.44, h: 0.26 }, facecam_conf: 0.95 },
        facecamLayout: {
          gameplay: { x: 0, y: 0, w: 1, h: 0.71 },
          facecam: { x: 0, y: 0.73, w: 0.44, h: 0.26 },
        },
      }),
    [],
  )

  const spec = useMemo(() => {
    const tid = edits.layout?.template?.id ?? 'G3'
    return resolveTemplateGeometryById(tid, aiMeta, edits)
  }, [edits, aiMeta])

  const words = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        w: ['this', 'is', 'a', 'caption', 'harness', 'line'][i % 6],
        s: i * 0.4,
        e: i * 0.4 + 0.35,
        idx: i,
      })),
    [],
  )

  if (!loaded || !spec) return <p className="p-4 text-sm">Loading T6.2 fixture…</p>

  const t6Caps = t6CaptionPresetsEnabled()
  const t6Titles = t6TitleAutoEnabled()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4" data-testid="t62-acceptance-root">
      <h1 className="text-lg font-semibold">T6.2 acceptance (dev)</h1>
      <div className="flex flex-col gap-4">
        <div className="min-w-0 space-y-3 text-sm">
          <div className="flex flex-wrap gap-1" data-testid="t62-template-grid">
            {TEMPLATE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                data-testid={`t62-template-${id}`}
                className={`rounded border px-2 py-1 ${edits.layout?.template?.id === id ? 'border-primary bg-primary/10' : 'border-border'}`}
                onClick={() =>
                  persistEdits(
                    normalizeEdits(
                      {
                        ...edits,
                        layout: {
                          ...edits.layout,
                          template: { id, auto: false, lane: id.startsWith('G') ? 'gaming' : 'irl' },
                        },
                      },
                      bounds,
                    ),
                  )
                }
              >
                {id}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {TITLES.map((t) => (
              <button
                key={t}
                type="button"
                data-testid={`t62-title-${t}`}
                className="rounded border border-border px-2 py-1"
                onClick={() =>
                  persistEdits(
                    normalizeEdits(
                      {
                        ...edits,
                        exportTemplate: {
                          ...edits.exportTemplate,
                          headlineBar: { enabled: true, text: 'T6 TITLE' },
                          headlineStyle: { t6Id: t },
                        },
                      },
                      bounds,
                    ),
                  )
                }
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {CPS.map((c) => (
              <button
                key={c}
                type="button"
                data-testid={`t62-cp-${c}`}
                className={`rounded border px-2 py-1 ${edits.captions?.presetId === c ? 'border-primary' : 'border-border'}`}
                onClick={() =>
                  persistEdits(
                    normalizeEdits(
                      {
                        ...edits,
                        captions: { ...edits.captions, enabled: true, presetId: c },
                      },
                      bounds,
                    ),
                  )
                }
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="t62-play"
              className="rounded bg-primary px-3 py-1 text-primary-foreground"
              onClick={() => {
                const v = primaryRef.current
                if (v) {
                  v.muted = true
                  void v.play()
                  setPlaying(true)
                }
              }}
            >
              Play
            </button>
            <button
              type="button"
              data-testid="t62-seek-5"
              className="rounded border px-3 py-1"
              onClick={() => {
                const v = primaryRef.current
                if (v) v.currentTime = 5
              }}
            >
              Seek 5s
            </button>
          </div>
          <p data-testid="t62-timecode">{timeSec.toFixed(2)}s</p>
          <button
            type="button"
            data-testid="t62-reload-check"
            onClick={() => {
              const saved = localStorage.getItem('t62-edits')
              if (saved) setPersist(normalizeEdits(JSON.parse(saved), bounds))
            }}
          >
            Reload from storage
          </button>
          {persist ? (
            <pre className="max-h-40 overflow-auto text-xs" data-testid="t62-persist-dump">
              {JSON.stringify({ presetId: persist.captions?.presetId, template: persist.layout?.template?.id })}
            </pre>
          ) : null}
        </div>
        <div className="relative aspect-[9/16] w-[320px] shrink-0 bg-black" data-testid="t62-preview-wrap">
          <TemplateStage
            spec={spec}
            videoUrl="/clips/t62/A11.mp4"
            posterUrl={null}
            primaryVideoRef={primaryRef}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          {t6Titles && edits.exportTemplate?.headlineBar?.enabled ? (
            <TemplateTitleOverlay
              spec={spec}
              text={String(edits.exportTemplate?.headlineBar?.text ?? 'T6 TITLE')}
              styleId={String((edits.exportTemplate?.headlineStyle as { t6Id?: string })?.t6Id ?? 'white_on_black')}
              boxWidth={320}
            />
          ) : null}
          {edits.captions?.enabled !== false ? (
            <CaptionOverlay
              words={words}
              currentTimeSec={timeSec}
              edits={edits}
              boxHeightPx={568}
              outputDurationSec={11}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
