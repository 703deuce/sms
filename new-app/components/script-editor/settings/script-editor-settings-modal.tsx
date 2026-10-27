'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { clipsFetch } from '@/lib/clips-api'
import type { ScriptEditorUserPreferences } from '@/lib/server/clips/editor-preferences'
import { useTheme } from 'next-themes'

export function ScriptEditorSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setTheme } = useTheme()
  const [prefs, setPrefs] = useState<ScriptEditorUserPreferences | null>(null)
  const [page, setPage] = useState<'general' | 'account' | 'workspace'>('general')

  useEffect(() => {
    if (!open) return
    void clipsFetch<ScriptEditorUserPreferences>('/api/clips/editor-preferences')
      .then(setPrefs)
      .catch(() => toast.error('Could not load settings'))
  }, [open])

  const patch = async (patch: Partial<ScriptEditorUserPreferences>) => {
    if (!prefs) return
    const next = { ...prefs, ...patch }
    setPrefs(next)
    try {
      await clipsFetch('/api/clips/editor-preferences', { method: 'PATCH', body: JSON.stringify(patch) })
      if (patch.theme) setTheme(patch.theme)
    } catch {
      toast.error('Could not save setting')
      setPrefs(prefs)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal data-testid="script-editor-settings-modal">
      <div className="flex h-[min(720px,90vh)] w-full max-w-[800px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
        <nav className="w-[236px] shrink-0 border-r border-border bg-surface-raised p-2 text-[13px]">
          <p className="px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">General</p>
          <button
            type="button"
            className={`flex h-8 w-full items-center rounded-lg px-2 ${page === 'general' ? 'bg-accent font-medium' : 'hover:bg-accent/60'}`}
            onClick={() => setPage('general')}
          >
            General
          </button>
          <p className="mt-4 px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Account</p>
          <button
            type="button"
            className={`flex h-8 w-full items-center rounded-lg px-2 ${page === 'account' ? 'bg-accent font-medium' : 'hover:bg-accent/60'}`}
            onClick={() => setPage('account')}
          >
            Profile & theme
          </button>
          <p className="mt-4 px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Workspace</p>
          <button
            type="button"
            className={`flex h-8 w-full items-center rounded-lg px-2 ${page === 'workspace' ? 'bg-accent font-medium' : 'hover:bg-accent/60'}`}
            onClick={() => setPage('workspace')}
          >
            Members & billing
          </button>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
            <h2 className="text-lg font-semibold">
              {page === 'general' ? 'General' : page === 'account' ? 'Profile & theme' : 'Workspace'}
            </h2>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {!prefs && <p className="text-sm text-muted-foreground">Loading…</p>}
            {prefs && page === 'general' && (
              <div className="divide-y rounded-[10px] border border-border">
                {[
                  { key: 'automaticVolumeLevels' as const, label: 'Automatic volume levels' },
                  { key: 'showVolumeDb' as const, label: 'Show volume in decibels' },
                  { key: 'useRoomToneOnGaps' as const, label: 'Use room tone on gap clips' },
                  { key: 'applySmartTransitions' as const, label: 'Apply smart transitions to new scenes' },
                  { key: 'limitPreview1080' as const, label: 'Limit preview resolution to 1080p' },
                  { key: 'showWordlessMediaInScript' as const, label: 'Show wordless media in script' },
                ].map((row) => (
                  <div key={row.key} className="flex h-12 items-center justify-between px-4">
                    <Label htmlFor={row.key}>{row.label}</Label>
                    <Switch
                      id={row.key}
                      checked={Boolean(prefs[row.key])}
                      onCheckedChange={(v) => void patch({ [row.key]: v })}
                    />
                  </div>
                ))}
                <div className="flex h-12 items-center justify-between px-4">
                  <Label>Default caption style</Label>
                  <Select
                    value={prefs.defaultCaptionStyleId ?? 'bold_pop'}
                    onValueChange={(v) => v && void patch({ defaultCaptionStyleId: v })}
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bold_pop">Bold Pop</SelectItem>
                      <SelectItem value="clean_white">Clean White</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex h-12 items-center justify-between px-4">
                  <Label>Default clip aspect ratio</Label>
                  <Select
                    value={prefs.defaultClipAspect ?? '9:16'}
                    onValueChange={(v) => void patch({ defaultClipAspect: v as ScriptEditorUserPreferences['defaultClipAspect'] })}
                  >
                    <SelectTrigger className="h-8 w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9:16">9:16</SelectItem>
                      <SelectItem value="4:5">4:5</SelectItem>
                      <SelectItem value="16:9">16:9</SelectItem>
                      <SelectItem value="1:1">1:1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {prefs && page === 'account' && (
              <div className="space-y-4">
                <div>
                  <Label>Theme</Label>
                  <Select value={prefs.theme ?? 'dark'} onValueChange={(v) => v && void patch({ theme: v as ScriptEditorUserPreferences['theme'] })}>
                    <SelectTrigger className="mt-2 h-9 w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {page === 'workspace' && (
              <ul className="space-y-2 text-sm">
                <li>
                  <Link className="text-primary hover:underline" href="/settings/team">Members</Link>
                </li>
                <li>
                  <Link className="text-primary hover:underline" href="/app/clips/brand">Brand</Link>
                </li>
                <li>
                  <Link className="text-primary hover:underline" href="/settings/billing">Plan & credits</Link>
                </li>
                <li>
                  <Link className="text-primary hover:underline" href="/app/clips/exports">Usage & exports</Link>
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
