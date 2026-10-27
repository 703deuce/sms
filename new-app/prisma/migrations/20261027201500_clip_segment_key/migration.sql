-- Stable segment identity per project (recovery / STREAM_ANALYZE retry idempotency).

ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "segmentKey" TEXT;

UPDATE "clips"
SET "segmentKey" = ("startMs"::text || ':' || "endMs"::text)
WHERE "segmentKey" IS NULL;

-- Soft-delete duplicate active rows; keep favorites, clips with events, then previews, then newest.
WITH ranked AS (
  SELECT
    c.id,
    ROW_NUMBER() OVER (
      PARTITION BY c."projectId", c."segmentKey"
      ORDER BY
        (CASE WHEN c.favorite THEN 0 ELSE 1 END),
        (CASE WHEN EXISTS (
          SELECT 1 FROM clip_events e WHERE e."clipId" = c.id LIMIT 1
        ) THEN 0 ELSE 1 END),
        (CASE WHEN c."previewKey" IS NOT NULL THEN 0 ELSE 1 END),
        c."updatedAt" DESC,
        c."createdAt" DESC
    ) AS rn
  FROM "clips" c
  WHERE c."deletedAt" IS NULL AND c."segmentKey" IS NOT NULL
)
UPDATE "clips" AS c
SET "deletedAt" = NOW(), "updatedAt" = NOW()
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "clips_project_segment_key_active_uidx"
  ON "clips" ("projectId", "segmentKey")
  WHERE "deletedAt" IS NULL AND "segmentKey" IS NOT NULL;
