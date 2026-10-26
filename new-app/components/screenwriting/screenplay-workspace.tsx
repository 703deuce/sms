'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import type { FormatSpec } from '@/lib/screenwriting/formats/types'
import { ScreenplayEditor } from '@/components/screenwriting/screenplay-editor'
import { ScriptStatusBar } from '@/components/screenwriting/script-status-bar'
import { Button } from '@/components/ui/button'
import { applyFindReplace } from '@/lib/screenwriting/writing/find-replace'
import { checkScript } from '@/lib/screenwriting/writing/error-check'
import { scenesFromPmJson, navigatorToCsv } from '@/lib/screenwriting/structure/navigator'
import { reorderScenesInDoc } from '@/lib/screenwriting/structure/scene-reorder'
import { titlePageSchema, type TitlePage } from '@/lib/screenwriting/meta/title-page'
import { SW_THEME_CLASS, type SwTheme } from '@/lib/screenwriting/editor/themes'
import { viewModeClass, type EditorViewMode } from '@/lib/screenwriting/editor/view-modes'
import { getTemplateSpec } from '@/lib/screenwriting/formats/templates'
import { characterReport } from '@/lib/screenwriting/reports/characters'
import { genderAnalysisFromNames } from '@/lib/screenwriting/reports/gender-analysis'

type Panel =
  | 'navigator'
  | 'outline'
  | 'cards'
  | 'beat'
  | 'title'
  | 'find'
  | 'revisions'
  | 'comments'
  | 'versions'
  | 'ai'
  | 'breakdown'
  | 'reports'

