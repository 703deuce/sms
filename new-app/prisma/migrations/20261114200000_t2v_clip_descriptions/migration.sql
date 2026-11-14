-- T2V blind describe-then-score: one blind description per unique stock clip (provider + id + rendition),
-- reused across lines, rounds and reruns. Additive; public stock only (AI clips are never cached).
CREATE TABLE IF NOT EXISTS "t2v_clip_descriptions" (
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "rendition" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t2v_clip_descriptions_pkey" PRIMARY KEY ("provider", "providerId", "rendition")
);
