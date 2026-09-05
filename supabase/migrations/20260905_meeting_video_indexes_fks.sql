-- Meeting/video indexes and foreign keys
CREATE INDEX "meeting_action_items_meetingSessionId_idx" ON "meeting_action_items"("meetingSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_sessions_videoMeetingId_key" ON "meeting_sessions"("videoMeetingId");

-- CreateIndex
CREATE INDEX "meeting_sessions_workspaceId_status_scheduledStartAt_idx" ON "meeting_sessions"("workspaceId", "status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "meeting_sessions_appointmentId_idx" ON "meeting_sessions"("appointmentId");

-- CreateIndex
CREATE INDEX "meeting_sessions_contactId_idx" ON "meeting_sessions"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_sessions_workspaceId_idempotencyKey_key" ON "meeting_sessions"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "meeting_transcript_segments_meetingSessionId_sequence_idx" ON "meeting_transcript_segments"("meetingSessionId", "sequence");
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
