-- SMS worker heartbeat table (also in prisma/schema.prisma WorkerHeartbeat model)
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  "workerKey" TEXT PRIMARY KEY,
  "workerId" TEXT NOT NULL,
  "lastBeatAt" TIMESTAMP(3) NOT NULL,
  "metricsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS worker_heartbeats_lastBeatAt_idx ON worker_heartbeats ("lastBeatAt");
