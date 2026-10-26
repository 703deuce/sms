-- S3: monthly stream-hour metering per workspace
CREATE TABLE IF NOT EXISTS "stream_usage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "sourceSeconds" INTEGER NOT NULL DEFAULT 0,
    "vodCount" INTEGER NOT NULL DEFAULT 0,
    "modalGpuSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stream_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stream_usage_workspaceId_periodStart_key"
  ON "stream_usage"("workspaceId", "periodStart");
CREATE INDEX IF NOT EXISTS "stream_usage_workspaceId_periodStart_idx"
  ON "stream_usage"("workspaceId", "periodStart");

ALTER TABLE "stream_usage" DROP CONSTRAINT IF EXISTS "stream_usage_workspaceId_fkey";
ALTER TABLE "stream_usage" ADD CONSTRAINT "stream_usage_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
