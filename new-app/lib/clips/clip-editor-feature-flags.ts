/** Compact clip editor: AI music/SFX generation and experimental layout tiles (default off). */
export function clipEditorAiExtrasEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLIP_EDITOR_AI_EXTRAS === '1'
}
