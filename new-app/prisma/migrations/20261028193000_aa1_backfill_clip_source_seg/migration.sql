-- AA1: backfill source segment key for one live-capture clip (object already uploaded).
UPDATE "clips" AS c
SET
  "sourceSegKey" = 'ws/' || p."workspaceId" || '/projects/' || c."projectId" || '/clips/' || c.id || '/source_seg.mp4',
  "sourceSegStartMs" = COALESCE(c."sourceSegStartMs", c."startMs"),
  "updatedAt" = NOW()
FROM "clip_projects" AS p
WHERE c."projectId" = p.id
  AND c.id = 'clip_c01db39748584f6eb09a749bfe0490e6'
  AND c."sourceSegKey" IS NULL;
