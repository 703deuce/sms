-- Align fax/verify tables from snake_case (20260825 migration) to Prisma camelCase columns.
-- Safe to re-run: each rename is guarded by information_schema checks.

DO $$
BEGIN
  -- fax_accounts
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='notify_email') THEN
    ALTER TABLE fax_accounts RENAME COLUMN notify_email TO "notifyEmail";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='notify_on_inbound') THEN
    ALTER TABLE fax_accounts RENAME COLUMN notify_on_inbound TO "notifyOnInbound";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='notify_on_failed_outbound') THEN
    ALTER TABLE fax_accounts RENAME COLUMN notify_on_failed_outbound TO "notifyOnFailedOutbound";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='auto_analyze_inbound') THEN
    ALTER TABLE fax_accounts RENAME COLUMN auto_analyze_inbound TO "autoAnalyzeInbound";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='auto_classify') THEN
    ALTER TABLE fax_accounts RENAME COLUMN auto_classify TO "autoClassify";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='auto_extract') THEN
    ALTER TABLE fax_accounts RENAME COLUMN auto_extract TO "autoExtract";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='auto_detect_priority') THEN
    ALTER TABLE fax_accounts RENAME COLUMN auto_detect_priority TO "autoDetectPriority";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='auto_detect_spam') THEN
    ALTER TABLE fax_accounts RENAME COLUMN auto_detect_spam TO "autoDetectSpam";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='pages_included') THEN
    ALTER TABLE fax_accounts RENAME COLUMN pages_included TO "pagesIncluded";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='pages_used_this_period') THEN
    ALTER TABLE fax_accounts RENAME COLUMN pages_used_this_period TO "pagesUsedThisPeriod";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='overage_pages') THEN
    ALTER TABLE fax_accounts RENAME COLUMN overage_pages TO "overagePages";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='usage_period_start') THEN
    ALTER TABLE fax_accounts RENAME COLUMN usage_period_start TO "usagePeriodStart";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='usage_period_end') THEN
    ALTER TABLE fax_accounts RENAME COLUMN usage_period_end TO "usagePeriodEnd";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE fax_accounts RENAME COLUMN stripe_subscription_id TO "stripeSubscriptionId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='number_status') THEN
    ALTER TABLE fax_accounts RENAME COLUMN number_status TO "numberStatus";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_accounts' AND column_name='metadata_json') THEN
    ALTER TABLE fax_accounts RENAME COLUMN metadata_json TO "metadataJson";
  END IF;

  -- fax_numbers
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_numbers' AND column_name='telnyx_number_id') THEN
    ALTER TABLE fax_numbers RENAME COLUMN telnyx_number_id TO "telnyxNumberId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_numbers' AND column_name='telnyx_connection_id') THEN
    ALTER TABLE fax_numbers RENAME COLUMN telnyx_connection_id TO "telnyxConnectionId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_numbers' AND column_name='provisioned_at') THEN
    ALTER TABLE fax_numbers RENAME COLUMN provisioned_at TO "provisionedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_numbers' AND column_name='released_at') THEN
    ALTER TABLE fax_numbers RENAME COLUMN released_at TO "releasedAt";
  END IF;

  -- fax_transmissions
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='from_e164') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN from_e164 TO "fromE164";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='to_e164') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN to_e164 TO "toE164";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='recipient_name') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN recipient_name TO "recipientName";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='page_count') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN page_count TO "pageCount";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='telnyx_fax_id') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN telnyx_fax_id TO "telnyxFaxId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='failure_reason') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN failure_reason TO "failureReason";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='failure_code') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN failure_code TO "failureCode";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='document_storage_bucket') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN document_storage_bucket TO "documentStorageBucket";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='document_storage_path') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN document_storage_path TO "documentStoragePath";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='document_mime_type') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN document_mime_type TO "documentMimeType";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='document_filename') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN document_filename TO "documentFilename";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='document_size_bytes') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN document_size_bytes TO "documentSizeBytes";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='scheduled_for') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN scheduled_for TO "scheduledFor";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='sent_at') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN sent_at TO "sentAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='delivered_at') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN delivered_at TO "deliveredAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='received_at') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN received_at TO "receivedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='failed_at') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN failed_at TO "failedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='parent_transmission_id') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN parent_transmission_id TO "parentTransmissionId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='is_spam') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN is_spam TO "isSpam";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='assigned_to_user_id') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN assigned_to_user_id TO "assignedToUserId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='tags_json') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN tags_json TO "tagsJson";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_transmissions' AND column_name='metadata_json') THEN
    ALTER TABLE fax_transmissions RENAME COLUMN metadata_json TO "metadataJson";
  END IF;

  -- fax_webhook_events
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_webhook_events' AND column_name='telnyx_event_id') THEN
    ALTER TABLE fax_webhook_events RENAME COLUMN telnyx_event_id TO "telnyxEventId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_webhook_events' AND column_name='event_type') THEN
    ALTER TABLE fax_webhook_events RENAME COLUMN event_type TO "eventType";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_webhook_events' AND column_name='telnyx_fax_id') THEN
    ALTER TABLE fax_webhook_events RENAME COLUMN telnyx_fax_id TO "telnyxFaxId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_webhook_events' AND column_name='payload_json') THEN
    ALTER TABLE fax_webhook_events RENAME COLUMN payload_json TO "payloadJson";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_webhook_events' AND column_name='processed_at') THEN
    ALTER TABLE fax_webhook_events RENAME COLUMN processed_at TO "processedAt";
  END IF;

  -- fax_intelligence
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='extracted_text') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN extracted_text TO "extractedText";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='extraction_method') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN extraction_method TO "extractionMethod";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='ocr_confidence') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN ocr_confidence TO "ocrConfidence";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='ai_summary') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN ai_summary TO "aiSummary";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='document_type') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN document_type TO "documentType";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='classification_confidence') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN classification_confidence TO "classificationConfidence";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='structured_data_json') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN structured_data_json TO "structuredDataJson";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='corrected_data_json') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN corrected_data_json TO "correctedDataJson";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='priority_reason') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN priority_reason TO "priorityReason";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='spam_score') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN spam_score TO "spamScore";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='spam_reason') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN spam_reason TO "spamReason";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='search_text') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN search_text TO "searchText";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='model_version') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN model_version TO "modelVersion";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='processed_at') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN processed_at TO "processedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_intelligence' AND column_name='error_message') THEN
    ALTER TABLE fax_intelligence RENAME COLUMN error_message TO "errorMessage";
  END IF;

  -- fax_extraction_templates
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_extraction_templates' AND column_name='document_category') THEN
    ALTER TABLE fax_extraction_templates RENAME COLUMN document_category TO "documentCategory";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_extraction_templates' AND column_name='fields_json') THEN
    ALTER TABLE fax_extraction_templates RENAME COLUMN fields_json TO "fieldsJson";
  END IF;

  -- fax_automation_rules
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_automation_rules' AND column_name='conditions_json') THEN
    ALTER TABLE fax_automation_rules RENAME COLUMN conditions_json TO "conditionsJson";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_automation_rules' AND column_name='actions_json') THEN
    ALTER TABLE fax_automation_rules RENAME COLUMN actions_json TO "actionsJson";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_automation_rules' AND column_name='last_run_at') THEN
    ALTER TABLE fax_automation_rules RENAME COLUMN last_run_at TO "lastRunAt";
  END IF;

  -- fax_contacts
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_contacts' AND column_name='fax_e164') THEN
    ALTER TABLE fax_contacts RENAME COLUMN fax_e164 TO "faxE164";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_contacts' AND column_name='phone_e164') THEN
    ALTER TABLE fax_contacts RENAME COLUMN phone_e164 TO "phoneE164";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_contacts' AND column_name='group_name') THEN
    ALTER TABLE fax_contacts RENAME COLUMN group_name TO "groupName";
  END IF;

  -- fax_blocked_senders
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_blocked_senders' AND column_name='fax_e164') THEN
    ALTER TABLE fax_blocked_senders RENAME COLUMN fax_e164 TO "faxE164";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_blocked_senders' AND column_name='blocked_at') THEN
    ALTER TABLE fax_blocked_senders RENAME COLUMN blocked_at TO "blockedAt";
  END IF;

  -- fax_activity_log
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_activity_log' AND column_name='event_type') THEN
    ALTER TABLE fax_activity_log RENAME COLUMN event_type TO "eventType";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_activity_log' AND column_name='metadata_json') THEN
    ALTER TABLE fax_activity_log RENAME COLUMN metadata_json TO "metadataJson";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_activity_log' AND column_name='actor_user_id') THEN
    ALTER TABLE fax_activity_log RENAME COLUMN actor_user_id TO "actorUserId";
  END IF;

  -- fax_comments
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fax_comments' AND column_name='author_user_id') THEN
    ALTER TABLE fax_comments RENAME COLUMN author_user_id TO "authorUserId";
  END IF;

  -- verify_credit_ledger
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_credit_ledger' AND column_name='entry_type') THEN
    ALTER TABLE verify_credit_ledger RENAME COLUMN entry_type TO "entryType";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_credit_ledger' AND column_name='balance_after') THEN
    ALTER TABLE verify_credit_ledger RENAME COLUMN balance_after TO "balanceAfter";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_credit_ledger' AND column_name='reference_type') THEN
    ALTER TABLE verify_credit_ledger RENAME COLUMN reference_type TO "referenceType";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_credit_ledger' AND column_name='reference_id') THEN
    ALTER TABLE verify_credit_ledger RENAME COLUMN reference_id TO "referenceId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_credit_ledger' AND column_name='stripe_session_id') THEN
    ALTER TABLE verify_credit_ledger RENAME COLUMN stripe_session_id TO "stripeSessionId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_credit_ledger' AND column_name='idempotency_key') THEN
    ALTER TABLE verify_credit_ledger RENAME COLUMN idempotency_key TO "idempotencyKey";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_credit_ledger' AND column_name='metadata_json') THEN
    ALTER TABLE verify_credit_ledger RENAME COLUMN metadata_json TO "metadataJson";
  END IF;

  -- verify_credit_reservations
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_credit_reservations' AND column_name='reserved_credits') THEN
    ALTER TABLE verify_credit_reservations RENAME COLUMN reserved_credits TO "reservedCredits";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_credit_reservations' AND column_name='consumed_credits') THEN
    ALTER TABLE verify_credit_reservations RENAME COLUMN consumed_credits TO "consumedCredits";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_credit_reservations' AND column_name='expires_at') THEN
    ALTER TABLE verify_credit_reservations RENAME COLUMN expires_at TO "expiresAt";
  END IF;

  -- verify_lookups
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookups' AND column_name='input_raw') THEN
    ALTER TABLE verify_lookups RENAME COLUMN input_raw TO "inputRaw";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookups' AND column_name='normalized_e164') THEN
    ALTER TABLE verify_lookups RENAME COLUMN normalized_e164 TO "normalizedE164";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookups' AND column_name='line_type') THEN
    ALTER TABLE verify_lookups RENAME COLUMN line_type TO "lineType";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookups' AND column_name='lookup_status') THEN
    ALTER TABLE verify_lookups RENAME COLUMN lookup_status TO "lookupStatus";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookups' AND column_name='provider_response_json') THEN
    ALTER TABLE verify_lookups RENAME COLUMN provider_response_json TO "providerResponseJson";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookups' AND column_name='credits_charged') THEN
    ALTER TABLE verify_lookups RENAME COLUMN credits_charged TO "creditsCharged";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookups' AND column_name='cache_hit') THEN
    ALTER TABLE verify_lookups RENAME COLUMN cache_hit TO "cacheHit";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookups' AND column_name='error_message') THEN
    ALTER TABLE verify_lookups RENAME COLUMN error_message TO "errorMessage";
  END IF;

  -- verify_lookup_cache
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookup_cache' AND column_name='normalized_e164') THEN
    ALTER TABLE verify_lookup_cache RENAME COLUMN normalized_e164 TO "normalizedE164";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookup_cache' AND column_name='line_type') THEN
    ALTER TABLE verify_lookup_cache RENAME COLUMN line_type TO "lineType";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookup_cache' AND column_name='provider_response_json') THEN
    ALTER TABLE verify_lookup_cache RENAME COLUMN provider_response_json TO "providerResponseJson";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_lookup_cache' AND column_name='expires_at') THEN
    ALTER TABLE verify_lookup_cache RENAME COLUMN expires_at TO "expiresAt";
  END IF;

  -- verify_bulk_jobs
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='phone_column') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN phone_column TO "phoneColumn";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='total_rows') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN total_rows TO "totalRows";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='unique_numbers') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN unique_numbers TO "uniqueNumbers";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='duplicate_rows') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN duplicate_rows TO "duplicateRows";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='processed_rows') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN processed_rows TO "processedRows";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='successful_lookups') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN successful_lookups TO "successfulLookups";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='failed_lookups') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN failed_lookups TO "failedLookups";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='credits_reserved') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN credits_reserved TO "creditsReserved";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='credits_consumed') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN credits_consumed TO "creditsConsumed";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='error_message') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN error_message TO "errorMessage";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_jobs' AND column_name='completed_at') THEN
    ALTER TABLE verify_bulk_jobs RENAME COLUMN completed_at TO "completedAt";
  END IF;

  -- verify_bulk_job_rows
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_job_rows' AND column_name='row_index') THEN
    ALTER TABLE verify_bulk_job_rows RENAME COLUMN row_index TO "rowIndex";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_job_rows' AND column_name='input_raw') THEN
    ALTER TABLE verify_bulk_job_rows RENAME COLUMN input_raw TO "inputRaw";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_job_rows' AND column_name='normalized_e164') THEN
    ALTER TABLE verify_bulk_job_rows RENAME COLUMN normalized_e164 TO "normalizedE164";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verify_bulk_job_rows' AND column_name='original_data_json') THEN
    ALTER TABLE verify_bulk_job_rows RENAME COLUMN original_data_json TO "originalDataJson";
  END IF;
END $$;
