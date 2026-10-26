'use client'

import { rankSuggestions, type SmartTypeLists } from '@/lib/screenwriting/smarttype/store'
import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'

export function suggestionsForElement(
  lists: SmartTypeLists,
  elementType: ScreenplayElementType,
  linePrefix: string,
): string[] {
  const q = linePrefix.trim()
  if (elementType === 'sceneHeading') {
    const intro = rankSuggestions(lists.intros, q)
    const loc = rankSuggestions(lists.locations, q)
    return [...intro, ...loc].slice(0, 8)
  }
  if (elementType === 'character') return rankSuggestions(lists.characters, q)
  if (elementType === 'transition') return rankSuggestions(lists.transitions, q)
  return []
}

export function SmartTypeMenu({
  items,
  onPick,
}: {
  items: string[]
  onPick: (value: string) => void
}) {
  if (!items.length) return null
  return (
    <div className="sw-smarttype-menu" role="listbox">
      {items.map((item) => (
        <button key={item} type="button" role="option" onMouseDown={(e) => {
          e.preventDefault()
          onPick(item)
        }}>
          {item}
        </button>
      ))}
    </div>
  )
}
