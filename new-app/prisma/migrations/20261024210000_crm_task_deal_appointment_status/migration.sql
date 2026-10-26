-- AlterTable
ALTER TABLE "crm_tasks" ADD COLUMN IF NOT EXISTS "dealId" TEXT;

-- AlterTable
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'scheduled';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_tasks_dealId_idx" ON "crm_tasks"("dealId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "crm_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
