import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import type { CsvMapTarget } from "@/lib/reputation/bulk-csv";
import {
  validateBulkRecipients,
  type ValidatedRecipient,
} from "@/lib/reputation/bulk-validate";
import {
  buildMessageSchedule,
  estimateBusinessDays,
  ymdInTimeZone,
  type ScheduleConfig,
} from "@/lib/reputation/campaign-scheduler";
import { buildTrackingUrl, generateTrackingToken, hashIp } from "@/lib/reputation/tracking";
import {
  defaultReviewRequestSequence,
  initialSendSteps,
  normalizeSequenceSteps,
  resolveWaveChannels,
  sequenceStartsWithWait,
  validateSequenceForLaunch,
  waitDurationMs,
  type SequenceStep,
} from "@/lib/reputation/sequence-engine";
import { persistCampaignSteps } from "@/lib/reputation/sequence-runner";
import {
  buildCampaignTemplateVars,
  renderStepMessage,
} from "@/lib/reputation/campaign-message-copy";
import type { CampaignSuccessMode } from "@/lib/reputation/campaign-templates";
import {
  normalizeTriggerType,
  parseTriggerConfig,
  type CampaignTriggerConfig,
  type CampaignTriggerType,
  type EnrollmentSource,
} from "@/lib/reputation/campaign-triggers";
import { buildUnsubscribeUrl } from "@/lib/reputation/unsubscribe";

export type CampaignChannel = "sms" | "email" | "both";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed"
  | "archived";

export type CreateCampaignInput = {
  organizationId: string;
  businessId: string;
  name: string;
  channel: CampaignChannel;
  templateId?: string | null;
  /** Optional email template when channel is both (falls back to templateId / default). */
  emailTemplateId?: string | null;
  dailySendLimit: number;
  sendDays: number[];
  sendWindowStart: string;
  sendWindowEnd: string;
  timezone: string;
  duplicateProtectionDays: number;
  startDate: string;
  consentConfirmed: boolean;
  filename?: string;
  mapping: Record<string, CsvMapTarget>;
  recipients: ValidatedRecipient[];
  status: "draft" | "scheduled" | "active";
  /** Custom drip sequence; defaults to channel-aware review request sequence. */
  sequence?: SequenceStep[];
  description?: string | null;
  objective?: "request_review" | "reactivation" | "referral_request" | "service_reminder" | "promotional_offer";
  successMode?: CampaignSuccessMode;
  sourceTemplateId?: string | null;
  sourceTemplateVersion?: string | null;
  /** How customers primarily enter this campaign. */
  triggerType?: CampaignTriggerType;
  triggerConfig?: CampaignTriggerConfig;
  webhookEndpointId?: string | null;
  /** Enrollment source stamped on recipients created in this launch. */
  enrollmentSource?: EnrollmentSource;
};

function displayName(r: ValidatedRecipient): string {
  if (r.first_name?.trim()) return r.first_name.trim();
  if (r.full_name?.trim()) return r.full_name.trim();
  if (r.first_name || r.last_name) return [r.first_name, r.last_name].filter(Boolean).join(" ");
  return "there";
}

function channelsForRecipient(
  channel: CampaignChannel,
  r: ValidatedRecipient
): Array<"sms" | "email"> {
  const out: Array<"sms" | "email"> = [];
  if ((channel === "sms" || channel === "both") && r.phone) out.push("sms");
  if ((channel === "email" || channel === "both") && r.email) out.push("email");
  if (channel === "sms" && !r.phone && r.email) return [];
  if (channel === "email" && !r.email && r.phone) return [];
  return out;
}

async function loadGoogleReviewUrl(businessId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("review_request_links")
    .select("review_url")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data?.review_url) throw new Error("Generate a review link before starting a campaign.");
  return data.review_url;
}

