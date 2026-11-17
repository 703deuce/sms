/** Pure helpers for the customer chat, independent of any model provider. */
export function isStatusQuestion(text: string): boolean {
  const s = text.trim().toLowerCase().replace(/[?!.]+/g, '')
  return /^(status|progress|what's the status|what is the status|how is (my|the) (video|edit) (doing|going)|is (my|the) (video|edit) (done|ready)|are you (still )?working on (it|my video|the video)|what are you working on)$/.test(s)
}
export function statusReply(status: string, phase: string, progress: number): string {
  if (status === 'complete') return 'Your latest video is ready. You can preview it and request revisions.'
  if (status === 'needs_input') return 'Production needs an answer from you before it can continue. Please check the most recent question in this conversation.'
  if (['failed','dispatch_failed','cancelled'].includes(status)) return 'The most recent production attempt stopped. Your previous completed version remains available if there is one.'
  return `Your video is being processed (${Math.max(0, Math.min(99, Math.round(progress)))}% reported; current stage: ${phase || 'preparing'}). I’ll update the progress here as it changes.`
}
export function publicAssistantText(value: unknown): string {
  if (typeof value !== 'string') return ''
  // Protect the UI against accidental internal traces, credentials and provider details.
  const text = value.trim().slice(0, 1200)
  return /\b(?:grok(?:bot)?|gemini|openai|webhook|api.?key|bearer token|stack trace)\b|\/workspace\/|\/tmp\//i.test(text)
    ? 'I’m working with the production system on your request.'
    : /\b(?:i have|i've|we have|we've)\s+(?:already\s+)?(?:updated|changed|rendered|applied|saved|completed|finished)\b/i.test(text)
      ? 'I can help with that request. The video status and confirmed changes will appear here.' : text
}
