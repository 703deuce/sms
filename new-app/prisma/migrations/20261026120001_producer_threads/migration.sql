-- CreateTable
CREATE TABLE "producer_threads" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producer_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producer_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT,
    "toolCalls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producer_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "producer_threads_clipId_key" ON "producer_threads"("clipId");

-- CreateIndex
CREATE INDEX "producer_threads_workspaceId_idx" ON "producer_threads"("workspaceId");

-- CreateIndex
CREATE INDEX "producer_messages_threadId_createdAt_idx" ON "producer_messages"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "producer_messages" ADD CONSTRAINT "producer_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "producer_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