async function loadTemplate(businessId: string, channel: "sms" | "email", templateId?: string | null) {
  const supabase = createServiceClient();
  if (templateId) {
    const { data } = await supabase
      .from("review_request_templates")
      .select("*")
      .eq("id", templateId)
      .eq("business_id", businessId)
      .maybeSingle();
    // Never cross channels — SMS id must not render as email body.
    if (data && String(data.channel) === channel) return data;
  }
  const { data } = await supabase
    .from("review_request_templates")
    .select("*")
    .eq("business_id", businessId)
    .eq("channel", channel)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

function defaultSmsBody(): string {
  return "Hi {{first_name}}, thanks for choosing {{business_name}}. Would you be willing to share your honest feedback on Google? {{review_link}} Reply STOP to opt out.";
}

function defaultEmailSubject(): string {
  return "How was your experience with {{business_name}}?";
}

function defaultEmailBody(): string {
  return `Hi {{first_name}},

Thanks for choosing {{business_name}}. We'd appreciate your honest feedback. If you have a minute, you can leave a Google review here:

{{review_link}}

Thank you.`;
}

export async function createReviewCampaign(input: CreateCampaignInput) {
  const supabase = createServiceClient();
  const business = await getBusiness(input.businessId, input.organizationId);
  if (!business) throw new Error("Business not found");
  if (input.status !== "draft" && !input.consentConfirmed) {
    throw new Error("Consent confirmation is required.");
  }

  const sequence = normalizeSequenceSteps(
    input.sequence?.length ? input.sequence : defaultReviewRequestSequence(input.channel)
  );
  if (input.status !== "draft") {
    const seqErr = validateSequenceForLaunch(sequence);
    if (seqErr) throw new Error(seqErr);
  }

  const googleReviewUrl = await loadGoogleReviewUrl(input.businessId);

  // Server-side revalidation — never trust client "ready" for opt-out / recent contact.
  const { recipients: validatedRecipients } = await validateBulkRecipients({
    businessId: input.businessId,
    rows: input.recipients.map((r, i) => ({
      rowIndex: r.rowIndex ?? i,
      first_name: r.first_name,
      last_name: r.last_name,
      full_name: r.full_name,
      phone: r.phone,
      email: r.email,
      service_date: r.service_date,
      job_type: r.job_type,
      city: r.city,
      notes: r.notes,
    })),
    duplicateProtectionDays: input.duplicateProtectionDays,
  });
  // Preserve client skip reasons only when server also marks non-ready with a looser status.
  const recipients: ValidatedRecipient[] = validatedRecipients.map((v, i) => {
    const client = input.recipients[i];
    if (v.status === "ready" && client && client.status !== "ready" && client.status !== "duplicate") {
      // Client marked opted_out / invalid etc. — keep the stricter client skip.
      return { ...v, status: client.status, skip_reason: client.skip_reason ?? v.skip_reason };
    }
    return v;
  });

  const ready = recipients.filter((r) => r.status === "ready");
  const skipped = recipients.length - ready.length;

  const { data: campaign, error: campErr } = await supabase
    .from("review_request_campaigns")
    .insert({
      organization_id: input.organizationId,
      business_id: input.businessId,
      name: input.name,
      status: input.status === "draft" ? "draft" : input.status === "active" ? "active" : "scheduled",
      channel: input.channel,
      template_id: input.templateId ?? null,
      email_template_id: input.emailTemplateId ?? null,
      daily_send_limit: input.dailySendLimit,
      send_days: input.sendDays,
      send_window_start: input.sendWindowStart,
      send_window_end: input.sendWindowEnd,
      timezone: input.timezone,
      duplicate_protection_days: input.duplicateProtectionDays,
      start_date: input.startDate,
      consent_confirmed: input.consentConfirmed,
      started_at: input.status === "active" ? new Date().toISOString() : null,
      objective: input.objective ?? "request_review",
      description: input.description ?? null,
      sequence_json: sequence,
      channel_strategy:
        input.channel === "sms"
          ? "sms_only"
          : input.channel === "email"
            ? "email_only"
            : "both_same_time",
      terms_acknowledged_at: input.consentConfirmed ? new Date().toISOString() : null,
      success_mode: input.successMode ?? "click",
      source_template_id: input.sourceTemplateId ?? null,
      source_template_version: input.sourceTemplateVersion ?? null,
      trigger_type: normalizeTriggerType(input.triggerType ?? "manual"),
      trigger_config: parseTriggerConfig(input.triggerConfig ?? {}),
      webhook_endpoint_id: input.webhookEndpointId ?? null,
      enrollments_paused: false,
    })
    .select("*")
    .single();

  if (campErr) throw new Error(campErr.message);

  await persistCampaignSteps({
    organizationId: input.organizationId,
    businessId: input.businessId,
    campaignId: campaign.id,
    steps: sequence,
  });

  const { data: upload } = await supabase
    .from("review_request_uploads")
    .insert({
      organization_id: input.organizationId,
      business_id: input.businessId,
      campaign_id: campaign.id,
      filename: input.filename ?? "upload.csv",
      total_rows: input.recipients.length,
      valid_rows: ready.length,
      skipped_rows: skipped,
      mapping_json: input.mapping,
    })
    .select("id")
    .single();

  const enrollmentSource: EnrollmentSource =
    input.enrollmentSource ??
    (input.filename && input.filename !== "contacts.csv" && input.filename !== "template-draft.csv"
      ? "csv"
      : input.filename === "contacts.csv"
        ? "contacts"
        : "manual");

  let campaignRunId: string | null = null;
  if (ready.length > 0 || input.status !== "draft") {
    const runStatus =
      input.status === "draft" ? "draft" : input.status === "scheduled" ? "scheduled" : "running";
    const { data: run } = await supabase
      .from("review_campaign_runs")
      .insert({
        organization_id: input.organizationId,
        business_id: input.businessId,
        campaign_id: campaign.id,
        source: enrollmentSource,
        status: runStatus,
        upload_id: upload?.id ?? null,
        started_at: new Date().toISOString(),
        recipient_count: recipients.length,
        eligible_count: ready.length,
        skipped_count: skipped,
      })
      .select("id")
      .maybeSingle();
    campaignRunId = (run?.id as string | undefined) ?? null;
  }

  const nowIso = new Date().toISOString();
  const recipientRows = recipients.map((r) => ({
    organization_id: input.organizationId,
    business_id: input.businessId,
    campaign_id: campaign.id,
    upload_id: upload?.id,
    first_name: r.first_name ?? null,
    last_name: r.last_name ?? null,
    full_name: r.full_name ?? null,
    phone: r.normalized_phone ?? r.phone ?? null,
    email: r.normalized_email ?? r.email ?? null,
    service_date: r.service_date ?? null,
    job_type: r.job_type ?? null,
    city: r.city ?? null,
    notes: r.notes ?? null,
    status: r.status,
    skip_reason: r.skip_reason ?? null,
    workflow_status: r.status === "ready" ? "scheduled" : "stopped",
    current_step: 0,
    next_action_at: r.status === "ready" ? nowIso : null,
    enrollment_source: enrollmentSource,
    campaign_run_id: campaignRunId,
    enrolled_at: r.status === "ready" ? nowIso : null,
    occurred_at: r.status === "ready" ? nowIso : null,
  }));

  let insertedRecipients: Array<{
    id: string;
    status: string;
    phone: string | null;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    job_type: string | null;
  }> = [];

  if (recipientRows.length) {
    const { data, error: recErr } = await supabase
      .from("review_request_recipients")
      .insert(recipientRows)
      .select("id, status, phone, email, first_name, last_name, full_name, job_type");
    if (recErr) throw new Error(recErr.message);
    insertedRecipients = data ?? [];
  }

  const readyRecipients = insertedRecipients.filter((r) => r.status === "ready");

  // Sequences that start with a wait (post-service delay):
  // - draft: keep recipients scheduled (do not start the wait clock — avoids reclaim busy-loop)
  // - active/scheduled: park in waiting; runner enqueues the first send after the delay
  if (sequenceStartsWithWait(sequence) && readyRecipients.length) {
    if (input.status === "draft") {
      await supabase
        .from("review_request_recipients")
        .update({
          workflow_status: "scheduled",
          current_step: 0,
          next_action_at: null,
        })
        .eq("campaign_id", campaign.id)
        .eq("status", "ready");
    } else {
      const delayMs = waitDurationMs(sequence[0]!.config);
      const nextAt = new Date(Date.now() + delayMs).toISOString();
      await supabase
        .from("review_request_recipients")
        .update({
          workflow_status: "waiting",
          current_step: 0,
          next_action_at: nextAt,
        })
        .eq("campaign_id", campaign.id)
        .eq("status", "ready");
    }

    return {
      campaign,
      uploadId: upload?.id,
      validCount: ready.length,
      skippedCount: skipped,
      messageCount: 0,
      businessDays: estimateBusinessDays(ready.length, input.dailySendLimit),
      sequenceSteps: sequence.length,
    };
  }

  // Only enqueue the first contiguous send step(s). Reminders are enqueued by the sequence runner.
  const firstSends = initialSendSteps(sequence);
  const messageItems: Array<{
    recipientId: string;
    channel: "sms" | "email";
    stepKey: string;
    step: SequenceStep;
  }> = [];

  for (const r of readyRecipients) {
    const base = {
      ...r,
      rowIndex: 0,
      status: "ready" as const,
      phone: r.phone ?? undefined,
      email: r.email ?? undefined,
      first_name: r.first_name ?? undefined,
      last_name: r.last_name ?? undefined,
      full_name: r.full_name ?? undefined,
      job_type: r.job_type ?? undefined,
    };

    if (firstSends.length) {
      const step = firstSends[0]!;
      const wave = resolveWaveChannels({
        campaignChannel: input.channel,
        step,
        hasPhone: Boolean(r.phone),
        hasEmail: Boolean(r.email),
      });
      for (const ch of wave) {
        messageItems.push({
          recipientId: r.id as string,
          channel: ch,
          stepKey: step.step_key,
          step,
        });
      }
    } else {
      for (const ch of channelsForRecipient(input.channel, base)) {
        const synthetic: SequenceStep = {
          step_key: "initial",
          step_type: ch === "email" ? "send_email" : "send_sms",
          config: {},
        };
        messageItems.push({
          recipientId: r.id as string,
          channel: ch,
          stepKey: "initial",
          step: synthetic,
        });
      }
    }
  }

  if (messageItems.length) {
    const scheduleConfig: ScheduleConfig = {
      startDate: input.startDate,
      dailySendLimit: input.dailySendLimit,
      sendDays: input.sendDays,
      windowStart: input.sendWindowStart,
      windowEnd: input.sendWindowEnd,
      timezone: input.timezone,
    };
    const slots = buildMessageSchedule(
      messageItems.map((m) => ({ recipientId: m.recipientId, channel: m.channel })),
      scheduleConfig
    );

    const smsTemplate = await loadTemplate(input.businessId, "sms", input.templateId);
    const emailTemplate = await loadTemplate(
      input.businessId,
      "email",
      input.emailTemplateId ?? input.templateId
    );

    const messageRows = [];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      const meta = messageItems[i]!;
      const recipient = readyRecipients.find((r) => r.id === slot.recipientId)!;
      const token = generateTrackingToken();
      const trackingUrl = buildTrackingUrl(token);
      const name = displayName({
        rowIndex: 0,
        status: "ready",
        first_name: recipient.first_name ?? undefined,
        last_name: recipient.last_name ?? undefined,
        full_name: recipient.full_name ?? undefined,
      });
      const first = name === "there" ? "there" : name.split(" ")[0] ?? name;
      const vars = buildCampaignTemplateVars({
        firstName: first,
        lastName: recipient.last_name ?? null,
        fullName: recipient.full_name ?? name,
        businessName: business.name,
        reviewLink: trackingUrl,
        serviceType: recipient.job_type ?? "recent service",
        unsubscribeLink:
          "Reply STOP to opt out of SMS. Use the email unsubscribe link to stop emails.",
      });

      const { subject, body } = renderStepMessage({
        step: meta.step,
        channel: slot.channel,
        vars,
        fallbackSmsBody: defaultSmsBody(),
        fallbackEmailSubject: defaultEmailSubject(),
        fallbackEmailBody: defaultEmailBody(),
        templateSubject: emailTemplate?.subject ?? null,
        templateBody:
          slot.channel === "sms" ? (smsTemplate?.body ?? null) : (emailTemplate?.body ?? null),
      });

      messageRows.push({
        organization_id: input.organizationId,
        business_id: input.businessId,
        campaign_id: campaign.id,
        recipient_id: slot.recipientId,
        channel: slot.channel,
        status: "queued",
        tracking_token: token,
        tracking_url: trackingUrl,
        google_review_url: googleReviewUrl,
        subject,
        message_body: body,
        scheduled_for: slot.scheduledFor.toISOString(),
        step_key: meta.stepKey,
        idempotency_key: `${campaign.id}:${slot.recipientId}:${meta.stepKey}:${slot.channel}`,
      });
    }

    if (messageRows.length) {
      const { data: insertedMsgs, error: msgErr } = await supabase
        .from("review_request_messages")
        .insert(messageRows)
        .select("id, channel, message_body, subject, tracking_url, recipient_id, step_key");
      if (msgErr) throw new Error(msgErr.message);

      // Patch email bodies with real unsubscribe URLs once message ids exist.
      for (const msg of insertedMsgs ?? []) {
        if (msg.channel !== "email") continue;
        const unsub = buildUnsubscribeUrl(String(msg.id));
        if (!unsub) continue;
        const meta = messageItems.find(
          (m) =>
            m.recipientId === msg.recipient_id &&
            m.stepKey === msg.step_key &&
            m.channel === "email"
        );
        if (!meta) continue;
        const recipient = readyRecipients.find((r) => r.id === msg.recipient_id);
        if (!recipient) continue;
        const name = displayName({
          rowIndex: 0,
          status: "ready",
          first_name: recipient.first_name ?? undefined,
          last_name: recipient.last_name ?? undefined,
          full_name: recipient.full_name ?? undefined,
        });
        const first = name === "there" ? "there" : name.split(" ")[0] ?? name;
        const rendered = renderStepMessage({
          step: meta.step,
          channel: "email",
          vars: buildCampaignTemplateVars({
            firstName: first,
            lastName: recipient.last_name ?? null,
            fullName: recipient.full_name ?? name,
            businessName: business.name,
            reviewLink: String(msg.tracking_url ?? ""),
            serviceType: recipient.job_type ?? "recent service",
            unsubscribeLink: unsub,
          }),
          fallbackSmsBody: defaultSmsBody(),
          fallbackEmailSubject: defaultEmailSubject(),
          fallbackEmailBody: defaultEmailBody(),
          templateSubject: emailTemplate?.subject ?? null,
          templateBody: emailTemplate?.body ?? null,
        });
        await supabase
          .from("review_request_messages")
          .update({ subject: rendered.subject, message_body: rendered.body })
          .eq("id", msg.id);
      }
    }

    const firstStepIdx = Math.max(
      0,
      sequence.findIndex((s) => s.step_key === (firstSends[0]?.step_key ?? "initial"))
    );
    await supabase
      .from("review_request_recipients")
      .update({ workflow_status: "in_progress", current_step: firstStepIdx })
      .eq("campaign_id", campaign.id)
      .eq("status", "ready");
  }

  const businessDays = estimateBusinessDays(messageItems.length, input.dailySendLimit);

  return {
    campaign,
    uploadId: upload?.id,
    validCount: ready.length,
    skippedCount: skipped,
    messageCount: messageItems.length,
    businessDays,
    sequenceSteps: sequence.length,
  };
}

