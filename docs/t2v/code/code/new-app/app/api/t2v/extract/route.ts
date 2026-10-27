// POST {kind:'url', url} -> readable text (REUSE lib/server/clips/import-url fetch guard for SSRF rules; strip with
//   @mozilla/readability + jsdom). {kind:'ppt', uploadId} -> slide text via officeparser/ppt XML (one scene per slide).
// {kind:'audio', uploadId} -> REUSE transcribe (Deepgram) -> narration = transcript, voice = original audio.
export { POST } from '@/lib/server/t2v/routes/extract'
