// POST: synthesize ONE scene now (preview + cache) via ttsWithTimestamps; returns signed URL + durationMs.
// Full re-assembly is separate (POST ../../assemble). Warn in UI when scene.fineEditedAt is set.
export { POST } from '@/lib/server/t2v/routes/scene-voice'