export async function listCampaigns(businessId: string) {
  const supabase = createServiceClient();
  const { data: campaigns, error } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!campaigns?.length) return [];

  const visible = campaigns.filter((c) => !(c as { archived_at?: string | null }).archived_at);
  if (!visible.length) return [];

  const ids = visible.map((c) => c.id);

  // Aggregate in the DB shape we need — avoid loading every message row into JS.
  const { data: messages } = await supabase
    .from("review_request_messages")
    .select("campaign_id, status")
    .in("campaign_id", ids);

  const { data: recipients } = await supabase
    .from("review_request_recipients")
    .select("campaign_id, status")
    .in("campaign_id", ids);

  const { data: attributions } = await supabase
    .from("review_campaign_attributions")
    .select("campaign_id, attribution_level")
    .in("campaign_id", ids);

  const msgByCamp = new Map<string, { queued: number; sent: number; failed: number; clicked: number; opted_out: number; delivered: number }>();
  for (const id of ids) {
    msgByCamp.set(id, { queued: 0, sent: 0, failed: 0, clicked: 0, opted_out: 0, delivered: 0 });
  }
  for (const m of messages ?? []) {
    const bucket = msgByCamp.get(m.campaign_id as string);
    if (!bucket) continue;
    const s = String(m.status);
    if (s === "queued" || s === "sending") bucket.queued++;
    else if (s === "sent" || s === "delivered" || s === "clicked") bucket.sent++;
    if (s === "delivered" || s === "clicked") bucket.delivered++;
    if (s === "clicked") bucket.clicked++;
    if (s === "failed") bucket.failed++;
    if (s === "opted_out") bucket.opted_out++;
  }

  const recByCamp = new Map<string, { total: number; ready: number }>();
  for (const id of ids) recByCamp.set(id, { total: 0, ready: 0 });
  for (const r of recipients ?? []) {
    const bucket = recByCamp.get(r.campaign_id as string);
    if (!bucket) continue;
    bucket.total++;
    if (r.status === "ready") bucket.ready++;
  }

  const attrByCamp = new Map<string, number>();
  for (const id of ids) attrByCamp.set(id, 0);
  for (const a of attributions ?? []) {
    const id = a.campaign_id as string;
    // Count confirmed + likely only — unattributed is campaign-window noise.
    if (a.attribution_level === "confirmed" || a.attribution_level === "likely") {
      attrByCamp.set(id, (attrByCamp.get(id) ?? 0) + 1);
    }
  }

  return visible.map((c) => {
    const msgs = msgByCamp.get(c.id) ?? {
      queued: 0,
      sent: 0,
      failed: 0,
      clicked: 0,
      opted_out: 0,
      delivered: 0,
    };
    const recs = recByCamp.get(c.id) ?? { total: 0, ready: 0 };
    return {
      ...c,
      recipients_total: recs.total,
      recipients_ready: recs.ready,
      queued: msgs.queued,
      sent: msgs.sent,
      delivered: msgs.delivered,
      failed: msgs.failed,
      clicked: msgs.clicked,
      opted_out: msgs.opted_out,
      // Honest: confirmed + likely attributions only (not raw review volume)
      reviews_detected: attrByCamp.get(c.id) ?? 0,
      replied: 0,
    };
  });
}

