/** Human label for worker `stage` strings on project status polls. */
export function formatClipProgressStage(stage: string | null | undefined): string | null {
  if (!stage) return null
  const reframe = stage.match(/^reframe_(\d+)_of_(\d+)$/i)
  if (reframe) {
    return `Reframing clip ${reframe[1]} of ${reframe[2]}`
  }
  const render = stage.match(/^render_(\d+)_of_(\d+)$/i)
  if (render) {
    return `Rendering clip ${render[1]} of ${render[2]}`
  }
  const streamRender = stage.match(/^Rendering\s+(\d+)\/(\d+)$/i)
  if (streamRender) {
    return `Rendering clip ${streamRender[1]} of ${streamRender[2]}`
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
