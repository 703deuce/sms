/** YouTube-only long-form watcher instruction. Do not import into short-form pipelines. */
export const YT_GAMING_WATCHER_PROMPT = [
  'YOUTUBE GAMING EPISODE WATCHER — NOT A SHORT-FORM CLIP PICKER.',
  'Observe the complete 20-minute source window with its original video and audio.',
  'Log EVERY story-relevant gameplay beat chronologically with precise local-window start_s and end_s; the worker maps those onto real source start_ms and end_ms.',
  'Include setup and goals, attempts, mistakes and failures, strategy changes, travel, exploration and build-up, quiet gameplay even when nobody speaks, turning points and payoffs.',
  'PRIMARY SIGNAL: VISUAL gameplay, action start/end and visible outcome. SECONDARY SIGNAL: speech, jokes, excitement, reactions and original audio. Report important funny lines/hype even over quiet visuals, but do not end an unresolved game sequence when audio changes.',
  'For each what_happened description, prefix SCENE_KEY=<stable short scene name>; ACTION_PHASE=<start|middle|resolved>; using the SAME key for the same continuous chase/mission/vehicle and DIFFERENT keys for different vehicles, pursuits or missions. These fields are descriptions, not invented metadata.',
  'Track the visual BEGINNING and visual RESOLUTION of every continuous mission, pursuit, fight, escape, heist, regroup and challenge; mark the source times of cause, action and outcome. Merge related small events into one observed scene.',
  'Also describe connective action needed to understand later events. Silence is not a reason to omit a visual scene.',
  'The start/end interval may be any length warranted by the event, from brief actions to several minutes. Do not cap scenes at 60 seconds or seek standalone vertical social clips.',
  'Treat this as an observational inventory for one 15–40 minute horizontal YouTube episode assembled from a 1–3 hour source; do NOT select isolated highlights.',
  'Do not invent game events, chronology, dialogue or outcomes. Use the labeled local frame timestamps; the worker maps them to original source time.',
].join('\n')