export async function getCampaignDetail(
  campaignId: string,
  businessId: string,
  options?: { recipientCursor?: string | null; recipientLimit?: number; recipientStatus?: string | null }
) {
  const supabase = createServiceClient();
  const { data: campaign, error } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!campaign) throw new Error("Campaign not found");

  const { data: messageRows } = await supabase
    .from("review_request_messages")
    .select("status, channel")
    .eq("campaign_id", campaignId)
    .eq("business_id", businessId);

  const metrics = {
    queued: 0,
    sending: 0,
    sent: 0,
    delivered: 0,
    clicked: 0,
    failed: 0,
    opted_out: 0,
    skipped: 0,
    sms: 0,
    email: 0,
    replied: 0,
  };
  for (const m of messageRows ?? []) {
    const s = String(m.status);
    if (s === "queued") metrics.queued++;
    else if (s === "sending") metrics.sending++;
    else if (s === "sent") metrics.sent++;
    else if (s === "delivered") {
      metrics.sent++;
      metrics.delivered++;
    } else if (s === "clicked") {
      metrics.sent++;
      metrics.delivered++;
      metrics.clicked++;
    } else if (s === "failed") metrics.failed++;
    else if (s === "opted_out") metrics.opted_out++;
    else if (s === "skipped") metrics.skipped++;
    if (m.channel === "sms") metrics.sms++;
    if (m.channel === "email") metrics.email++;
  }

  const { count: repliedCount } = await supabase
    .from("review_request_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .not("replied_at", "is", null);
  metrics.replied = repliedCount ?? 0;

  const limit = Math.min(Math.max(options?.recipientLimit ?? 50, 1), 100);
  let recipQuery = supabase
    .from("review_request_recipients")
    .select(
      "id, first_name, last_name, full_name, phone, email, status, skip_reason, workflow_status, current_step, replied_at, review_detected_at, review_attribution, created_at, updated_at"
    )
    .eq("campaign_id", campaignId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (options?.recipientStatus) {
    const rs = options.recipientStatus;
    if (
      ["ready", "duplicate", "invalid_contact", "missing_contact", "recently_contacted", "opted_out", "skipped"].includes(
        rs
      )
    ) {
      recipQuery = recipQuery.eq("status", rs);
    } else if (rs === "replied") {
      recipQuery = recipQuery.not("replied_at", "is", null);
    } else if (rs === "reviewed") {
      recipQuery = recipQuery.not("review_detected_at", "is", null);
    }
  }
  if (options?.recipientCursor) {
    recipQuery = recipQuery.lt("created_at", options.recipientCursor);
  }

  const { data: recipients, error: recipErr } = await recipQuery;
  if (recipErr) throw new Error(recipErr.message);
  const rows = recipients ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  // Latest message per recipient (batch, not N+1).
  const recipIds = items.map((r) => r.id);
  const latestByRecipient = new Map<
    string,
    { status: string; channel: string; sent_at: string | null; scheduled_for: string; clicked_at: string | null }
  >();
  if (recipIds.length) {
    const { data: msgs } = await supabase
      .from("review_request_messages")
      .select("recipient_id, status, channel, sent_at, scheduled_for, clicked_at")
      .in("recipient_id", recipIds)
      .order("scheduled_for", { ascending: false });
    for (const m of msgs ?? []) {
      const rid = m.recipient_id as string;
      if (!latestByRecipient.has(rid)) {
        latestByRecipient.set(rid, {
          status: String(m.status),
          channel: String(m.channel),
          sent_at: (m.sent_at as string | null) ?? null,
          scheduled_for: String(m.scheduled_for),
          clicked_at: (m.clicked_at as string | null) ?? null,
        });
      }
    }
  }

  // Attribution counts (honest labels only)
  const { data: attrs } = await supabase
    .from("review_campaign_attributions")
    .select("attribution_level")
    .eq("campaign_id", campaignId)
    .eq("business_id", businessId);
  const attribution = {
    confirmed: (attrs ?? []).filter((a) => a.attribution_level === "confirmed").length,
    likely: (attrs ?? []).filter((a) => a.attribution_level === "likely").length,
    unattributed: (attrs ?? []).filter((a) => a.attribution_level === "unattributed").length,
  };

  // Compact activity timeline from message status transitions + clicks + replies
  const { data: recentMsgs } = await supabase
    .from("review_request_messages")
    .select(
      "id, status, channel, sent_at, delivered_at, clicked_at, failed_at, failed_reason, scheduled_for, created_at, updated_at"
    )
    .eq("campaign_id", campaignId)
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false })
    .limit(40);

  const { data: clicks } = await supabase
    .from("review_request_clicks")
    .select("id, clicked_at, recipient_id, message_id")
    .eq("campaign_id", campaignId)
    .order("clicked_at", { ascending: false })
    .limit(20);

  const { data: replies } = await supabase
    .from("review_request_replies")
    .select("id, recipient_id, channel, body, from_address, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fallback names when reply rows exist without joining recipients.
  const replyRecipIds = [...new Set((replies ?? []).map((r) => r.recipient_id as string).filter(Boolean))];
  const replyNameById = new Map<string, string>();
  if (replyRecipIds.length) {
    const { data: nameRows } = await supabase
      .from("review_request_recipients")
      .select("id, full_name, first_name")
      .in("id", replyRecipIds);
    for (const r of nameRows ?? []) {
      replyNameById.set(r.id as string, String(r.full_name || r.first_name || "customer"));
    }
  }

  type TimelineItem = { at: string; type: string; label: string; meta?: string };
  const activity: TimelineItem[] = [];
  activity.push({
    at: String(campaign.created_at),
    type: "created",
    label: "Campaign created",
  });
  if (campaign.started_at) {
    activity.push({ at: String(campaign.started_at), type: "started", label: "Campaign started" });
  }
  if (campaign.completed_at) {
    activity.push({
      at: String(campaign.completed_at),
      type: "completed",
      label: `Campaign ${campaign.status}`,
    });
  }
  for (const m of recentMsgs ?? []) {
    if (m.sent_at) {
      activity.push({
        at: String(m.sent_at),
        type: "sent",
        label: `${m.channel} sent`,
        meta: m.id as string,
      });
    }
    if (m.delivered_at) {
      activity.push({
        at: String(m.delivered_at),
        type: "delivered",
        label: `${m.channel} delivered`,
        meta: m.id as string,
      });
    }
    if (m.failed_at) {
      activity.push({
        at: String(m.failed_at),
        type: "failed",
        label: "Send failed",
        meta: (m.failed_reason as string) || undefined,
      });
    }
    if (String(m.status) === "opted_out") {
      activity.push({
        at: String(m.updated_at ?? m.created_at),
        type: "opted_out",
        label: `${m.channel} opted out / suppressed`,
        meta: m.id as string,
      });
    }
  }
  for (const c of clicks ?? []) {
    activity.push({
      at: String(c.clicked_at),
      type: "clicked",
      label: "Link clicked",
      meta: c.recipient_id as string,
    });
  }
  if ((replies ?? []).length) {
    for (const r of replies ?? []) {
      const name = replyNameById.get(r.recipient_id as string) || "customer";
      const snippet = String(r.body ?? "").trim().slice(0, 80);
      activity.push({
        at: String(r.created_at),
        type: "replied",
        label: snippet
          ? `Reply from ${name}: ${snippet}`
          : `Reply from ${name} (${r.channel})`,
        meta: (r.recipient_id as string) || undefined,
      });
    }
  } else {
    // Pre-migration fallback: replied_at flag only.
    const { data: repliedRecips } = await supabase
      .from("review_request_recipients")
      .select("id, full_name, first_name, replied_at")
      .eq("campaign_id", campaignId)
      .not("replied_at", "is", null)
      .order("replied_at", { ascending: false })
      .limit(20);
    for (const r of repliedRecips ?? []) {
      activity.push({
        at: String(r.replied_at),
        type: "replied",
        label: `Reply from ${r.full_name || r.first_name || "customer"}`,
      });
    }
  }

  const { data: attrsForTimeline } = await supabase
    .from("review_campaign_attributions")
    .select("attribution_level, detected_at, recipient_id")
    .eq("campaign_id", campaignId)
    .order("detected_at", { ascending: false })
    .limit(20);
  for (const a of attrsForTimeline ?? []) {
    activity.push({
      at: String(a.detected_at),
      type: "attribution",
      label:
        a.attribution_level === "confirmed"
          ? "Confirmed review attribution"
          : a.attribution_level === "likely"
            ? "Likely review completion"
            : "New review during campaign (unattributed)",
      meta: (a.recipient_id as string) || undefined,
    });
  }

  activity.sort((a, b) => (a.at < b.at ? 1 : -1));

  return {
    campaign,
    metrics,
    attribution,
    activity: activity.slice(0, 50),
    recipients: {
      items: items.map((r) => ({
        ...r,
        latest_message: latestByRecipient.get(r.id) ?? null,
      })),
      nextCursor: hasMore ? String(items[items.length - 1]?.created_at ?? "") : null,
    },
  };
}

