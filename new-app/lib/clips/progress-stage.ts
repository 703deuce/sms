/** Human label for worker `stage` strings on project status polls. */
export function formatClipProgressStage(stage: string | null | undefined): string | null {
  if (!stage) return null
  const reframe = stage.match(/^reframe_(\d+)_of_(\d+)$/i)
  if (reframe) {
    const i = Number(reframe[1]), n = Number(reframe[2])
    return i >= 1 && n >= i ? `Reframing clip ${i} of ${n}` : 'Reframing clips'
  }
  const render = stage.match(/^render_(\d+)_of_(\d+)$/i)
  if (render) {
    const i = Number(render[1]), n = Number(render[2])
    return i >= 1 && n >= i ? `Rendering clip ${i} of ${n}` : 'Rendering clips'
  }
  const streamRender = stage.match(/^Rendering\s+(\d+)\/(\d+)$/i)
  if (streamRender) {
    const i = Number(streamRender[1]), n = Number(streamRender[2])
    return i >= 1 && n >= i ? `Rendering clip ${i} of ${n}` : 'Rendering clips'
  }
  const labels: Record<string, string> = {
    transcribing: 'Transcribing audio',
    finding_clips: 'Finding clip moments',
    picker_pass1: 'Ranking moments (pass 1)',
    picker_done: 'Finalizing clip picks',
    vision_rank: 'Vision ranking',
    scanning: 'Scanning scenes',
    preparing: 'Preparing video',
    importing: 'Importing from link',
    ready: 'Ready',
  }
  const key = stage.toLowerCase()
  return labels[key] ?? stage.replace(/_/g, ' ')
}
