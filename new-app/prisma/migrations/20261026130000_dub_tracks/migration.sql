CREATE TABLE "dub_tracks" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "targetLang" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'elevenlabs',
    "providerDubId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "audioKey" TEXT,
    "srtKey" TEXT,
    "words" JSONB,
    "costUsdMicros" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dub_tracks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dub_tracks_clipId_createdAt_idx" ON "dub_tracks"("clipId", "createdAt");

ALTER TABLE "dub_tracks" ADD CONSTRAINT "dub_tracks_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
