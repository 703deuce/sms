export const FDX_TYPE_MAP: Record<string, string> = {
  'Scene Heading': 'sceneHeading',
  Action: 'action',
  Character: 'character',
  Parenthetical: 'parenthetical',
  Dialogue: 'dialogue',
  Transition: 'transition',
  Shot: 'shot',
  General: 'general',
  Lyrics: 'lyrics',
  'Cast List': 'castList',
  'New Act': 'actBreak',
  'Centered Text': 'centered',
}

export interface FdxUnknownBag {
  raw?: Record<string, unknown>
}