export async function getRecipientEventHistory(params: {
  campaignId: string;
  businessId: string;
  recipientId: string;
}) {
  const supabase = createServiceClient();
  const { data: recipient } = await supabase
    .from("review_request_recipients")
    .select("*")
    .eq("id", params.recipientId)
    .eq("campaign_id", params.campaignId)
    .eq("business_id", params.businessId)
    .maybeSingle();
  if (!recipient) throw new Error("Recipient not found");

  const { data: messages } = await supabase
    .from("review_request_messages")
    .select(
      "id, channel, status, subject, message_body, scheduled_for, sent_at, delivered_at, clicked_at, failed_at, failed_reason, provider_message_id, tracking_url"
    )
    .eq("recipient_id", params.recipientId)
    .order("scheduled_for", { ascending: true });

  const { data: clicks } = await supabase
    .from("review_request_clicks")
    .select("id, message_id, clicked_at, user_agent")
    .eq("recipient_id", params.recipientId)
    .order("clicked_at", { ascending: false });

  const { data: attrs } = await supabase
    .from("review_campaign_attributions")
    .select("attribution_level, detected_at, evidence_json")
    .eq("recipient_id", params.recipientId);

  const { data: replies } = await supabase
    .from("review_request_replies")
    .select("id, channel, body, from_address, provider_sid, message_id, created_at, metadata")
    .eq("recipient_id", params.recipientId)
    .order("created_at", { ascending: false });

  const nextQueued = (messages ?? []).find((m) => m.status === "queued" || m.status === "sending");

  return {
    recipient,
    messages: messages ?? [],
    clicks: clicks ?? [],
    replies: replies ?? [],
    attributions: attrs ?? [],
    nextAction: nextQueued
      ? {
          at: nextQueued.scheduled_for,
          channel: nextQueued.channel,
          status: nextQueued.status,
        }
      : null,
  };
}

