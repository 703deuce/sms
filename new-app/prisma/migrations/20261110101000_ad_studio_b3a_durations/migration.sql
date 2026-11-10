-- Additive metadata. Provider generations may be longer than the planned scene.
ALTER TABLE "AdStudioScene"
  ADD COLUMN "generationDurationSec" INTEGER,
  ADD COLUMN "trimInMs" INTEGER,
  ADD COLUMN "trimOutMs" INTEGER;
