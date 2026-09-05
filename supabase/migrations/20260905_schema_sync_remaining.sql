-- DropIndex
DROP INDEX "Message_workspaceId_status_createdAt_idx";

-- DropIndex
DROP INDEX "campaign_messages_workspaceId_status_idx";

-- DropIndex
DROP INDEX "fax_transmissions_workspace_created_idx";

-- DropIndex
DROP INDEX "idx_sr_call_recordings_workspace";

-- DropIndex
DROP INDEX "verify_bulk_jobs_workspace_idx";

-- DropIndex
DROP INDEX "verify_credit_ledger_workspace_idx";

-- DropIndex
DROP INDEX "verify_lookups_workspace_idx";

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "deliveredAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "failedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appointment_merchant_payments" ALTER COLUMN "paidAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "failedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "canceledAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appointment_recurring_series" ALTER COLUMN "endDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appointment_waitlist_entries" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appointment_workflow_executions" ALTER COLUMN "startedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "invalidatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appointment_workflow_step_executions" ALTER COLUMN "scheduledFor" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "executedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appointment_workflows" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "campaign_messages" ALTER COLUMN "deliveredAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "failedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_accounts" ALTER COLUMN "usagePeriodStart" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "usagePeriodEnd" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "metadataJson" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_activity_log" ALTER COLUMN "metadataJson" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_automation_rules" ALTER COLUMN "lastRunAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_blocked_senders" ALTER COLUMN "blockedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_comments" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_contacts" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_extraction_templates" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_intelligence" ALTER COLUMN "processedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_numbers" ALTER COLUMN "provisionedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "releasedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_transmissions" ALTER COLUMN "scheduledFor" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "sentAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deliveredAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "receivedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "failedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "folder" SET NOT NULL,
ALTER COLUMN "priority" SET NOT NULL,
ALTER COLUMN "tagsJson" SET NOT NULL,
ALTER COLUMN "metadataJson" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fax_webhook_events" ALTER COLUMN "processedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "merchant_payment_connections" ALTER COLUMN "tokenExpiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "connectedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "disconnectedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verify_bulk_job_rows" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verify_bulk_jobs" ALTER COLUMN "completedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verify_credit_ledger" ALTER COLUMN "metadataJson" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verify_credit_reservations" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verify_lookup_cache" ALTER COLUMN "provider" SET NOT NULL,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verify_lookups" ALTER COLUMN "provider" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "fax_transmissions_workspaceId_createdAt_idx" ON "fax_transmissions"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "verify_bulk_jobs_workspaceId_createdAt_idx" ON "verify_bulk_jobs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "verify_credit_ledger_workspaceId_createdAt_idx" ON "verify_credit_ledger"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "verify_lookups_workspaceId_createdAt_idx" ON "verify_lookups"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "appointment_ai_mutation_records" ADD CONSTRAINT "appointment_ai_mutation_records_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_workflows" ADD CONSTRAINT "appointment_workflows_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_workflow_executions" ADD CONSTRAINT "appointment_workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "appointment_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_workflow_executions" ADD CONSTRAINT "appointment_workflow_executions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_workflow_step_executions" ADD CONSTRAINT "appointment_workflow_step_executions_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "appointment_workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_recurring_series" ADD CONSTRAINT "appointment_recurring_series_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_payment_connections" ADD CONSTRAINT "merchant_payment_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_merchant_payments" ADD CONSTRAINT "appointment_merchant_payments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_accounts" ADD CONSTRAINT "fax_accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_numbers" ADD CONSTRAINT "fax_numbers_faxAccountId_fkey" FOREIGN KEY ("faxAccountId") REFERENCES "fax_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_transmissions" ADD CONSTRAINT "fax_transmissions_faxAccountId_fkey" FOREIGN KEY ("faxAccountId") REFERENCES "fax_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_transmissions" ADD CONSTRAINT "fax_transmissions_faxNumberId_fkey" FOREIGN KEY ("faxNumberId") REFERENCES "fax_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_intelligence" ADD CONSTRAINT "fax_intelligence_faxTransmissionId_fkey" FOREIGN KEY ("faxTransmissionId") REFERENCES "fax_transmissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_activity_log" ADD CONSTRAINT "fax_activity_log_faxTransmissionId_fkey" FOREIGN KEY ("faxTransmissionId") REFERENCES "fax_transmissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_comments" ADD CONSTRAINT "fax_comments_faxTransmissionId_fkey" FOREIGN KEY ("faxTransmissionId") REFERENCES "fax_transmissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verify_bulk_job_rows" ADD CONSTRAINT "verify_bulk_job_rows_bulkJobId_fkey" FOREIGN KEY ("bulkJobId") REFERENCES "verify_bulk_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "appointment_ai_mutation_records_ws_contact_created" RENAME TO "appointment_ai_mutation_records_workspaceId_contactId_creat_idx";

