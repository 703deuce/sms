-- Publish view events (one row per viewer session; atomic view count on publish row)

CREATE TABLE IF NOT EXISTS "script_composition_publish_views" (
    "id" TEXT NOT NULL,
    "publish_id" TEXT NOT NULL,
    "composition_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "viewer_session_key" TEXT NOT NULL,
    "viewer_user_id" TEXT,
    "viewer_label" TEXT,
    "first_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_composition_publish_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "script_composition_publish_views_publish_id_viewer_session_key_key"
    ON "script_composition_publish_views"("publish_id", "viewer_session_key");

CREATE INDEX IF NOT EXISTS "script_composition_publish_views_publish_id_last_viewed_at_idx"
    ON "script_composition_publish_views"("publish_id", "last_viewed_at" DESC);

CREATE INDEX IF NOT EXISTS "script_composition_publish_views_composition_id_idx"
    ON "script_composition_publish_views"("composition_id");
