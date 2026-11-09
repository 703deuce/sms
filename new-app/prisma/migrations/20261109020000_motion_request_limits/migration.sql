-- Durable, atomic per-workspace budgets for chargeable Motion AI actions.
CREATE TABLE "motion_request_limits" (
  "workspaceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "used" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "motion_request_limits_pkey" PRIMARY KEY ("workspaceId","kind","windowStart")
);
CREATE INDEX "motion_request_limits_windowStart_idx" ON "motion_request_limits"("windowStart");