export async function updateCampaignStatus(
  campaignId: string,
  businessId: string,
  status: CampaignStatus,
  organizationId?: string
) {
  const supabase = createServiceClient();
  const { data: before } = await supabase
    .from("review_request_campaigns")
    .select("status, started_at, consent_confirmed, sequence_json, channel")
    .eq("id", campaignId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!before) throw new Error("Campaign not found");

  let launchSequence: SequenceStep[] | null = null;
  if (status === "active" && before.status === "draft") {
    if (!before.consent_confirmed) {
      throw new Error("Consent confirmation is required before starting a campaign.");
    }
    launchSequence = normalizeSequenceSteps(
      (before.sequence_json as SequenceStep[] | null)?.length
        ? (before.sequence_json as SequenceStep[])
        : defaultReviewRequestSequence(before.channel as CampaignChannel)
    );
    const seqErr = validateSequenceForLaunch(launchSequence);
    if (seqErr) throw new Error(seqErr);
  }

  if (status === "active" && before.status === "archived") {
    throw new Error("Archived campaigns cannot be resumed. Duplicate the campaign instead.");
  }

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  // Only stamp started_at on first activation (preserve attribution window on resume).
  if (status === "active" && !before.started_at) {
    patch.started_at = new Date().toISOString();
  }
  if (status === "completed" || status === "cancelled" || status === "archived") {
    patch.completed_at = new Date().toISOString();
  }
  let query = supabase
    .from("review_request_campaigns")
    .update(patch)
    .eq("id", campaignId)
    .eq("business_id", businessId);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Campaign not found");

  // Draft → active with wait-first sequence: start the initial delay clock now.
  if (
    status === "active" &&
    before.status === "draft" &&
    launchSequence &&
    sequenceStartsWithWait(launchSequence)
  ) {
    const delayMs = waitDurationMs(launchSequence[0]!.config);
    const nextAt = new Date(Date.now() + delayMs).toISOString();
    await supabase
      .from("review_request_recipients")
      .update({
        workflow_status: "waiting",
        current_step: 0,
        next_action_at: nextAt,
        updated_at: new Date().toISOString(),
      })
      .eq("campaign_id", campaignId)
      .eq("business_id", businessId)
      .eq("status", "ready")
      .in("workflow_status", ["scheduled", "pending", "waiting"]);
  }

  if (status === "cancelled" || status === "archived") {
    const now = new Date().toISOString();
    await supabase
      .from("review_request_messages")
      .update({ status: "skipped", updated_at: now })
      .eq("campaign_id", campaignId)
      .eq("business_id", businessId)
      .in("status", ["queued", "sending"]);
    await supabase
      .from("review_request_recipients")
      .update({
        workflow_status: "stopped",
        next_action_at: null,
        updated_at: now,
      })
      .eq("campaign_id", campaignId)
      .eq("business_id", businessId)
      .in("workflow_status", ["pending", "scheduled", "in_progress", "waiting"]);
  }

  return data;
}

