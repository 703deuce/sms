-- Additive: beat board, outline, revision UI state per script
ALTER TABLE "sw_scripts" ADD COLUMN IF NOT EXISTS "editorMeta" JSONB;
