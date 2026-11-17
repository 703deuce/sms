ALTER TABLE "MotionStudioRenderRequest" ADD COLUMN "leaseHash" TEXT;
ALTER TABLE "MotionStudioRenderRequest" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "MotionStudioRenderRequest" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
