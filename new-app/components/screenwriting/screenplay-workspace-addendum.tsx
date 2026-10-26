'use client'

import { useEffect, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import { restorePolicyWithLiveCollaborators } from '@/lib/screenwriting/collab/restore-policy'
import { DEFAULT_AI_PRIVACY, type AiPrivacySettings } from '@/lib/screenwriting/ai/privacy'
import { thesaurusLookup } from '@/lib/screenwriting/writing/thesaurus'
import { storyTimeAxis } from '@/lib/screenwriting/structure/story-time'
import { computeWritingStats, goalProgress } from '@/lib/screenwriting/writing/stats'
import type { Macro } from '@/lib/screenwriting/editor/macros'
import type { EpisodeHeader } from '@/lib/screenwriting/tv/episode-header'
import { scenesFromPmJson } from '@/lib/screenwriting/structure/navigator'
import { linkBibleToCharacter } from '@/lib/screenwriting/bible/entries'
import { dedupeNames, suggestNameFix, type NameEntry } from '@/lib/screenwriting/names/database'
import { collabUndoStackLabel } from '@/lib/screenwriting/collab/undo-policy'

export type AddendumPanel =
  | 'bible'
  | 'sceneVersions'
  | 'chat'
  | 'branch'
  | 'stats'
  | 'macros'
  | 'names'
  | 'print'
  | 'thesaurus'
  | 'timeline'
  | 'privacy'

export function AddendumPanelBar({
  panel,
  setPanel,
}: {
  panel: AddendumPanel | null
  setPanel: (p: AddendumPanel | null) => void
}) {
  const tabs: AddendumPanel[] = ['bible', 'sceneVersions', 'chat', 'branch', 'stats', 'macros', 'names', 'print', 'thesaurus', 'timeline', 'privacy']
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((t) => (
        <Button key={t} size="sm" variant={panel === t ? 'default' : 'outline'} onClick={() => setPanel(panel === t ? null : t)}>
          {t}
        </Button>
      ))}
    </div>
  )
}

