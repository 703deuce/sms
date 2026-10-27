-- T2V draft: producer confirm payload + music-ready signal without revision bump
ALTER TABLE "t2v_drafts" ADD COLUMN IF NOT EXISTS "producerProposal" JSONB;
ALTER TABLE "t2v_drafts" ADD COLUMN IF NOT EXISTS "musicReadyGenerationId" TEXT;

-- One workspace hub project for orphan T2V jobs (voice clone, etc.)
CREATE UNIQUE INDEX IF NOT EXISTS "clip_projects_workspace_t2v_hub_title"
  ON "clip_projects" ("workspaceId", "title")
  WHERE "title" = '__t2v_workspace_jobs__' AND "deletedAt" IS NULL;