export function ScreenplayWorkspace({
  scriptId,
  scriptTitle,
  formatSpec,
  initialDoc,
  initialMeta,
}: {
  scriptId: string
  scriptTitle: string
  formatSpec: FormatSpec
  initialDoc: JSONContent
  initialMeta?: Record<string, unknown> | null
}) {
  const [doc, setDoc] = useState<JSONContent>(initialDoc)
  const [editorDoc, setEditorDoc] = useState<JSONContent>(initialDoc)
  const [meta, setMeta] = useState<Record<string, unknown>>(initialMeta ?? {})
  const [panel, setPanel] = useState<Panel>('navigator')
  const [theme, setTheme] = useState<SwTheme>((meta.theme as SwTheme) || 'light')
  const [viewMode, setViewMode] = useState<EditorViewMode>((meta.viewMode as EditorViewMode) || 'page')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error' | 'offline'>('saved')
  const [findQuery, setFindQuery] = useState('')
  const [findReplace, setFindReplace] = useState('')
  const [aiKind, setAiKind] = useState('scene_feedback')
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [titlePage, setTitlePage] = useState<TitlePage>((meta.titlePage as TitlePage) || {})
  const [comments, setComments] = useState<unknown[]>([])
  const [versions, setVersions] = useState<unknown[]>([])
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [templateKey, setTemplateKey] = useState((meta.templateKey as string) || formatSpec.key)
  const [revisionSet, setRevisionSet] = useState((meta.revisionSet as string) || 'white')

  const activeSpec = useMemo(() => getTemplateSpec(templateKey), [templateKey])
  const scenes = useMemo(() => scenesFromPmJson(editorDoc), [editorDoc])
  const issues = useMemo(() => checkScript(editorDoc), [editorDoc])
  const characters = useMemo(() => characterReport(editorDoc), [editorDoc])

  const persistMeta = useCallback(
    async (next: Record<string, unknown>) => {
      setMeta(next)
      await fetch(`/api/sw/scripts/${scriptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editorMeta: next }),
      })
    },
    [scriptId],
  )

  useEffect(() => {
    try {
      localStorage.setItem(`sw:offline:${scriptId}`, JSON.stringify(editorDoc))
    } catch {
      /* quota */
    }
  }, [editorDoc, scriptId])

  useEffect(() => {
    void fetch(`/api/sw/scripts/${scriptId}/comments`)
      .then((r) => r.json())
      .then((j) => setComments(j.data ?? []))
    void fetch(`/api/sw/scripts/${scriptId}/versions`)
      .then((r) => r.json())
      .then((j) => setVersions(j.data ?? []))
  }, [scriptId])

  const importFile = async (file: File, format: string) => {
    const text = await file.text()
    const res = await fetch(`/api/sw/scripts/${scriptId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, text }),
    })
    if (!res.ok) throw new Error('Import failed')
    window.location.reload()
  }

  const runFindReplace = () => {
    const next = applyFindReplace(doc, {
      query: findQuery,
      replacement: findReplace,
      scope: 'all',
    })
    setDoc(next)
    setEditorDoc(next)
  }

  const runAi = async () => {
    setAiLoading(true)
    setAiResult('')
    try {
      const excerpt = JSON.stringify(doc).slice(0, 50_000)
      const res = await fetch(`/api/sw/scripts/${scriptId}/ai/${aiKind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: { words: excerpt.length }, confirm: true, inputText: excerpt }),
      })
      const j = await res.json()
      setAiResult(j.data?.text || j.data?.output?.text || JSON.stringify(j.data))
    } finally {
      setAiLoading(false)
    }
  }

  const readAloud = async () => {
    const utter = scenes.map((s) => s.heading).join('. ')
    if (process.env.NEXT_PUBLIC_SW_ELEVENLABS !== '1') {
      const u = new SpeechSynthesisUtterance(utter.slice(0, 2000))
      speechSynthesis.speak(u)
      return
    }
    const res = await fetch(`/api/sw/scripts/${scriptId}/read-aloud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: utter.slice(0, 4000) }),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      new Audio(url).play()
    }
  }

  const createShareLink = async () => {
    const res = await fetch(`/api/sw/scripts/${scriptId}/share-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'COMMENTER' }),
    })
    const j = await res.json()
    if (j.data?.token) setShareUrl(`${window.location.origin}/s/${j.data.token}`)
  }

  const snapshotVersion = async () => {
    await fetch(`/api/sw/scripts/${scriptId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'MANUAL', label: 'Manual snapshot' }),
    })
    const v = await fetch(`/api/sw/scripts/${scriptId}/versions`).then((r) => r.json())
    setVersions(v.data ?? [])
  }

  const themeClass = SW_THEME_CLASS[theme]
  const viewClass = viewModeClass(viewMode)

  return (
    <div className={`flex flex-col gap-2 ${themeClass} ${viewClass}`}>
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        <span className="text-sm font-medium">{scriptTitle}</span>
        <select
          className="rounded border px-2 py-1 text-xs"
          value={templateKey}
          onChange={(e) => {
            setTemplateKey(e.target.value)
            void persistMeta({ ...meta, templateKey: e.target.value })
          }}
        >
          <option value="feature">Feature</option>
          <option value="tv-hour">TV Hour</option>
          <option value="multicam">Multi-cam</option>
        </select>
        <select className="rounded border px-2 py-1 text-xs" value={theme} onChange={(e) => {
          const t = e.target.value as SwTheme
          setTheme(t)
          void persistMeta({ ...meta, theme: t })
        }}>
          <option value="light">Light</option>
          <option value="night">Night</option>
          <option value="midnight">Midnight</option>
          <option value="typewriter">Typewriter</option>
        </select>
        <select className="rounded border px-2 py-1 text-xs" value={viewMode} onChange={(e) => {
          const v = e.target.value as EditorViewMode
          setViewMode(v)
          void persistMeta({ ...meta, viewMode: v })
        }}>
          <option value="page">Page</option>
          <option value="draft">Draft</option>
          <option value="focus">Focus</option>
          <option value="typewriter">Typewriter</option>
        </select>
        <select className="rounded border px-2 py-1 text-xs" value={revisionSet} onChange={(e) => {
          setRevisionSet(e.target.value)
          void persistMeta({ ...meta, revisionSet: e.target.value })
        }}>
          <option value="white">Rev White</option>
          <option value="blue">Rev Blue</option>
          <option value="pink">Rev Pink</option>
        </select>
        {(['navigator', 'outline', 'cards', 'beat', 'title', 'find', 'revisions', 'comments', 'versions', 'ai', 'breakdown', 'reports'] as Panel[]).map((p) => (
          <Button key={p} size="sm" variant={panel === p ? 'default' : 'outline'} onClick={() => setPanel(p)}>
            {p}
          </Button>
        ))}
        <label className="cursor-pointer text-xs underline">
          Import
          <input
            type="file"
            className="hidden"
            accept=".fountain,.fdx,.txt,.xml"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const fmt = f.name.endsWith('.fdx') ? 'fdx' : 'fountain'
              void importFile(f, fmt)
            }}
          />
        </label>
        {(['fountain', 'fdx', 'pdf', 'txt', 'docx', 'highland'] as const).map((fmt) => (
          <a key={fmt} className="text-xs underline" href={`/api/sw/scripts/${scriptId}/export?format=${fmt}`}>
            {fmt}
          </a>
        ))}
        <Button size="sm" variant="outline" onClick={() => void readAloud()}>Read aloud</Button>
        <Button size="sm" variant="outline" onClick={() => void createShareLink()}>Share</Button>
        {shareUrl ? <span className="text-xs text-muted-foreground truncate max-w-[200px]">{shareUrl}</span> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="max-h-[70vh] overflow-auto rounded border p-2 text-xs">
          {panel === 'navigator' && (
            <ul className="space-y-1">
              {scenes.map((s, i) => (
                <li key={s.id} className="flex gap-1">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => document.getElementById(`el-${s.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    {s.heading || '(scene)'}
                  </button>
                </li>
              ))}
              <Button size="sm" className="mt-2" variant="outline" onClick={() => {
                const csv = navigatorToCsv(scenes)
                const blob = new Blob([csv], { type: 'text/csv' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = 'scenes.csv'
                a.click()
              }}>
                Export CSV
              </Button>
            </ul>
          )}
          {panel === 'outline' && (
            <div>
              {(meta.outline as string[])?.map((line, i) => (
                <p key={i}>{line}</p>
              )) ?? <p className="text-muted-foreground">Acts / sequences (edit in Beat board)</p>}
            </div>
          )}
          {panel === 'cards' && (
            <ul className="space-y-2">
              {scenes.map((s, i) => (
                <li key={s.id} className="rounded border p-2">
                  <strong>{s.heading}</strong>
                  <p>{s.synopsis || '—'}</p>
                  <div className="mt-1 flex gap-1">
                    <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => {
                      const next = reorderScenesInDoc(editorDoc, i, i - 1)
                      setDoc(next)
                      setEditorDoc(next)
                    }}>↑</Button>
                    <Button size="sm" variant="ghost" disabled={i >= scenes.length - 1} onClick={() => {
                      const next = reorderScenesInDoc(editorDoc, i, i + 1)
                      setDoc(next)
                      setEditorDoc(next)
                    }}>↓</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {panel === 'beat' && (
            <textarea
              className="w-full min-h-[200px] rounded border p-2"
              value={(meta.beatBoard as string) || ''}
              onChange={(e) => void persistMeta({ ...meta, beatBoard: e.target.value })}
              placeholder="Beat board notes…"
            />
          )}
          {panel === 'title' && (
            <div className="space-y-2">
              {(['title', 'credit', 'authors', 'draftDate', 'contact'] as const).map((k) => (
                <input
                  key={k}
                  className="w-full rounded border px-2 py-1"
                  placeholder={k}
                  value={(titlePage[k] as string) || ''}
                  onChange={(e) => {
                    const next = titlePageSchema.parse({ ...titlePage, [k]: e.target.value })
                    setTitlePage(next)
                    void persistMeta({ ...meta, titlePage: next })
                  }}
                />
              ))}
            </div>
          )}
          {panel === 'find' && (
            <div className="space-y-2">
              <input className="w-full rounded border px-2 py-1" placeholder="Find" value={findQuery} onChange={(e) => setFindQuery(e.target.value)} />
              <input className="w-full rounded border px-2 py-1" placeholder="Replace" value={findReplace} onChange={(e) => setFindReplace(e.target.value)} />
              <Button size="sm" onClick={runFindReplace}>Replace all</Button>
            </div>
          )}
          {panel === 'revisions' && <p>Revision set: <strong>{revisionSet}</strong>. Use toolbar color; page locks in layout engine.</p>}
          {panel === 'comments' && (
            <ul className="space-y-2">
              {(comments as { id: string; comments?: { body: string }[] }[]).map((t) => (
                <li key={t.id} className="border-b pb-1">{t.comments?.[0]?.body}</li>
              ))}
            </ul>
          )}
          {panel === 'versions' && (
            <div className="space-y-2">
              <Button size="sm" onClick={() => void snapshotVersion()}>Snapshot</Button>
              <ul>
                {(versions as { id: string; label?: string; createdAt: string }[]).map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void fetch(`/api/sw/versions/${v.id}/restore`, { method: 'POST' }).then(() => window.location.reload())}
                    >
                      Restore {v.label || v.id.slice(0, 8)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {panel === 'ai' && (
            <div className="space-y-2">
              <select className="w-full rounded border" value={aiKind} onChange={(e) => setAiKind(e.target.value)}>
                <option value="scene_feedback">Scene feedback</option>
                <option value="assist">Assist</option>
                <option value="coverage">Coverage</option>
                <option value="character_feedback">Character feedback</option>
              </select>
              <Button size="sm" disabled={aiLoading} onClick={() => void runAi()}>{aiLoading ? 'Running…' : 'Run'}</Button>
              <pre className="whitespace-pre-wrap text-[10px]">{aiResult}</pre>
            </div>
          )}
          {panel === 'breakdown' && <p>Select text in editor and tag via breakdown hotkey (coming in editor marks).</p>}
          {panel === 'reports' && (
            <div>
              <ul>
                {characters.map((c) => (
                  <li key={c.name}>{c.name}: {c.lines} lines, {c.words} words</li>
                ))}
              </ul>
              <p className="mt-2 font-medium">Gender (heuristic)</p>
              <ul>
                {genderAnalysisFromNames(characters.map((c) => c.name)).map((g) => (
                  <li key={g.label}>{g.label}: {g.count}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="rounded-lg border bg-card">
          <div className="flex justify-between border-b px-3 py-1 text-xs text-muted-foreground">
            <span>{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Error' : 'Saved'}</span>
            {issues.length ? <span>{issues.length} script notes</span> : null}
          </div>
          <ScreenplayEditor
            key={JSON.stringify(doc).length}
            scriptId={scriptId}
            formatSpec={activeSpec}
            initialDoc={doc}
            onSaveState={setSaveState}
            onDocChange={setEditorDoc}
            layoutDoc={editorDoc}
            revisionColor={revisionSet}
          />
          <ScriptStatusBar pmJson={editorDoc} />
        </div>
      </div>
    </div>
  )
}
