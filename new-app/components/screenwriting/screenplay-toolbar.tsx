'use client'

import { Button } from '@/components/ui/button'
import { CMD_ELEMENT_TYPES } from '@/lib/screenwriting/editor/shortcuts'

const LABELS: Record<string, string> = {
  sceneHeading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
}

export function ScreenplayToolbar({
  onElement,
  onImageUrl,
}: {
  scriptId?: string
  onElement: (type: string) => void
  onImageUrl?: (url: string) => void
}) {
  const hotkeyTypes = CMD_ELEMENT_TYPES.slice(0, 7)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-muted-foreground">
        Element
        <select
          className="ml-1 rounded border bg-background px-2 py-1 text-xs"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onElement(e.target.value)
            e.target.value = ''
          }}
        >
          <option value="">Insert…</option>
          {hotkeyTypes.map((t, i) => (
            <option key={t} value={t}>
              {LABELS[t] || t} (Ctrl+{i + 1})
            </option>
          ))}
        </select>
      </label>
      {hotkeyTypes.map((type, i) => (
        <Button key={type} size="sm" variant="outline" type="button" title={`Ctrl+${i + 1}`} onClick={() => onElement(type)}>
          {i + 1}
        </Button>
      ))}
      <input
        className="ml-2 max-w-[180px] rounded border px-2 py-1 text-xs"
        placeholder="Image URL"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onImageUrl?.((e.target as HTMLInputElement).value)
        }}
      />
    </div>
  )
}