export async function duplicateCampaign(campaignId: string, businessId: string, organizationId: string) {
  const supabase = createServiceClient();
  const { data: orig } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", businessId)
    .single();
  if (!orig) throw new Error("Campaign not found");

  const { data: recs } = await supabase
    .from("review_request_recipients")
    .select("*")
    .eq("campaign_id", campaignId);

  const { data: upload } = await supabase
    .from("review_request_uploads")
    .select("mapping_json, filename")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const recipients: ValidatedRecipient[] = (recs ?? []).map((r, i) => ({
    rowIndex: i,
    first_name: r.first_name ?? undefined,
    last_name: r.last_name ?? undefined,
    full_name: r.full_name ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    service_date: r.service_date ?? undefined,
    job_type: r.job_type ?? undefined,
    city: r.city ?? undefined,
    notes: r.notes ?? undefined,
    status: r.status as ValidatedRecipient["status"],
    skip_reason: r.skip_reason ?? undefined,
  }));

  return createReviewCampaign({
    organizationId,
    businessId,
    name: `${orig.name} (copy)`,
    channel: orig.channel as CampaignChannel,
    templateId: orig.template_id,
    emailTemplateId: orig.email_template_id ?? null,
    dailySendLimit: orig.daily_send_limit,
    sendDays: orig.send_days as number[],
    sendWindowStart: orig.send_window_start,
    sendWindowEnd: orig.send_window_end,
    timezone: orig.timezone,
    duplicateProtectionDays: orig.duplicate_protection_days,
    startDate: ymdInTimeZone(new Date(), (orig.timezone as string) || "America/New_York"),
    consentConfirmed: orig.consent_confirmed,
    filename: upload?.filename ?? undefined,
    mapping: (upload?.mapping_json ?? {}) as Record<string, CsvMapTarget>,
    recipients,
    status: "draft",
    sequence: normalizeSequenceSteps(
      (orig.sequence_json as SequenceStep[] | null)?.length
        ? (orig.sequence_json as SequenceStep[])
        : defaultReviewRequestSequence(orig.channel as CampaignChannel)
    ),
    description: orig.description ?? null,
    objective: (orig.objective as CreateCampaignInput["objective"]) ?? "request_review",
    successMode: (orig.success_mode as CampaignSuccessMode) ?? "click",
    sourceTemplateId: (orig.source_template_id as string | null) ?? null,
    sourceTemplateVersion: (orig.source_template_version as string | null) ?? null,
    triggerType: normalizeTriggerType(orig.trigger_type),
    triggerConfig: parseTriggerConfig(orig.trigger_config),
    // Do not copy endpoint binding — user re-links after activate.
    webhookEndpointId: null,
  });
}

