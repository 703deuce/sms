-- T6: optional base preset id for workspace caption user presets (additive).
ALTER TABLE "caption_presets" ADD COLUMN IF NOT EXISTS "basePresetId" TEXT;