-- RenameIndex
ALTER INDEX "appointment_ai_mutation_records_ws_idem" RENAME TO "appointment_ai_mutation_records_workspaceId_idempotencyKey_key";

-- RenameIndex
ALTER INDEX "appointment_ai_mutation_records_ws_status_created" RENAME TO "appointment_ai_mutation_records_workspaceId_status_createdA_idx";

-- RenameIndex
ALTER INDEX "appointment_merchant_payments_appt_idx" RENAME TO "appointment_merchant_payments_appointmentId_idx";

-- RenameIndex
ALTER INDEX "appointment_merchant_payments_provider_payment_idx" RENAME TO "appointment_merchant_payments_providerPaymentId_idx";

-- RenameIndex
ALTER INDEX "appointment_merchant_payments_provider_session_idx" RENAME TO "appointment_merchant_payments_providerSessionId_idx";

-- RenameIndex
ALTER INDEX "appointment_merchant_payments_workspace_appt_idx" RENAME TO "appointment_merchant_payments_workspaceId_appointmentId_idx";

-- RenameIndex
ALTER INDEX "appointment_recurring_series_ws_idx" RENAME TO "appointment_recurring_series_workspaceId_idx";

-- RenameIndex
ALTER INDEX "appointment_waitlist_ws_status_idx" RENAME TO "appointment_waitlist_entries_workspaceId_status_idx";

-- RenameIndex
ALTER INDEX "appointment_workflow_executions_wf_status_idx" RENAME TO "appointment_workflow_executions_workflowId_status_idx";

-- RenameIndex
ALTER INDEX "appointment_workflow_executions_ws_appt_idx" RENAME TO "appointment_workflow_executions_workspaceId_appointmentId_idx";

-- RenameIndex
ALTER INDEX "appointment_workflow_step_exec_execution_idx" RENAME TO "appointment_workflow_step_executions_executionId_idx";

-- RenameIndex
ALTER INDEX "appointment_workflow_step_exec_schedule_idx" RENAME TO "appointment_workflow_step_executions_workspaceId_scheduledF_idx";

-- RenameIndex
ALTER INDEX "appointment_workflows_workspace_status_idx" RENAME TO "appointment_workflows_workspaceId_status_idx";

-- RenameIndex
ALTER INDEX "appointment_workflows_workspace_trigger_idx" RENAME TO "appointment_workflows_workspaceId_trigger_idx";

-- RenameIndex
ALTER INDEX "fax_activity_transmission_idx" RENAME TO "fax_activity_log_faxTransmissionId_createdAt_idx";

-- RenameIndex
ALTER INDEX "fax_blocked_senders_workspaceId_fax_e164_key" RENAME TO "fax_blocked_senders_workspaceId_faxE164_key";

-- RenameIndex
ALTER INDEX "fax_contacts_workspace_idx" RENAME TO "fax_contacts_workspaceId_idx";

-- RenameIndex
ALTER INDEX "fax_numbers_e164_idx" RENAME TO "fax_numbers_e164_key";

-- RenameIndex
ALTER INDEX "fax_numbers_workspace_idx" RENAME TO "fax_numbers_workspaceId_idx";

-- RenameIndex
ALTER INDEX "fax_transmissions_status_idx" RENAME TO "fax_transmissions_workspaceId_status_idx";

-- RenameIndex
ALTER INDEX "fax_transmissions_telnyx_idx" RENAME TO "fax_transmissions_telnyxFaxId_idx";

-- RenameIndex
ALTER INDEX "fax_webhook_events_telnyx_event_id_key" RENAME TO "fax_webhook_events_telnyxEventId_key";

-- RenameIndex
ALTER INDEX "merchant_payment_connections_merchant_idx" RENAME TO "merchant_payment_connections_merchantAccountId_idx";

-- RenameIndex
ALTER INDEX "merchant_payment_connections_workspace_idx" RENAME TO "merchant_payment_connections_workspaceId_idx";

-- RenameIndex
ALTER INDEX "verify_bulk_job_rows_job_idx" RENAME TO "verify_bulk_job_rows_bulkJobId_rowIndex_idx";

-- RenameIndex
ALTER INDEX "verify_credit_ledger_idempotency_key_key" RENAME TO "verify_credit_ledger_idempotencyKey_key";

-- RenameIndex
ALTER INDEX "verify_lookup_cache_normalized_e164_key" RENAME TO "verify_lookup_cache_normalizedE164_key";

-- RenameIndex
ALTER INDEX "verify_lookups_normalized_idx" RENAME TO "verify_lookups_normalizedE164_idx";

