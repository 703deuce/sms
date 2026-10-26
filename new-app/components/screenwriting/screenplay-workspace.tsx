'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
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
import { dualDialoguePaginationWarning } from '@/lib/screenwriting/layout/dual-dialogue-warn'
import { hashPmJson, mergeOfflineRecovery, reconcileSave } from '@/lib/screenwriting/persistence/save-reconcile'
import { exportPresetForFrozenVersion } from '@/lib/screenwriting/versions/export-presets'
import { useScriptLayout } from '@/components/screenwriting/use-script-layout'
import type { Macro } from '@/lib/screenwriting/editor/macros'
import { AddendumPanelBar, AddendumPanelBody, type AddendumPanel } from '@/components/screenwriting/screenplay-workspace-addendum'
import { restorePolicyWithLiveCollaborators } from '@/lib/screenwriting/collab/restore-policy'
import { ScreenplayToolbar } from '@/components/screenwriting/screenplay-toolbar'
import { DEFAULT_AI_PRIVACY, redactNamesForAi, type AiPrivacySettings } from '@/lib/screenwriting/ai/privacy'
import { normalizeScreenplayDoc } from '@/lib/screenwriting/schema/normalize-doc'
import { DEFAULT_SMARTTYPE, type SmartTypeLists } from '@/lib/screenwriting/smarttype/store'
import { segmentTableRead } from '@/lib/screenwriting/table-read/segment'
import { useScreenplayYjsCollab } from '@/components/screenwriting/use-screenplay-yjs-collab'
import { CollabStatusBanner } from '@/components/screenwriting/collab-status-banner'
import { PanelEmpty } from '@/components/screenwriting/panel-empty'
import { shouldRecoverLocalDraft, offlineDraftKeys } from '@/lib/screenwriting/persistence/offline-draft'
import { ImportDialog, type ImportMode } from '@/components/screenwriting/import-dialog'
import { BeatBoardPanel, type BeatBoardState } from '@/components/screenwriting/beat-board-panel'
import { SceneCardsPanel } from '@/components/screenwriting/scene-cards-panel'
import { VersionsPanel } from '@/components/screenwriting/versions-panel'
import { FdMenuBar } from '@/components/screenwriting/fd-menu-bar'
import { ScriptNotesColumn, ScriptNoteMarginMarkers, type ScriptNoteThread } from '@/components/screenwriting/script-notes-column'
import { RevisionsPanel } from '@/components/screenwriting/revisions-panel'
import { BreakdownPanel } from '@/components/screenwriting/breakdown-panel'
import type { BreakdownTag } from '@/lib/screenwriting/breakdown/types'
import { newElementId } from '@/lib/screenwriting/schema/empty-doc'
import { revisionSetById } from '@/lib/screenwriting/revisions/palette'
import { useScriptNoteMarkerPositions } from '@/components/screenwriting/use-script-note-markers'
import type { CommentHighlight } from '@/components/screenwriting/use-comment-inline-highlights'

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
  const normalizedInitial = useMemo(() => normalizeScreenplayDoc(initialDoc), [initialDoc])
  const [doc, setDoc] = useState<JSONContent>(normalizedInitial)
  const [editorDoc, setEditorDoc] = useState<JSONContent>(normalizedInitial)
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
  const [addendumPanel, setAddendumPanel] = useState<AddendumPanel | null>(null)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [highlightCharacter, setHighlightCharacter] = useState('')
  const [liveEditors, setLiveEditors] = useState(1)
  const [collabLive, setCollabLive] = useState(false)
  const [externalDocKey, setExternalDocKey] = useState(0)
  const [commentBody, setCommentBody] = useState('')
  const [commentElementId, setCommentElementId] = useState('')
  const { ydoc, collabExtensions, status: collabStatus } = useScreenplayYjsCollab(scriptId)

  useEffect(() => {
    setCollabLive(collabStatus.mode === 'live')
  }, [collabStatus.mode])
  const [insertElementType, setInsertElementType] = useState<string | null>(null)
  const [insertImageUrl, setInsertImageUrl] = useState<string | null>(null)
  const [saveReconcileNote, setSaveReconcileNote] = useState<string | null>(null)
  const [fdMode, setFdMode] = useState<'script' | 'cards' | 'beat'>('script')
  const [importPending, setImportPending] = useState<{ file: File; format: string } | null>(null)
  const [importReport, setImportReport] = useState<string[]>([])
  const [notesOpen, setNotesOpen] = useState(true)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const editorStageRef = useRef<HTMLDivElement | null>(null)

  const breakdownTags = (meta.breakdownTags as BreakdownTag[]) ?? []
  const pageLocks = (meta.pageLocks as number[]) ?? []
  const noteThreads = comments as ScriptNoteThread[]
  const commentHighlights: CommentHighlight[] = useMemo(
    () =>
      noteThreads.map((t) => ({
        threadId: t.id,
        elementId: t.elementId,
        anchorFrom: Number(t.anchorFrom) || 0,
        anchorTo: Number(t.anchorTo) || 0,
      })),
    [noteThreads],
  )

  useScriptNoteMarkerPositions(editorStageRef, noteThreads)

  const activeSpec = useMemo(() => getTemplateSpec(templateKey), [templateKey])
  const layout = useScriptLayout(editorDoc)
  const pageCount = layout?.pageCount ?? 0
  const dualWarn = useMemo(
    () => dualDialoguePaginationWarning(editorDoc, { spec: activeSpec, bodyLinesPerPage: activeSpec.page.bodyLines }),
    [editorDoc, activeSpec],
  )
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
    void (async () => {
      try {
        const res = await fetch(`/api/sw/scripts/${scriptId}`)
        if (!res.ok) return
        const j = await res.json()
        const serverDoc = j.data?.pmJson as JSONContent | undefined
        const serverAt = j.data?.updatedAt ? new Date(j.data.updatedAt).getTime() : 0
        const keys = offlineDraftKeys(scriptId)
        const localRaw = localStorage.getItem(keys.doc)
        const localAt = Number(localStorage.getItem(keys.updatedAt) || 0)
        const localDoc = localRaw ? (JSON.parse(localRaw) as JSONContent) : null
        const merged = mergeOfflineRecovery(localDoc, serverDoc ?? normalizedInitial)
        const recover = shouldRecoverLocalDraft({
          deviceUpdatedAt: localAt,
          serverUpdatedAt: serverAt,
          deviceHash: localDoc ? hashPmJson(localDoc) : hashPmJson(serverDoc ?? normalizedInitial),
          serverHash: hashPmJson(serverDoc ?? normalizedInitial),
        })
        if (recover && localDoc) {
          setDoc(merged)
          setEditorDoc(merged)
          setExternalDocKey((k) => k + 1)
          setSaveReconcileNote('Recovered unsynced local draft')
        }
      } catch {
        /* ignore */
      }
    })()
  }, [scriptId, normalizedInitial])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`sw:import-warn:${scriptId}`)
      if (raw) {
        setImportWarnings(JSON.parse(raw) as string[])
        sessionStorage.removeItem(`sw:import-warn:${scriptId}`)
      }
    } catch {
      /* ignore */
    }
  }, [scriptId])

  useEffect(() => {
    if (!insertElementType) return
    const t = setTimeout(() => setInsertElementType(null), 50)
    return () => clearTimeout(t)
  }, [insertElementType])

  useEffect(() => {
    if (!insertImageUrl) return
    const t = setTimeout(() => setInsertImageUrl(null), 50)
    return () => clearTimeout(t)
  }, [insertImageUrl])

  useEffect(() => {
    void fetch(`/api/sw/scripts/${scriptId}/comments`)
      .then((r) => r.json())
      .then((j) => setComments(j.data ?? []))
    void fetch(`/api/sw/scripts/${scriptId}/versions`)
      .then((r) => r.json())
      .then((j) => setVersions(j.data ?? []))
  }, [scriptId])

  const runImport = async (file: File, format: string, mode: ImportMode) => {
    const text = await file.text()
    const policy = restorePolicyWithLiveCollaborators(liveEditors, 'import')
    if (policy.action === 'block') {
      alert(policy.message)
      return
    }
    const res = await fetch(`/api/sw/scripts/${scriptId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, text, mode }),
    })
    if (!res.ok) throw new Error('Import failed')
    const j = await res.json()
    const msgs = (j.data?.warnings ?? []).map((w: { message: string }) => w.message)
    setImportReport(msgs)
    if (j.data?.scriptId && mode === 'new') {
      window.location.href = `/app/sw/scripts/${j.data.scriptId}`
      return
    }
    window.location.reload()
  }

  const queueImport = (file: File, format: string) => {
    setImportPending({ file, format })
  }

  const runFindReplace = () => {
    const next = applyFindReplace(editorDoc, {
      query: findQuery,
      replacement: findReplace,
      scope: 'all',
    })
    setDoc(next)
    setEditorDoc(next)
    setExternalDocKey((k) => k + 1)
  }

  useEffect(() => {
    if (collabLive) setLiveEditors((n) => Math.max(n, 2))
  }, [collabLive])

  const postComment = async () => {
    if (!commentBody.trim()) return
    let elementId = commentElementId.trim()
    let anchorFrom = '0'
    let anchorTo = '0'
    const ed = editorRef.current
    if (ed) {
      const { $from, from, to } = ed.state.selection
      if ($from.parent.type.name === 'screenplayElement') {
        elementId = ($from.parent.attrs.id as string) || elementId
        anchorFrom = String(Math.max(0, from - $from.start()))
        anchorTo = String(Math.max(0, to - $from.start()))
      }
    }
    if (!elementId) elementId = scenes[0]?.id || 'unknown'
    const res = await fetch(`/api/sw/scripts/${scriptId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elementId,
        anchorFrom,
        anchorTo,
        body: commentBody.trim(),
      }),
    })
    if (!res.ok) return
    const j = await res.json()
    setComments((prev) => [j.data, ...(prev as unknown[])])
    setCommentBody('')
  }

  const runAi = async () => {
    setAiLoading(true)
    setAiResult('')
    try {
      const privacy = (meta.aiPrivacy as AiPrivacySettings) || DEFAULT_AI_PRIVACY
      let excerpt = JSON.stringify(doc).slice(0, 50_000)
      if (privacy.redactNames) {
        excerpt = redactNamesForAi(excerpt, characters.map((c) => c.name))
      }
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
    const utterances = segmentTableRead(editorDoc, {})
    const text = utterances.map((u) => u.text).join(' ').trim() || scenes.map((s) => s.heading).join('. ')
    const speakBrowser = () => {
      const u = new SpeechSynthesisUtterance(text.slice(0, 4000))
      speechSynthesis.cancel()
      speechSynthesis.speak(u)
    }
    try {
      const res = await fetch(`/api/sw/scripts/${scriptId}/read-aloud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 4000) }),
      })
      if (!res.ok) {
        speakBrowser()
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onerror = () => speakBrowser()
      void audio.play()
    } catch {
      speakBrowser()
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

  const snapshotVersion = async (kind: 'MANUAL' | 'LOCK' = 'MANUAL') => {
    await fetch(`/api/sw/scripts/${scriptId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, label: kind === 'LOCK' ? 'Locked snapshot' : 'Manual snapshot' }),
    })
    const v = await fetch(`/api/sw/scripts/${scriptId}/versions`).then((r) => r.json())
    setVersions(v.data ?? [])
  }

  const addBreakdownTag = (payload: { elementId: string; from: number; to: number; text: string }) => {
    const categories = ['cast', 'props', 'wardrobe', 'vehicles', 'locations', 'sfx', 'music'] as const
    const category = categories[breakdownTags.length % categories.length]
    const tag: BreakdownTag = {
      id: newElementId(),
      elementId: payload.elementId,
      from: payload.from,
      to: payload.to,
      category,
      label: payload.text.slice(0, 80) || payload.elementId,
    }
    void persistMeta({ ...meta, breakdownTags: [...breakdownTags, tag] })
    setPanel('breakdown')
  }

  const markSelectionRevised = () => {
    const ed = editorRef.current
    if (!ed) return
    const { $from } = ed.state.selection
    if ($from.parent.type.name !== 'screenplayElement') return
    const pos = $from.before($from.depth)
    const node = $from.parent
    const setId = revisionSetById(revisionSet).id
    ed.view.dispatch(
      ed.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, revisedMark: setId }),
    )
  }

  const fdMenus = useMemo(
    () => ({
      File: [
        { label: 'Import…', action: () => document.querySelector<HTMLInputElement>('input[type=file].sw-import-input')?.click() },
        { label: 'Export Fountain', action: () => window.open(`/api/sw/scripts/${scriptId}/export?format=fountain`, '_blank') },
        { label: 'Export PDF', action: () => window.open(`/api/sw/scripts/${scriptId}/export?format=pdf`, '_blank') },
        { label: 'Export FDX', action: () => window.open(`/api/sw/scripts/${scriptId}/export?format=fdx`, '_blank') },
        { label: 'Share link', action: () => void createShareLink() },
      ],
      Edit: [
        { label: 'Find / Replace panel', action: () => setPanel('find') },
        { label: 'Replace all (current query)', action: () => runFindReplace() },
      ],
      View: [
        { label: 'Script mode', action: () => setFdMode('script') },
        { label: 'Cards mode', action: () => setFdMode('cards') },
        { label: 'Beat Board', action: () => { setFdMode('beat'); setPanel('beat') } },
        { label: 'Navigator', action: () => setPanel('navigator') },
        { label: 'Toggle ScriptNotes column', action: () => setNotesOpen((o) => !o) },
        { label: 'Night theme', action: () => { setTheme('night'); void persistMeta({ ...meta, theme: 'night' }) } },
        { label: 'Midnight theme', action: () => { setTheme('midnight'); void persistMeta({ ...meta, theme: 'midnight' }) } },
      ],
      Format: [
        { label: 'Title page', action: () => setPanel('title') },
        { label: 'Revisions', action: () => setPanel('revisions') },
      ],
      Tools: [
        { label: 'Breakdown report', action: () => setPanel('breakdown') },
        { label: 'Read aloud', action: () => void readAloud() },
        { label: 'AI assist', action: () => setPanel('ai') },
        { label: 'Snapshots', action: () => setPanel('versions') },
      ],
      Production: [
        { label: 'Breakdown tagging (Ctrl+Shift+B)', action: () => setPanel('breakdown') },
        { label: 'Character report', action: () => setPanel('reports') },
      ],
    }),
    [meta, scriptId, breakdownTags, revisionSet],
  )

  const themeClass = SW_THEME_CLASS[theme]
  const viewClass = viewModeClass(viewMode)
  const revPaper = revisionSetById(revisionSet).color

  return (
    <div className={`sw-fd-shell flex flex-col gap-2 ${themeClass} ${viewClass}`}>
      <AddendumPanelBar panel={addendumPanel} setPanel={setAddendumPanel} />
      <div className="sw-fd-toolbar">
      <ScreenplayToolbar
        scriptId={scriptId}
        onElement={(t) => {
          setInsertElementType(t)
          void persistMeta({ ...meta, lastElement: t })
        }}
        onImageUrl={(url) => setInsertImageUrl(url)}
      />
      </div>
      <CollabStatusBanner status={collabStatus} />
      <FdMenuBar menus={fdMenus} />
      <div className="flex gap-2 border-b px-2 py-1 text-xs">
        {(['script', 'cards', 'beat'] as const).map((m) => (
          <Button key={m} size="sm" variant={fdMode === m ? 'default' : 'outline'} onClick={() => setFdMode(m)}>
            {m === 'beat' ? 'Beat Board' : m === 'cards' ? 'Cards' : 'Script'}
          </Button>
        ))}
      </div>
      {importReport.length ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <strong>Import warnings</strong>
          <ul className="mt-1 list-disc pl-4">{importReport.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      ) : null}
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
            className="sw-import-input hidden"
            accept=".fountain,.fdx,.txt,.xml"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const fmt = f.name.endsWith('.fdx') ? 'fdx' : 'fountain'
              queueImport(f, fmt)
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

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[240px_minmax(0,1fr)_auto]">
        <aside className="sw-fd-navigator max-h-[70vh] overflow-auto rounded border p-2 text-xs">
          <AddendumPanelBody
            scriptId={scriptId}
            panel={addendumPanel}
            editorDoc={editorDoc}
            pageCount={pageCount}
            onSimulateEditors={setLiveEditors}
            meta={meta}
            persistMeta={persistMeta}
            highlightCharacter={highlightCharacter}
            setHighlightCharacter={setHighlightCharacter}
            importWarnings={importWarnings}
            dualWarn={dualWarn}
            liveEditors={liveEditors}
            onRestoreBlocked={(m) => alert(m)}
          />
          {panel === 'navigator' && (
            <ul className="space-y-1">
              {!scenes.length ? (
                <PanelEmpty title="No scenes yet" hint="Add a Scene Heading (INT./EXT.) in the editor." />
              ) : null}
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
              {(meta.outline as string[])?.length ? (
                (meta.outline as string[]).map((line, i) => <p key={i}>{line}</p>)
              ) : (
                <PanelEmpty title="Outline empty" hint="Add act/sequence lines in Beat board or import a script." />
              )}
            </div>
          )}
          {panel === 'cards' && (
            <SceneCardsPanel
              doc={editorDoc}
              onDocChange={(next) => {
                setDoc(next)
                setEditorDoc(next)
                setExternalDocKey((k) => k + 1)
              }}
            />
          )}
          {panel === 'beat' && (
            <BeatBoardPanel
              doc={editorDoc}
              board={meta.beatBoard as BeatBoardState | undefined}
              onChange={(b) => void persistMeta({ ...meta, beatBoard: b })}
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
          {panel === 'revisions' && (
            <RevisionsPanel
              revisionSet={revisionSet}
              onRevisionSet={(id) => {
                setRevisionSet(id)
                void persistMeta({ ...meta, revisionSet: id })
              }}
              pageLocks={pageLocks}
              onPageLocks={(pages) => void persistMeta({ ...meta, pageLocks: pages })}
              pageCount={pageCount}
              onMarkRevised={markSelectionRevised}
            />
          )}
          {panel === 'comments' && (
            <div className="space-y-2">
              <input
                className="w-full rounded border px-2 py-1"
                placeholder="Element id (optional)"
                value={commentElementId}
                onChange={(e) => setCommentElementId(e.target.value)}
              />
              <textarea
                className="w-full min-h-[80px] rounded border p-2"
                placeholder="New comment…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <Button size="sm" onClick={() => void postComment()}>Post comment</Button>
              {!comments.length ? <PanelEmpty title="No threads" hint="Post a note or select an element id from the navigator." /> : null}
              <ul className="space-y-2">
                {(comments as { id: string; elementId?: string; comments?: { body: string }[] }[]).map((t) => (
                  <li key={t.id} className="border-b pb-1">
                    <span className="text-[10px] text-muted-foreground">{t.elementId}</span>
                    <p>{t.comments?.[0]?.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {panel === 'versions' && (
            <div className="space-y-2">
              <Button size="sm" onClick={() => void snapshotVersion()}>Snapshot</Button>
              <VersionsPanel
                scriptId={scriptId}
                versions={versions as { id: string; label?: string; createdAt: string; kind?: string; pmJson?: JSONContent }[]}
                currentDoc={editorDoc}
                onRefresh={() => void fetch(`/api/sw/scripts/${scriptId}/versions`).then((r) => r.json()).then((j) => setVersions(j.data ?? []))}
                onRestore={(vid) => {
                  const policy = restorePolicyWithLiveCollaborators(liveEditors, 'restore')
                  if (policy.action === 'block') {
                    alert(policy.message)
                    return
                  }
                  void fetch(`/api/sw/versions/${vid}/restore`, { method: 'POST' }).then(() => window.location.reload())
                }}
              />
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
          {panel === 'breakdown' && (
            <BreakdownPanel
              tags={breakdownTags}
              onRemove={(id) => void persistMeta({ ...meta, breakdownTags: breakdownTags.filter((t) => t.id !== id) })}
            />
          )}
          {panel === 'reports' && (
            <div>
              {!characters.length ? <PanelEmpty title="No speaking characters" hint="Add CHARACTER / DIALOGUE pairs to populate reports." /> : null}
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

        <div
          className={`sw-fd-page rounded-lg border bg-card shadow-sm ${meta.splitView ? 'lg:col-span-1' : ''}`}
          style={{ background: fdMode === 'script' ? revPaper : undefined }}
        >
          <div className="flex justify-between border-b px-3 py-1 text-xs text-muted-foreground">
            <span>
              {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Error' : 'Saved'}
              {saveReconcileNote ? ` · ${saveReconcileNote}` : null}
              {collabLive ? ' · Live collab' : ' · Yjs undo (local)'}
            </span>
            {issues.length ? <span>{issues.length} script notes</span> : null}
          </div>
          <div className={meta.splitView ? 'grid grid-cols-2 gap-2' : ''}>
            {fdMode === 'cards' ? (
              <SceneCardsPanel
                doc={editorDoc}
                onDocChange={(next) => {
                  setDoc(next)
                  setEditorDoc(next)
                  setExternalDocKey((k) => k + 1)
                }}
              />
            ) : fdMode === 'beat' ? (
              <BeatBoardPanel
                doc={editorDoc}
                board={meta.beatBoard as BeatBoardState | undefined}
                onChange={(b) => void persistMeta({ ...meta, beatBoard: b })}
              />
            ) : null}
            {fdMode === 'script' ? (
            <div ref={editorStageRef} className="relative">
            <ScriptNoteMarginMarkers threads={noteThreads} onSelect={(id) => { setSelectedNoteId(id); setNotesOpen(true) }} />
            <ScreenplayEditor
              key={scriptId}
              scriptId={scriptId}
              formatSpec={activeSpec}
              initialDoc={doc}
              onSaveState={setSaveState}
              onDocChange={setEditorDoc}
              layoutDoc={editorDoc}
              revisionColor={revisionSet}
              collabLive={collabLive}
              onCollabLive={setCollabLive}
              collabExtensions={collabExtensions}
              ydoc={ydoc}
              externalDoc={editorDoc}
              externalDocKey={externalDocKey}
              highlightCharacter={highlightCharacter}
              rtl={Boolean(meta.rtl)}
              insertElementType={insertElementType}
              insertImageUrl={insertImageUrl}
              macros={(meta.macros as Macro[]) ?? []}
              smartTypeLists={(meta.smartType as SmartTypeLists) || DEFAULT_SMARTTYPE}
              onSmartTypeChange={(lists) => void persistMeta({ ...meta, smartType: lists })}
              commentHighlights={commentHighlights}
              activeCommentThreadId={selectedNoteId}
              onBreakdownTag={addBreakdownTag}
              onEditorReady={(ed) => { editorRef.current = ed }}
              pageLocked={false}
            />
            </div>
            ) : null}
            {meta.splitView && fdMode === 'script' ? (
              <aside className="sw-fd-navigator max-h-[70vh] overflow-auto border-l p-2 text-xs">
                <p className="mb-2 font-medium">Navigator (split)</p>
                <ul className="space-y-1">
                  {scenes.map((s, i) => (
                    <li key={s.id}>
                      <button type="button" className="text-left hover:underline" onClick={() => document.getElementById(`el-${s.id}`)?.scrollIntoView({ behavior: 'smooth' })}>
                        {i + 1}. {s.heading || '(scene)'}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </div>
          <ScriptStatusBar
            pmJson={editorDoc}
            saveState={saveState}
            collabLabel={collabStatus.mode === 'live' ? 'Live collab' : collabStatus.mode === 'connecting' ? 'Collab connecting' : 'Local editing'}
          />
        </div>
        <ScriptNotesColumn
          open={notesOpen}
          onToggle={() => setNotesOpen((o) => !o)}
          threads={noteThreads}
          selectedId={selectedNoteId}
          onSelect={setSelectedNoteId}
          onJumpToElement={(id) => document.getElementById(`el-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />
      </div>
      <ImportDialog
        open={Boolean(importPending)}
        filename={importPending?.file.name ?? ''}
        onClose={() => setImportPending(null)}
        onConfirm={(mode) => {
          if (importPending) void runImport(importPending.file, importPending.format, mode)
          setImportPending(null)
        }}
      />
    </div>
  )
}
