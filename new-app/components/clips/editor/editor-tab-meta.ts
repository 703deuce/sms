import type { EditorPanelId } from '@/components/clips/editor/editor-rail'

export const TAB_META: Record<
  EditorPanelId,
  { label: string; hint: string }
> = {
  producer: { label: 'AI Producer', hint: 'Edit by chatting' },
  transcript: { label: 'Script', hint: 'Edit video by editing text' },
  cleanup: { label: 'Cleanup', hint: 'Fillers, pauses, trim & cuts' },
  layout: { label: 'Layout', hint: 'Framing, layout & pauses' },
  layers: { label: 'Layers', hint: 'Headline, badge, stickers' },
  captions: { label: 'Captions', hint: 'Style & animation' },
  broll: { label: 'B-roll', hint: 'Stock & AI footage over your clip' },
  audio: { label: 'Audio', hint: 'Music, SFX & mix' },
  thumbnail: { label: 'Cover', hint: 'Pick the thumbnail frame' },
  dub: { label: 'Dub', hint: 'Translate & AI voice (uses credits)' },
  brand: { label: 'Brand', hint: 'Logo, colors & fonts from your kit' },
  text: { label: 'Text', hint: 'Titles & text layers on the Text lane' },
  templates: { label: 'Templates', hint: 'Layouts, caption & text styles, brand kits' },
  color: { label: 'Color', hint: 'Filters & adjustments' },
  media: { label: 'Media', hint: 'Your uploads, camera angles & multicam' },
  inspector: { label: 'Properties', hint: 'Position, size, crop, flip, order, keyframes of the selection' },
}
