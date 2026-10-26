-- Streamer webhook dedupe + live chat capture (align with clips worker S13)
CREATE TABLE IF NOT EXISTS "stream_webhook_events" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stream_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stream_webhook_events_receivedAt_idx" ON "stream_webhook_events"("receivedAt");

CREATE TABLE IF NOT EXISTS "stream_chat_buckets" (
    "channelId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "chatters" INTEGER NOT NULL DEFAULT 0,
    "hype" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "stream_chat_buckets_pkey" PRIMARY KEY ("channelId","bucketStart")
);
DO $$ BEGIN
  ALTER TABLE "stream_chat_buckets" ADD CONSTRAINT "stream_chat_buckets_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "stream_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "stream_chat_lines" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "user" TEXT NOT NULL,
    "color" TEXT,
    "text" TEXT NOT NULL,
    CONSTRAINT "stream_chat_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stream_chat_lines_channelId_at_idx" ON "stream_chat_lines"("channelId", "at");
DO $$ BEGIN
  ALTER TABLE "stream_chat_lines" ADD CONSTRAINT "stream_chat_lines_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "stream_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
