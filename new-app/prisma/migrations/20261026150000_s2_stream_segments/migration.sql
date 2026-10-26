-- S2: padded source segments for long-VOD clip renders
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "sourceSegKey" TEXT;
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "sourceSegStartMs" INTEGER;
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "sourceSegEndMs" INTEGER;
