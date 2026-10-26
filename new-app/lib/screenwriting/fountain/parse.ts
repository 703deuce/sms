import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'

export type FountainBlock = { type: ScreenplayElementType; text: string }

const SCENE =
  /^(?:INT|EXT|EST|I\/E|INT\/EXT|EXT\/INT)[\s.]/i
const TRANSITION = /^>.+$/ 
const PAREN = /^\(.+\)$/

export function parseFountain(source: string): FountainBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: FountainBlock[] = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trimEnd()
    i++
    if (!line.trim()) continue
    if (line.startsWith('/*') || line.startsWith('<!--')) continue
    if (line.startsWith('Title:') || line.startsWith('Author:') || line.startsWith('Draft date:')) continue

    if (SCENE.test(line.trim())) {
      blocks.push({ type: 'sceneHeading', text: line.trim() })
      continue
    }
    if (TRANSITION.test(line.trim())) {
      blocks.push({ type: 'transition', text: line.trim().replace(/^>\s*/, '') })
      continue
    }
    if (PAREN.test(line.trim())) {
      blocks.push({ type: 'parenthetical', text: line.trim() })
      continue
    }
    const trimmed = line.trim()
    if (trimmed === trimmed.toUpperCase() && trimmed.length < 60 && !trimmed.includes('.')) {
      blocks.push({ type: 'character', text: trimmed })
      const dialogue: string[] = []
      while (i < lines.length) {
        const nxt = lines[i].trimEnd()
        if (!nxt.trim()) {
          i++
          break
        }
        if (SCENE.test(nxt.trim()) || (nxt.trim() === nxt.trim().toUpperCase() && !PAREN.test(nxt.trim()))) break
        if (PAREN.test(nxt.trim())) {
          blocks.push({ type: 'parenthetical', text: nxt.trim() })
          i++
          continue
        }
        dialogue.push(nxt.trim())
        i++
      }
      if (dialogue.length) blocks.push({ type: 'dialogue', text: dialogue.join('\n') })
      continue
    }
    blocks.push({ type: 'action', text: trimmed })
  }
  return blocks
}
