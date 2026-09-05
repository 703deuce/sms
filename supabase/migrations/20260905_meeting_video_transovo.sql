-- Transovo meeting intelligence + native video tables
-- CreateIndex
CREATE UNIQUE INDEX "meeting_sessions_workspaceId_idempotencyKey_key" ON "meeting_sessions"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "meeting_transcript_segments_meetingSessionId_sequence_idx" ON "meeting_transcript_segments"("meetingSessionId", "sequence");

-- CreateIndex
CREATE INDEX "verify_bulk_job_rows_bulkJobId_rowIndex_idx" ON "verify_bulk_job_rows"("bulkJobId", "rowIndex");

-- CreateIndex
CREATE INDEX "verify_bulk_jobs_workspaceId_createdAt_idx" ON "verify_bulk_jobs"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "verify_credit_ledger_idempotencyKey_key" ON "verify_credit_ledger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "verify_credit_ledger_workspaceId_createdAt_idx" ON "verify_credit_ledger"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "verify_lookup_cache_normalizedE164_key" ON "verify_lookup_cache"("normalizedE164");

-- CreateIndex
CREATE INDEX "verify_lookups_workspaceId_createdAt_idx" ON "verify_lookups"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "verify_lookups_normalizedE164_idx" ON "verify_lookups"("normalizedE164");

-- CreateIndex
CREATE INDEX "video_chat_messages_videoMeetingId_sentAt_idx" ON "video_chat_messages"("videoMeetingId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "video_meetings_publicMeetingToken_key" ON "video_meetings"("publicMeetingToken");

-- CreateIndex
CREATE INDEX "video_meetings_workspaceId_status_scheduledStartAt_idx" ON "video_meetings"("workspaceId", "status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "video_meetings_appointmentId_idx" ON "video_meetings"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "video_meetings_workspaceId_idempotencyKey_key" ON "video_meetings"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "video_participants_videoMeetingId_state_idx" ON "video_participants"("videoMeetingId", "state");

-- CreateIndex
CREATE INDEX "video_participants_workspaceId_idx" ON "video_participants"("workspaceId");

-- AddForeignKey

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

ALTER TABLE "fax_accounts" ADD CONSTRAINT "fax_accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_numbers" ADD CONSTRAINT "fax_numbers_faxAccountId_fkey" FOREIGN KEY ("faxAccountId") REFERENCES "fax_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_transmissions" ADD CONSTRAINT "fax_transmissions_faxAccountId_fkey" FOREIGN KEY ("faxAccountId") REFERENCES "fax_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_transmissions" ADD CONSTRAINT "fax_transmissions_faxNumberId_fkey" FOREIGN KEY ("faxNumberId") REFERENCES "fax_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_intelligence" ADD CONSTRAINT "fax_intelligence_faxTransmissionId_fkey" FOREIGN KEY ("faxTransmissionId") REFERENCES "fax_transmissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "meeting_recap_shares" (
    "id" TEXT NOT NULL,
    "meetingSessionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "includeSummary" BOOLEAN NOT NULL DEFAULT true,
    "includeActionItems" BOOLEAN NOT NULL DEFAULT true,
    "includeTranscript" BOOLEAN NOT NULL DEFAULT false,
    "includeRecording" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_recap_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_recap_shares_token_key" ON "meeting_recap_shares"("token");

-- CreateIndex
CREATE INDEX "meeting_recap_shares_workspaceId_idx" ON "meeting_recap_shares"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "fax_blocked_senders_workspaceId_faxE164_key" ON "fax_blocked_senders"("workspaceId", "faxE164");

-- CreateIndex
CREATE INDEX "fax_transmissions_workspaceId_createdAt_idx" ON "fax_transmissions"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "fax_transmissions_telnyxFaxId_idx" ON "fax_transmissions"("telnyxFaxId");

-- CreateIndex
CREATE UNIQUE INDEX "fax_webhook_events_telnyxEventId_key" ON "fax_webhook_events"("telnyxEventId");

-- CreateIndex
CREATE INDEX "meeting_action_items_meetingSessionId_idx" ON "meeting_action_items"("meetingSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_sessions_videoMeetingId_key" ON "meeting_sessions"("videoMeetingId");

-- CreateIndex
CREATE INDEX "meeting_sessions_workspaceId_status_scheduledStartAt_idx" ON "meeting_sessions"("workspaceId", "status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "meeting_sessions_appointmentId_idx" ON "meeting_sessions"("appointmentId");

-- CreateIndex
CREATE INDEX "meeting_sessions_contactId_idx" ON "meeting_sessions"("contactId");


-- AddForeignKey
ALTER TABLE "fax_activity_log" ADD CONSTRAINT "fax_activity_log_faxTransmissionId_fkey" FOREIGN KEY ("faxTransmissionId") REFERENCES "fax_transmissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fax_comments" ADD CONSTRAINT "fax_comments_faxTransmissionId_fkey" FOREIGN KEY ("faxTransmissionId") REFERENCES "fax_transmissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verify_bulk_job_rows" ADD CONSTRAINT "verify_bulk_job_rows_bulkJobId_fkey" FOREIGN KEY ("bulkJobId") REFERENCES "verify_bulk_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_videoMeetingId_fkey" FOREIGN KEY ("videoMeetingId") REFERENCES "video_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_meetings" ADD CONSTRAINT "video_meetings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_participants" ADD CONSTRAINT "video_participants_videoMeetingId_fkey" FOREIGN KEY ("videoMeetingId") REFERENCES "video_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_chat_messages" ADD CONSTRAINT "video_chat_messages_videoMeetingId_fkey" FOREIGN KEY ("videoMeetingId") REFERENCES "video_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_transcript_segments" ADD CONSTRAINT "meeting_transcript_segments_meetingSessionId_fkey" FOREIGN KEY ("meetingSessionId") REFERENCES "meeting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_action_items" ADD CONSTRAINT "meeting_action_items_meetingSessionId_fkey" FOREIGN KEY ("meetingSessionId") REFERENCES "meeting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recap_shares" ADD CONSTRAINT "meeting_recap_shares_meetingSessionId_fkey" FOREIGN KEY ("meetingSessionId") REFERENCES "meeting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER INDEX "fax_contacts_workspace_idx" RENAME TO "fax_contacts_workspaceId_idx";

-- RenameIndex
ALTER INDEX "fax_numbers_e164_idx" RENAME TO "fax_numbers_e164_key";

-- RenameIndex
ALTER INDEX "fax_numbers_workspace_idx" RENAME TO "fax_numbers_workspaceId_idx";

-- RenameIndex
ALTER INDEX "fax_transmissions_status_idx" RENAME TO "fax_transmissions_workspaceId_status_idx";

-- RenameIndex
ALTER INDEX "merchant_payment_connections_merchant_idx" RENAME TO "merchant_payment_connections_merchantAccountId_idx";

-- RenameIndex
ALTER INDEX "merchant_payment_connections_workspace_idx" RENAME TO "merchant_payment_connections_workspaceId_idx";
