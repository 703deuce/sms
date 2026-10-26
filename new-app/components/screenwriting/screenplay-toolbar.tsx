'use client'

import { Button } from '@/components/ui/button'

const ELEMENTS = [
  ['sceneHeading', 'Scene'],
  ['action', 'Action'],
  ['character', 'Char'],
  ['dialogue', 'Dial'],
  ['parenthetical', 'Paren'],
  ['transition', 'Trans'],
] as const

export function ScreenplayToolbar({
  onElement,
  onImageUrl,
}: {
  scriptId: string
  onElement: (type: string) => void
  onImageUrl?: (url: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b pb-2">
      {ELEMENTS.map(([type, label]) => (
        <Button key={type} size="sm" variant="outline" type="button" onClick={() => onElement(type)}>
          {label}
        </Button>
      ))}
      <input
        className="ml-2 max-w-[180px] rounded border px-2 py-1 text-xs"
        placeholder="Image URL"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onImageUrl?.((e.target as HTMLInputElement).value)
        }}
      />
      <Button size="sm" variant="outline" type="button" onClick={() => {
        const el = document.querySelector<HTMLInputElement>('input[placeholder="Image URL"]')
        if (el?.value) onImageUrl?.(el.value)
      }}>
        Attach image
      </Button>
    </div>
  )
}
