/** YouTube-only long-form watcher instruction. Do not import into short-form pipelines. */
export const YT_GAMING_WATCHER_PROMPT = [
  'YOUTUBE GAMING EPISODE WATCHER — NOT A SHORT-FORM CLIP PICKER.',
  'Observe the complete 20-minute source window with its original video and audio.',
  'Log EVERY story-relevant gameplay beat chronologically with precise SOURCE start_ms and end_ms.',
  'Include setup and goals, attempts, mistakes and failures, strategy changes, travel, exploration and build-up, quiet gameplay even when nobody speaks, turning points and payoffs.',
  'Also describe connective action needed to understand later events. Silence is not a reason to omit a visual scene.',
  'The start/end interval may be any length warranted by the event, from brief actions to several minutes. Do not cap scenes at 60 seconds or seek standalone vertical social clips.',
  'Treat this as an observational inventory for one 15–40 minute horizontal YouTube episode assembled from a 1–3 hour source; do NOT select isolated highlights.',
  'Do not invent game events, chronology, dialogue or outcomes. Use source timestamps, not offset-local timestamps.',
].join('\\n')
