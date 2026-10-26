-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "workerKey" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "lastBeatAt" TIMESTAMP(3) NOT NULL,
    "metricsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("workerKey")
);

-- CreateIndex
CREATE INDEX "worker_heartbeats_lastBeatAt_idx" ON "worker_heartbeats"("lastBeatAt");
