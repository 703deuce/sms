'use client'

import { Loader2, Mic2, Repeat, Scissors, Sparkles, Volume2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

export type AiToolAction =
  | 'edit_for_clarity'
  | 'studio_sound'
  | 'remove_fillers'
  | 'shorten_gaps'
  | 'find_retakes'
  | 'add_chapters'

const TOOLS: {
  id: AiToolAction
  label: string
  icon: typeof Wand2
  description: string
}[] = [
  { id: 'edit_for_clarity', label: 'Edit for clarity', icon: Wand2, description: 'LLM word-level rewrites' },
  { id: 'studio_sound', label: 'Studio Sound', icon: Mic2, description: 'Voice isolation + mix' },
  { id: 'remove_fillers', label: 'Remove filler words', icon: Scissors, description: 'Open filler review bar' },
  { id: 'shorten_gaps', label: 'Shorten word gaps', icon: Volume2, description: 'Gap targets in edit tools' },
  { id: 'find_retakes', label: 'Remove retakes', icon: Repeat, description: 'LLM scan for duplicate takes' },
  { id: 'add_chapters', label: 'Add chapters', icon: Sparkles, description: 'Markers from transcript topics' },
]

export function ScriptAiToolsPanel({
  compositionId,
  onAction,
  onChapters,
  busy,
}: {
  compositionId: string
  onAction: (action: AiToolAction) => void | Promise<void>
  onChapters: (chapters: { outMs: number; label: string }[]) => void
  busy?: boolean
}) {
  const runChapters = async () => {
    const { chapters } = await clipsFetch<{ chapters: { outMs: number; label: string }[] }>(
      `/api/clips/compositions/${compositionId}/chapters`,
      { method: 'POST', body: '{}' },
    )
    if (!chapters?.length) {
      toast.message('No chapters suggested')
      return
    }
    onChapters(chapters)
    toast.success(`Added ${chapters.length} chapter markers`)
  }

  return (
    <div className="flex flex-col gap-2 p-3" data-testid="script-ai-tools-panel">
      <p className="text-[13px] font-semibold">AI tools</p>
      <p className="text-xs text-muted-foreground">Clean up — each action uses a real backend job or LLM route.</p>
      <ul className="space-y-1">
        {TOOLS.map((tool) => (
          <li key={tool.id}>
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start gap-2 py-2 text-left"
              disabled={busy}
              data-testid={`script-ai-tool-${tool.id}`}
              onClick={() => {
                if (tool.id === 'add_chapters') {
                  void runChapters().catch((e) => toast.error(e instanceof Error ? e.message : 'Chapters failed'))
                  return
                }
                void onAction(tool.id)
              }}
            >
              <tool.icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-medium">{tool.label}</span>
                <span className="text-[10px] text-muted-foreground">{tool.description}</span>
              </span>
              {busy && tool.id === 'find_retakes' ? <Loader2 className="ml-auto size-3.5 animate-spin" /> : null}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
