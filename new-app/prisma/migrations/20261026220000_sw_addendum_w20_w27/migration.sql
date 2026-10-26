CREATE TABLE IF NOT EXISTS "sw_scene_versions" (
  "id" TEXT NOT NULL,
  "scriptId" TEXT NOT NULL,
  "sceneElementId" TEXT NOT NULL,
  "label" TEXT,
  "pmJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sw_scene_versions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sw_scene_versions_scriptId_sceneElementId_idx" ON "sw_scene_versions"("scriptId", "sceneElementId");
ALTER TABLE "sw_scene_versions" ADD CONSTRAINT "sw_scene_versions_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sw_story_bible_entries" (
  "id" TEXT NOT NULL,
  "scriptId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "linkedCharacter" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sw_story_bible_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sw_story_bible_entries_scriptId_kind_idx" ON "sw_story_bible_entries"("scriptId", "kind");
ALTER TABLE "sw_story_bible_entries" ADD CONSTRAINT "sw_story_bible_entries_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sw_branch_drafts" (
  "id" TEXT NOT NULL,
  "scriptId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "pmJson" JSONB NOT NULL,
  "mergedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sw_branch_drafts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sw_branch_drafts_scriptId_idx" ON "sw_branch_drafts"("scriptId");
ALTER TABLE "sw_branch_drafts" ADD CONSTRAINT "sw_branch_drafts_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sw_chat_messages" (
  "id" TEXT NOT NULL,
  "scriptId" TEXT NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sw_chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sw_chat_messages_scriptId_createdAt_idx" ON "sw_chat_messages"("scriptId", "createdAt");
ALTER TABLE "sw_chat_messages" ADD CONSTRAINT "sw_chat_messages_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