export function AddendumPanelBody({
  scriptId,
  panel,
  editorDoc,
  pageCount,
  meta,
  persistMeta,
  highlightCharacter,
  setHighlightCharacter,
  importWarnings,
  dualWarn,
  liveEditors,
  onSimulateEditors,
  onRestoreBlocked,
}: {
  scriptId: string
  panel: AddendumPanel | null
  editorDoc: JSONContent
  pageCount: number
  meta: Record<string, unknown>
  persistMeta: (m: Record<string, unknown>) => Promise<void>
  highlightCharacter: string
  setHighlightCharacter: (c: string) => void
  importWarnings: string[]
  dualWarn: string | null
  liveEditors: number
  onSimulateEditors?: (n: number) => void
  onRestoreBlocked: (msg: string) => void
}) {
  const [bible, setBible] = useState<unknown[]>([])
  const [sceneVers, setSceneVers] = useState<unknown[]>([])
  const [chat, setChat] = useState<unknown[]>([])
  const [chatBody, setChatBody] = useState('')
  const [thesWord, setThesWord] = useState('')
  const [printOpts, setPrintOpts] = useState({ watermark: false, sceneNumbers: true, character: '' })
  const [privacy, setPrivacy] = useState<AiPrivacySettings>((meta.aiPrivacy as AiPrivacySettings) || DEFAULT_AI_PRIVACY)
  const [macros, setMacros] = useState<Macro[]>((meta.macros as Macro[]) || [{ id: 'int', label: 'INT.', text: 'INT. ', hotkey: 'F1' }])
  const [episode, setEpisode] = useState<EpisodeHeader>((meta.episodeHeader as EpisodeHeader) || {})
  const [wordGoal, setWordGoal] = useState(Number(meta.wordGoal ?? 0))
  const [splitView, setSplitView] = useState(Boolean(meta.splitView))
  const [rtl, setRtl] = useState(Boolean(meta.rtl))
  const [branchDrafts, setBranchDrafts] = useState<{ id: string; label: string }[]>([])
  const [nameDb, setNameDb] = useState<NameEntry[]>((meta.nameDatabase as NameEntry[]) || [])

  const scenes = scenesFromPmJson(editorDoc)
  const stats = computeWritingStats(editorDoc, pageCount)

  useEffect(() => {
    if (!panel) return
    if (panel === 'bible') void fetch(`/api/sw/scripts/${scriptId}/bible`).then((r) => r.json()).then((j) => setBible(j.data ?? []))
    if (panel === 'sceneVersions') void fetch(`/api/sw/scripts/${scriptId}/scene-versions`).then((r) => r.json()).then((j) => setSceneVers(j.data ?? []))
    if (panel === 'chat') void fetch(`/api/sw/scripts/${scriptId}/chat`).then((r) => r.json()).then((j) => setChat(j.data ?? []))
    if (panel === 'branch') void fetch(`/api/sw/scripts/${scriptId}/branch-drafts`).then((r) => r.json()).then((j) => setBranchDrafts(j.data ?? []))
  }, [panel, scriptId])

  if (!panel) {
    return (
      <div className="text-xs text-muted-foreground">
        {dualWarn ? <p className="text-amber-600">{dualWarn}</p> : null}
        {importWarnings.map((w) => (
          <p key={w} className="text-amber-600">{w}</p>
        ))}
      </div>
    )
  }

  if (panel === 'privacy') {
    return (
      <div className="space-y-2 text-xs">
        <label className="flex gap-2"><input type="checkbox" checked={privacy.redactNames} onChange={(e) => {
          const next = { ...privacy, redactNames: e.target.checked }
          setPrivacy(next)
          void persistMeta({ ...meta, aiPrivacy: next })
        }} /> Redact character names in AI prompts</label>
        <label className="flex gap-2"><input type="checkbox" checked={!privacy.logPrompts} onChange={(e) => {
          const next = { ...privacy, logPrompts: !e.target.checked }
          setPrivacy(next)
          void persistMeta({ ...meta, aiPrivacy: next })
        }} /> Do not log prompts</label>
      </div>
    )
  }

  if (panel === 'stats') {
    return (
      <div className="space-y-2 text-xs">
        <p>Words: {stats.words} · Pages: {stats.pages} · Scenes: {stats.scenes}</p>
        <input className="w-full rounded border px-2 py-1" type="number" placeholder="Word goal" value={wordGoal || ''} onChange={(e) => {
          const g = Number(e.target.value)
          setWordGoal(g)
          void persistMeta({ ...meta, wordGoal: g })
        }} />
        <p>Goal: {goalProgress(stats.words, wordGoal)}%</p>
        <label className="flex gap-2"><input type="checkbox" checked={splitView} onChange={(e) => {
          setSplitView(e.target.checked)
          void persistMeta({ ...meta, splitView: e.target.checked })
        }} /> Split view</label>
        <label className="flex gap-2"><input type="checkbox" checked={rtl} onChange={(e) => {
          setRtl(e.target.checked)
          void persistMeta({ ...meta, rtl: e.target.checked })
        }} /> RTL</label>
        <label className="flex gap-2"><input type="checkbox" checked={liveEditors > 1} onChange={(e) => onSimulateEditors?.(e.target.checked ? 2 : 1)} /> Simulate live collaborators</label>
        <p className="text-muted-foreground">{collabUndoStackLabel(liveEditors > 1)}</p>
      </div>
    )
  }

  if (panel === 'thesaurus') {
    const syns = thesaurusLookup(thesWord)
    return (
      <div className="space-y-2 text-xs">
        <input className="w-full rounded border px-2 py-1" value={thesWord} onChange={(e) => setThesWord(e.target.value)} placeholder="Word" />
        <p>{syns.length ? syns.join(', ') : 'No offline matches'}</p>
      </div>
    )
  }

  if (panel === 'timeline') {
    const axis = storyTimeAxis(scenes)
    return (
      <ul className="space-y-1 text-xs">
        {axis.map((a) => (
          <li key={a.sceneId}>{a.storyTime ?? '—'} · {a.label}</li>
        ))}
      </ul>
    )
  }

  if (panel === 'print') {
    return (
      <div className="space-y-2 text-xs">
        <label className="flex gap-2"><input type="checkbox" checked={printOpts.watermark} onChange={(e) => setPrintOpts({ ...printOpts, watermark: e.target.checked })} /> Watermark PDF</label>
        <input className="w-full rounded border px-2 py-1" placeholder="Character sides" value={printOpts.character} onChange={(e) => setPrintOpts({ ...printOpts, character: e.target.value })} />
        <a className="underline" href={`/api/sw/scripts/${scriptId}/export?format=pdf&watermark=${printOpts.watermark ? '1' : '0'}`}>Export PDF</a>
        {printOpts.character ? (
          <a className="underline block" href={`/api/sw/scripts/${scriptId}/export?format=character-sides&character=${encodeURIComponent(printOpts.character)}`}>Character sides</a>
        ) : null}
        <button type="button" className="underline" onClick={() => window.print()}>Print preview</button>
        <div className="space-y-1">
          <input className="w-full rounded border px-2 py-1" placeholder="Show title" value={episode.showTitle ?? ''} onChange={(e) => {
            const next = { ...episode, showTitle: e.target.value }
            setEpisode(next)
            void persistMeta({ ...meta, episodeHeader: next })
          }} />
          <input className="w-full rounded border px-2 py-1" placeholder="Episode #" value={episode.episodeNo ?? ''} onChange={(e) => {
            const next = { ...episode, episodeNo: e.target.value }
            setEpisode(next)
            void persistMeta({ ...meta, episodeHeader: next })
          }} />
        </div>
      </div>
    )
  }

  if (panel === 'macros') {
    return (
      <div className="space-y-2 text-xs">
        {macros.map((m) => (
          <div key={m.id}>{m.hotkey}: {m.label} — {m.text}</div>
        ))}
        <Button size="sm" onClick={() => {
          const next = [...macros, { id: `m${macros.length}`, label: 'Snippet', text: '…' }]
          setMacros(next)
          void persistMeta({ ...meta, macros: next })
        }}>Add macro</Button>
      </div>
    )
  }

  if (panel === 'names') {
    const fix = highlightCharacter ? suggestNameFix(highlightCharacter, nameDb) : null
    return (
      <div className="space-y-2 text-xs">
        <input className="w-full rounded border px-2 py-1" placeholder="Highlight character dialogue" value={highlightCharacter} onChange={(e) => setHighlightCharacter(e.target.value)} />
        {fix ? <p>Suggested: {fix}</p> : null}
        <Button size="sm" variant="outline" onClick={() => {
          if (!highlightCharacter) return
          const next = dedupeNames([...nameDb, { name: highlightCharacter }])
          setNameDb(next)
          void persistMeta({ ...meta, nameDatabase: next })
        }}>Save to name DB</Button>
        <ul>{nameDb.map((n) => <li key={n.name}>{n.name}</li>)}</ul>
      </div>
    )
  }

  if (panel === 'bible') {
    return (
      <div className="space-y-2 text-xs">
        <Button size="sm" onClick={() => void fetch(`/api/sw/scripts/${scriptId}/bible`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'character', name: 'New', body: '' }),
        }).then(() => fetch(`/api/sw/scripts/${scriptId}/bible`).then((r) => r.json()).then((j) => setBible(j.data ?? [])))}>Add entry</Button>
        <ul>{(bible as { id: string; name: string; body: string; linkedCharacter?: string }[]).map((b) => (
          <li key={b.id}>
            {b.name}: {b.body.slice(0, 40)}
            <button type="button" className="ml-1 underline" onClick={() => {
              const linked = linkBibleToCharacter({ id: b.id, kind: 'character', name: b.name, body: b.body, linkedCharacter: highlightCharacter || b.name }, highlightCharacter || b.name)
              void fetch(`/api/sw/scripts/${scriptId}/bible`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: linked.kind, name: linked.name, body: linked.body, linkedCharacter: linked.linkedCharacter }),
              })
            }}>Link char</button>
          </li>
        ))}</ul>
      </div>
    )
  }

  if (panel === 'sceneVersions') {
    const policy = restorePolicyWithLiveCollaborators(liveEditors, 'restore')
    return (
      <div className="space-y-2 text-xs">
        <p>{policy.message}</p>
        <Button size="sm" onClick={() => {
          if (policy.action === 'block') {
            onRestoreBlocked(policy.message)
            return
          }
          const scene = scenes[0]
          if (!scene) return
          void fetch(`/api/sw/scripts/${scriptId}/scene-versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sceneElementId: scene.id, label: 'Scene snap', pmJson: editorDoc }),
          }).then(() => fetch(`/api/sw/scripts/${scriptId}/scene-versions`).then((r) => r.json()).then((j) => setSceneVers(j.data ?? [])))
        }}>Snapshot first scene</Button>
        <ul>{(sceneVers as { id: string; label?: string }[]).map((v) => (
          <li key={v.id}>
            {v.label || v.id}
            <button type="button" className="ml-1 underline" onClick={() => {
              if (policy.action === 'block') {
                onRestoreBlocked(policy.message)
                return
              }
              void fetch(`/api/sw/scripts/${scriptId}/scene-versions`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ versionId: v.id, apply: true }),
              }).then(() => window.location.reload())
            }}>Restore</button>
          </li>
        ))}</ul>
      </div>
    )
  }

  if (panel === 'chat') {
    return (
      <div className="space-y-2 text-xs max-h-48 overflow-auto">
        {(chat as { authorName?: string; body: string }[]).map((m, i) => (
          <p key={i}><strong>{m.authorName}:</strong> {m.body}</p>
        ))}
        <input className="w-full rounded border px-2 py-1" value={chatBody} onChange={(e) => setChatBody(e.target.value)} />
        <Button size="sm" onClick={() => void fetch(`/api/sw/scripts/${scriptId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: chatBody }),
        }).then(() => {
          setChatBody('')
          return fetch(`/api/sw/scripts/${scriptId}/chat`).then((r) => r.json()).then((j) => setChat(j.data ?? []))
        })}>Send</Button>
      </div>
    )
  }

  if (panel === 'branch') {
    const latestId = branchDrafts[0]?.id
    return (
      <div className="space-y-2 text-xs">
        <Button size="sm" onClick={() => void fetch(`/api/sw/scripts/${scriptId}/branch-drafts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: `Branch ${Date.now()}` }),
        }).then(() => fetch(`/api/sw/scripts/${scriptId}/branch-drafts`).then((r) => r.json()).then((j) => setBranchDrafts(j.data ?? [])))}>Create branch draft</Button>
        <ul>{branchDrafts.map((d) => <li key={d.id}>{d.label}</li>)}</ul>
        <Button size="sm" variant="outline" disabled={!latestId} onClick={() => {
          if (!latestId) return
          void fetch(`/api/sw/scripts/${scriptId}/branch-drafts`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draftId: latestId }),
          }).then((r) => r.json()).then((j) => alert(JSON.stringify(j.data?.suggestions?.slice(0, 3))))
        }}>Preview merge</Button>
      </div>
    )
  }

  return null
}