/**
 * Cancel pending messages and mark the recipient complete after a success event
 * (review-link click by default). Idempotent.
 */
export async function completeRecipientOnSuccess(params: {
  supabase: ReturnType<typeof createServiceClient>;
  campaignId: string;
  recipientId: string;
  reason: "link_clicked" | "review_detected" | "manual";
}): Promise<void> {
  const now = new Date().toISOString();
  await params.supabase
    .from("review_request_messages")
    .update({
      status: "skipped",
      failed_reason: `stopped:${params.reason}`,
      updated_at: now,
    })
    .eq("campaign_id", params.campaignId)
    .eq("recipient_id", params.recipientId)
    .in("status", ["queued", "sending"]);

  await params.supabase
    .from("review_request_recipients")
    .update({
      workflow_status: "completed",
      next_action_at: null,
      updated_at: now,
    })
    .eq("id", params.recipientId)
    .eq("campaign_id", params.campaignId)
    .in("workflow_status", [
      "pending",
      "scheduled",
      "in_progress",
      "waiting",
    ]);
}

export async function recordTrackingClick(params: {
  token: string;
  ip?: string;
  userAgent?: string;
}) {
  const supabase = createServiceClient();
  const { data: message } = await supabase
    .from("review_request_messages")
    .select("*")
    .eq("tracking_token", params.token)
    .maybeSingle();

  if (message) {
    const now = new Date().toISOString();
    // Always record the click hit for history; upgrade status only from sendable states.
    await supabase.from("review_request_clicks").insert({
      organization_id: message.organization_id,
      business_id: message.business_id,
      campaign_id: message.campaign_id,
      recipient_id: message.recipient_id,
      message_id: message.id,
      tracking_token: params.token,
      ip_hash: params.ip ? hashIp(params.ip) : null,
      user_agent: params.userAgent?.slice(0, 500) ?? null,
      clicked_at: now,
    });

    await supabase
      .from("review_request_messages")
      .update({ status: "clicked", clicked_at: now, updated_at: now })
      .eq("id", message.id)
      .in("status", ["sent", "delivered", "sending"])
      .is("clicked_at", null);

    // Default success mode treats click as "acted" — stop reminders immediately.
    if (message.campaign_id && message.recipient_id) {
      const { data: campaign } = await supabase
        .from("review_request_campaigns")
        .select("success_mode")
        .eq("id", message.campaign_id)
        .maybeSingle();
      const mode = String(campaign?.success_mode ?? "click");
      if (mode === "click") {
        await completeRecipientOnSuccess({
          supabase,
          campaignId: String(message.campaign_id),
          recipientId: String(message.recipient_id),
          reason: "link_clicked",
        });
      }
    }

    return message.google_review_url as string;
  }

  // One-off quick-send tracking (no campaign message row).
  const { data: send } = await supabase
    .from("review_request_sends")
    .select("id, review_url, status, organization_id, business_id, link_id")
    .eq("tracking_token", params.token)
    .maybeSingle();
  if (!send?.review_url) return null;

  const now = new Date().toISOString();
  const wasAlreadyClicked = send.status === "clicked";
  await supabase
    .from("review_request_sends")
    .update({ status: "clicked", clicked_at: now })
    .eq("id", send.id)
    .in("status", ["queued", "sent", "delivered"]);

  // One click event per send — avoid spam on repeat opens.
  if (send.link_id && !wasAlreadyClicked) {
    await supabase.from("review_request_events").insert({
      organization_id: send.organization_id,
      business_id: send.business_id,
      link_id: send.link_id,
      send_id: send.id,
      event_type: "clicked",
      channel: null,
      metadata: { trackingToken: params.token },
    });
  }

  return send.review_url as string;
}
