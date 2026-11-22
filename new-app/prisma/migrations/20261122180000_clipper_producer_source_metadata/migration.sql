-- Nullable, additive source metadata. Existing uploads remain valid; unknown values stay null.
ALTER TABLE "clip_uploads" ADD COLUMN IF NOT EXISTS "fps" DOUBLE PRECISION;
ALTER TABLE "clip_uploads" ADD COLUMN IF NOT EXISTS "rotation" INTEGER;
ALTER TABLE "clip_uploads" ADD COLUMN IF NOT EXISTS "hasAudio" BOOLEAN;
