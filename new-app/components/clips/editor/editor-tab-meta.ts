import type { EditorPanelId } from '@/components/clips/editor/editor-rail'

export const TAB_META: Record<
  EditorPanelId,
  { label: string; hint: string }
> = {
  producer: { label: 'AI Producer', hint: 'Edit by chatting' },
  transcript: { label: 'Script', hint: 'Edit video by editing text' },
  layout: { label: 'Layout', hint: 'Framing & reframe' },
  captions: { label: 'Captions', hint: 'Style & animation' },
  broll: { label: 'B-roll', hint: 'Stock & AI footage' },
  audio: { label: 'Audio', hint: 'Music, SFX & mix' },
  thumbnail: { label: 'Cover', hint: 'Thumbnail' },
  dub: { label: 'Dub', hint: 'Translate & voice' },
  brand: { label: 'Brand', hint: 'Apply your kit' },
}
