/**
 * Single execution registry for all job types.
 * Used by BullMQ workers and the database-driver cron claimer.
 */
import { createServiceClient } from "@/lib/db/client";
import { processScanBatch } from "@/lib/jobs/process-scan";
import { runScanEnrichment } from "@/lib/jobs/run-scan-enrichment";
import { maybeRunDataRetentionCleanup } from "@/lib/jobs/retention";
import { runBacklinkGap } from "@/lib/backlink-gap/engine";
import { runLocalTrustFinder } from "@/lib/local-trust/engine";
import { runAiVisibilityCheck } from "@/lib/ai-visibility/engine";
import { runCitationAudit } from "@/lib/citations/engine";
import { runReputationAudit } from "@/lib/reputation/engine";
import { runGrowthAudit } from "@/lib/growth-audit/engine";
import { runExtendedModulesInBackground } from "@/lib/growth-audit/background";
import { runReviewMomentum } from "@/lib/reviews/momentum-engine";
import { enqueueDueCampaignMessages } from "@/lib/reputation/campaign-processor";
import { sendCampaignMessageById } from "@/lib/reputation/campaign-message-send";
import { processNewReviewAlerts } from "@/lib/reputation/review-alerts";
import {
  runContactImport,
  type ContactImportMode,
  type ContactImportRow,
} from "@/lib/reputation/contact-import";
import { processIntegrationWebhookEvent } from "@/lib/integrations/webhook-process";
import { generateTypedReport } from "@/lib/reporting/generate-report";
import { releaseUsage } from "@/lib/plans";
import { logger } from "@/lib/observability/logger";
import { parseJobPayload } from "@/lib/queue/payload-schemas";
import type { QueueName } from "@/lib/queue/types";

export type JobHandlerPayload = Record<string, unknown> & {
  ledgerJobId?: string;
  organizationId?: string;
  businessId?: string;
  reservedUsage?: { key: string; amount: number };
};

export type JobHandlerResult = {
  ok: boolean;
  permanent?: boolean;
  error?: string;
  /** When false, do not mark ledger completed (another worker owns work). */
  markComplete?: boolean;
};

const PERMANENT_PATTERN =
  /not found|required|invalid|access denied|tenant mismatch|not included|unauthorized|unsupported|disabled|incomplete/i;

export function jobTypeToQueue(jobType: string): QueueName {
  switch (jobType) {
    case "process_scan":
    case "maps_difficulty_run":
    case "scan_enrichment":
    case "early_enrichment":
    case "keyword_check":
    case "keyword_volume":
      return "maps-scan";
    case "retry_scan_cells":
      return "maps-cell-retry";
    case "import_contacts":
    case "integration_webhook_process":
      return "review-import";
    case "campaign_send_batch":
    case "messaging_registration_advance":
      return "review-campaign";
    case "send_campaign_email":
      return "email-send";
    case "send_campaign_sms":
      return "sms-send";
    case "review_alert_scan":
      // Alert scans stay on the messaging worker (paired with campaign/import traffic).
      return "review-monitor";
    case "backlink_gap_run":
      return "backlink-gap";
    case "local_trust_run":
      return "local-trust";
    case "ai_visibility_run":
      return "ai-visibility";
    case "generate_report":
      return "report-generation";
    case "send_notification":
      return "notifications";
    // Heavy analysis jobs must run on worker:all / worker:intelligence.
    // They previously sat on review-monitor (messaging-only), so clicks queued
    // work that never appeared in the "all workers" Coolify logs.
    case "review_momentum_run":
    case "reputation_audit":
    case "citation_audit":
    case "growth_audit_run":
    case "growth_audit_extended":
    case "gbp_audit_module":
    case "data_retention":
    case "qr_anonymous_cleanup":
    case "qr_daily_stats_reconcile":
    default:
      return "maintenance";
  }
}

export async function executeJobType(
  jobType: string,
  payload: JobHandlerPayload
): Promise<JobHandlerResult> {
  const validated = parseJobPayload(jobType, payload);
  if (!validated.ok) {
    return permanent(validated.error);
  }
  payload = validated.data as JobHandlerPayload;

  try {
    switch (jobType) {
      case "process_scan": {
        const scanBatchId = String(payload.scanBatchId ?? "");
        if (!scanBatchId) return permanent("Missing scanBatchId");
        const orgId = await resolveOrgId(payload);
        try {
          const outcome = await processScanBatch(scanBatchId, orgId);
          if (outcome === "deferred") return { ok: true, markComplete: false };
          return { ok: true, markComplete: true };
        } catch (err) {
          const { isDeferredError } = await import("@/lib/queue/errors");
          // Org serial gate / lease defer — do not treat as a scan failure refund.
          if (isDeferredError(err)) throw err;
          const message = err instanceof Error ? err.message : "Scan failed";
          if (orgId) {
            const { maybeReleaseUnusedMapCredits, PRE_PROVIDER_FAIL } = await import(
              "@/lib/jobs/map-credits"
            );
            await maybeReleaseUnusedMapCredits(scanBatchId, orgId, message).catch(() => {});
            if (PRE_PROVIDER_FAIL.test(message)) return permanent(message);
          }
          throw err;
        }
      }
      case "retry_scan_cells": {
        const scanBatchId = String(payload.scanBatchId ?? "");
        if (!scanBatchId) return permanent("Missing scanBatchId");
        const orgId = await resolveOrgId(payload);
        const recoveryGeneration =
          typeof payload.recoveryGeneration === "number"
            ? payload.recoveryGeneration
            : Number(payload.recoveryGeneration ?? 0) || undefined;
        try {
          const { processScanRecovery } = await import("@/lib/jobs/scan-recovery");
          const outcome = await processScanRecovery(
            scanBatchId,
            orgId,
            recoveryGeneration
          );
          if (outcome === "deferred") return { ok: true, markComplete: false };
          return { ok: true, markComplete: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Scan recovery failed";
          // Temporary provider errors must not permanently fail the parent scan.
          console.warn(`[Recovery] scan=${scanBatchId} worker error:`, message);
          throw err;
        }
      }
      case "scan_enrichment": {
        const scanBatchId = String(payload.scanBatchId ?? "");
        if (!scanBatchId) return permanent("Missing scanBatchId");
        await runScanEnrichment(scanBatchId, await resolveOrgId(payload));
        return { ok: true };
      }
      case "early_enrichment": {
        const scanBatchId = String(payload.scanBatchId ?? "");
        if (!scanBatchId) return permanent("Missing scanBatchId");
        const { processEarlyEnrichment } = await import("@/lib/jobs/run-early-enrichment");
        await processEarlyEnrichment(scanBatchId, await resolveOrgId(payload));
        return { ok: true };
      }
      case "keyword_check": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("keyword_check payload incomplete");
        await requireBusinessOrg(businessId, organizationId);
        const { runKeywordChecks } = await import("@/lib/keyword-tracker/engine");
        await runKeywordChecks({
          businessId,
          organizationId,
          keywordIds: Array.isArray(payload.keywordIds)
            ? (payload.keywordIds as string[])
            : undefined,
        });
        return { ok: true };
      }
      case "keyword_volume": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("keyword_volume payload incomplete");
        await requireBusinessOrg(businessId, organizationId);
        const { refreshKeywordVolumes } = await import("@/lib/keyword-tracker/engine");
        await refreshKeywordVolumes({
          businessId,
          organizationId,
          keywordIds: Array.isArray(payload.keywordIds)
            ? (payload.keywordIds as string[])
            : undefined,
        });
        return { ok: true };
      }
      case "send_notification": {
        const toEmail = String(payload.toEmail ?? payload.to ?? "");
        const subject = String(payload.subject ?? "");
        const textBody = String(payload.textBody ?? payload.body ?? "");
        const organizationId = String(payload.organizationId ?? "");
        const businessId = optionalString(payload.businessId);
        if (!toEmail || !subject || !textBody) {
          return permanent("send_notification requires toEmail, subject, textBody");
        }
        if (!organizationId) return permanent("send_notification requires organizationId");
        if (businessId) await requireBusinessOrg(businessId, organizationId);
        const { sendBrevoEmail } = await import("@/lib/reputation/brevo");
        const { isOutboundPaused } = await import("@/lib/auth/entitlements");
        if (await isOutboundPaused(organizationId)) {
          return permanent("Outbound messaging paused for organization");
        }
        const result = await sendBrevoEmail({
          toEmail,
          subject,
          textBody,
          organizationId,
          businessId: businessId ?? undefined,
        });
        if (!result.ok) return { ok: false, error: result.error ?? "Notification send failed" };
        return { ok: true };
      }
      case "import_contacts": {
        const uploadId = String(payload.uploadId ?? "");
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!uploadId || !businessId || !organizationId) {
          return permanent("import_contacts payload incomplete");
        }
        await requireBusinessOrg(businessId, organizationId);
        const supabase = createServiceClient();
        const { data: upload } = await supabase
          .from("review_request_uploads")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", uploadId)
          .eq("business_id", businessId)
          .eq("organization_id", organizationId)
          .in("status", ["queued", "running"])
          .select("rows_json, mode")
          .maybeSingle();
        if (!upload) return permanent("Import upload not found or already finished");
        const rows = (upload.rows_json ?? []) as ContactImportRow[];
        try {
          await runContactImport({
            organizationId,
            businessId,
            uploadId,
            mode:
              (payload.mode as ContactImportMode) ??
              (upload.mode as ContactImportMode) ??
              "update",
            rows,
          });
          return { ok: true };
        } catch (err) {
          await supabase
            .from("review_request_uploads")
            .update({
              status: "failed",
              error_report_json: [
                {
                  row: 0,
                  error: err instanceof Error ? err.message : "Import failed",
                },
              ],
              completed_at: new Date().toISOString(),
            })
            .eq("id", uploadId)
            .eq("status", "running");
          throw err;
        }
      }
      case "integration_webhook_process": {
        const eventId = String(payload.eventId ?? payload.relatedResourceId ?? "");
        if (!eventId) return permanent("Missing webhook eventId");
        const result = await processIntegrationWebhookEvent(eventId);
        if (!result.ok && result.permanent) return permanent(result.error ?? "Webhook failed");
        if (!result.ok) return { ok: false, error: result.error ?? "Webhook processing failed" };
        return { ok: true };
      }
      case "campaign_send_batch": {
        // Orchestrator only — find due messages and enqueue email/sms jobs.
        const limit = Number(payload.limit ?? 100);
        await enqueueDueCampaignMessages(Number.isFinite(limit) ? limit : 100);
        return { ok: true };
      }
      case "messaging_registration_advance": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        const businessName = String(payload.businessName ?? "Business");
        if (!businessId || !organizationId) {
          return permanent("messaging_registration_advance payload incomplete");
        }
        const { advanceMessagingRegistration } = await import(
          "@/lib/messaging/registration-processor"
        );
        const { isDeferredError } = await import("@/lib/queue/errors");
        try {
          await advanceMessagingRegistration({
            organizationId,
            businessId,
            businessName,
          });
          return { ok: true };
        } catch (err) {
          if (isDeferredError(err)) throw err;
          const message = err instanceof Error ? err.message : String(err);
          if (PERMANENT_PATTERN.test(message)) return permanent(message);
          return { ok: false, error: message };
        }
      }
      case "send_campaign_email":
      case "send_campaign_sms": {
        const messageId = String(payload.messageId ?? payload.relatedResourceId ?? "");
        if (!messageId) return permanent("Missing messageId");
        const result = await sendCampaignMessageById(messageId);
        if (result.ok) return { ok: true };
        if (result.permanent) return permanent(result.error ?? "Send failed permanently");
        return { ok: false, error: result.error ?? "Send failed" };
      }
      case "review_alert_scan": {
        const limit = Number(payload.limit ?? 15);
        await processNewReviewAlerts(Number.isFinite(limit) ? limit : 15);
        return { ok: true };
      }
      case "local_trust_run": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("local_trust payload incomplete");
        await requireBusinessOrg(businessId, organizationId);
        await runLocalTrustFinder({
          businessId,
          organizationId,
          city: optionalString(payload.city),
          state: optionalString(payload.state),
          county: optionalString(payload.county),
          rescan: Boolean(payload.rescan),
        });
        return { ok: true };
      }
      case "backlink_gap_run": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("backlink_gap payload incomplete");
        await requireBusinessOrg(businessId, organizationId);
        const result = await runBacklinkGap({
          businessId,
          organizationId,
          scanBatchId: optionalString(payload.scanBatchId),
          competitorLimit:
            typeof payload.competitorLimit === "number" ? payload.competitorLimit : undefined,
          selectedCompetitorIds: Array.isArray(payload.selectedCompetitorIds)
            ? (payload.selectedCompetitorIds as string[])
            : undefined,
          forceRefresh: Boolean(payload.forceRefresh),
        });
        if (result.fromCache && payload.reservedUsage) {
          await releaseUsage(
            organizationId,
            payload.reservedUsage.key as Parameters<typeof releaseUsage>[1],
            payload.reservedUsage.amount
          ).catch(() => {});
        }
        return { ok: true };
      }
      case "ai_visibility_run": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("ai_visibility payload incomplete");
        await requireBusinessOrg(businessId, organizationId);
        await runAiVisibilityCheck({
          businessId,
          organizationId,
          maxPrompts: typeof payload.maxPrompts === "number" ? payload.maxPrompts : 1,
          promptIds: Array.isArray(payload.promptIds)
            ? (payload.promptIds as string[])
            : undefined,
        });
        return { ok: true };
      }
      case "citation_audit": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("citation_audit payload incomplete");
        await requireBusinessOrg(businessId, organizationId);
        await runCitationAudit({
          businessId,
          organizationId,
          competitorLimit:
            typeof payload.competitorLimit === "number" ? payload.competitorLimit : undefined,
          vertical: optionalString(payload.vertical),
          forceRefresh: Boolean(payload.forceRefresh),
        });
        return { ok: true };
      }
      case "reputation_audit": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("reputation_audit payload incomplete");
        await requireBusinessOrg(businessId, organizationId);
        await runReputationAudit({
          businessId,
          organizationId,
          competitorLimit:
            typeof payload.competitorLimit === "number" ? payload.competitorLimit : undefined,
          lookbackDays:
            typeof payload.lookbackDays === "number" ? payload.lookbackDays : undefined,
          forceRefresh: Boolean(payload.forceRefresh),
        });
        return { ok: true };
      }
      case "growth_audit_run": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("growth_audit payload incomplete");
        await requireBusinessOrg(businessId, organizationId);
        await runGrowthAudit({
          businessId,
          organizationId,
          keyword: optionalString(payload.keyword),
          // Engine enqueues growth_audit_extended unless skipBackground is set.
          skipBackground: Boolean(payload.skipBackground),
        });
        return { ok: true };
      }
      case "growth_audit_extended": {
        const growthRunId = String(payload.growthRunId ?? "");
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!growthRunId || !businessId || !organizationId) {
          return permanent("growth_audit_extended payload incomplete");
        }
        await requireBusinessOrg(businessId, organizationId);
        await runExtendedModulesInBackground({ growthRunId, businessId, organizationId });
        return { ok: true };
      }
      case "review_momentum_run": {
        const businessId = String(payload.businessId ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !organizationId) return permanent("review_momentum payload incomplete");
        await requireBusinessOrg(businessId, organizationId);
        await runReviewMomentum({
          businessId,
          organizationId,
          scanBatchId: optionalString(payload.scanBatchId),
          competitorLimit:
            typeof payload.competitorLimit === "number" ? payload.competitorLimit : undefined,
          lookbackDays:
            typeof payload.lookbackDays === "number" ? payload.lookbackDays : undefined,
        });
        return { ok: true };
      }
      case "maps_difficulty_run": {
        const { processMapsDifficultyJob } = await import("@/lib/maps-difficulty/run-job");
        const { assertOrganizationCanEnqueue } = await import("@/lib/auth/org-status");
        const keyword = String(payload.keyword ?? "").trim();
        const lat = Number(payload.lat);
        const lng = Number(payload.lng);
        const organizationId = String(payload.organizationId ?? "");
        if (!keyword || !Number.isFinite(lat) || !Number.isFinite(lng) || !organizationId) {
          return permanent("maps_difficulty payload incomplete");
        }
        await assertOrganizationCanEnqueue(organizationId, "maps_difficulty_run");
        await processMapsDifficultyJob({
          organizationId,
          keyword,
          lat,
          lng,
          label: String(payload.label ?? keyword),
          service: optionalString(payload.service),
          address: optionalString(payload.address),
          businessBaseAddress: optionalString(payload.businessBaseAddress),
          businessBase:
            payload.businessBase && typeof payload.businessBase === "object"
              ? (payload.businessBase as {
                  lat?: number;
                  lng?: number;
                  label?: string;
                  error?: string;
                })
              : null,
        });
        return { ok: true };
      }
      case "generate_report": {
        const businessId = String(payload.businessId ?? "");
        if (!businessId) return permanent("generate_report payload incomplete");
        const organizationId = await resolveOrgId(payload);
        if (!organizationId) return permanent("generate_report organization not found");
        await requireBusinessOrg(businessId, organizationId);
        const ledgerJobId =
          typeof payload.ledgerJobId === "string" ? payload.ledgerJobId : undefined;
        const artifactKind = optionalString(payload.artifactKind);

        // Binary scan artifacts (PDF / map / heatmap / CSV splits)
        if (artifactKind) {
          const reportTypeHint = optionalString(payload.reportType) ?? "single_scan";
          const { createSignedArtifactUrl } = await import("@/lib/reporting/artifacts");
          // Rollup PDF (monthly / location / campaign) — no scanBatchId required.
          if (
            artifactKind === "pdf" &&
            (reportTypeHint === "trend" ||
              reportTypeHint === "location" ||
              reportTypeHint === "maps_campaign")
          ) {
            const { generateRollupPdfArtifact } = await import(
              "@/lib/reporting/pdf/generate-rollup-artifact"
            );
            const artifact = await generateRollupPdfArtifact({
              businessId,
              reportType: reportTypeHint as import("@/lib/reporting/types").ReportType,
              keywordId: optionalString(payload.keywordId),
              locationId: optionalString(payload.locationId),
              campaignId: optionalString(payload.campaignId),
              gridSize: typeof payload.gridSize === "number" ? payload.gridSize : undefined,
              radiusMeters:
                typeof payload.radiusMeters === "number" ? payload.radiusMeters : undefined,
              dateFrom: optionalString(payload.dateFrom),
              dateTo: optionalString(payload.dateTo),
              force: payload.force === true,
            });
            let downloadUrl: string | null = null;
            try {
              downloadUrl = await createSignedArtifactUrl({ path: artifact.storagePath });
            } catch {
              downloadUrl = null;
            }
            if (ledgerJobId) {
              const { updateJobProgress } = await import("@/lib/queue/ledger");
              await updateJobProgress(
                ledgerJobId,
                {
                  result: {
                    reportId: artifact.reportId,
                    kind: artifact.kind,
                    downloadUrl,
                    downloadPath: artifact.downloadPath,
                    reused: artifact.reused,
                    bytes: artifact.bytes,
                  },
                },
                { completed: 1, total: 1 },
                { force: true }
              );
            }
            return { ok: true };
          }

          const scanBatchId = optionalString(payload.scanBatchId);
          if (!scanBatchId) return permanent("scanBatchId required for artifacts");
          const { generateScanArtifact } = await import(
            "@/lib/reporting/pdf/generate-scan-artifacts"
          );
          const limitRaw = payload.competitorLimit;
          const competitorLimit =
            limitRaw === "all" || limitRaw === 10 || limitRaw === 20
              ? limitRaw
              : 20;
          const artifact = await generateScanArtifact({
            businessId,
            scanBatchId,
            kind: artifactKind as import("@/lib/reporting/pdf/constants").ReportArtifactKind,
            competitorLimit,
            force: payload.force === true,
          });
          let downloadUrl: string | null = null;
          try {
            downloadUrl = await createSignedArtifactUrl({ path: artifact.storagePath });
          } catch {
            downloadUrl = null;
          }
          if (ledgerJobId) {
            const { updateJobProgress } = await import("@/lib/queue/ledger");
            await updateJobProgress(
              ledgerJobId,
              {
                result: {
                  reportId: artifact.reportId,
                  kind: artifact.kind,
                  downloadUrl,
                  downloadPath: artifact.downloadPath,
                  reused: artifact.reused,
                  bytes: artifact.bytes,
                },
              },
              { completed: 1, total: 1 },
              { force: true }
            );
          }
          return { ok: true };
        }

        const reportType = optionalString(payload.reportType) ?? "single_scan";
        try {
          const result = await generateTypedReport({
            businessId,
            scanBatchId: optionalString(payload.scanBatchId),
            reportType: reportType as import("@/lib/reporting/types").ReportType,
            keywordId: optionalString(payload.keywordId),
            locationId: optionalString(payload.locationId),
            campaignId: optionalString(payload.campaignId),
            gridSize: typeof payload.gridSize === "number" ? payload.gridSize : undefined,
            radiusMeters:
              typeof payload.radiusMeters === "number" ? payload.radiusMeters : undefined,
            selectedCompetitorKeys: Array.isArray(payload.selectedCompetitorKeys)
              ? (payload.selectedCompetitorKeys as string[])
              : undefined,
            dateFrom: optionalString(payload.dateFrom),
            dateTo: optionalString(payload.dateTo),
            workCompleted: optionalString(payload.workCompleted),
            freelancerNotes: optionalString(payload.freelancerNotes),
            nextSteps: optionalString(payload.nextSteps),
            periodLabel: optionalString(payload.periodLabel),
            publishStatus:
              payload.publishStatus === "draft" || payload.publishStatus === "published"
                ? payload.publishStatus
                : null,
            persist: payload.persist !== false,
            reportId: optionalString(payload.reportId),
            shareToken: optionalString(payload.shareToken),
            identityKey: optionalString(payload.identityKey),
            executiveSummary:
              typeof payload.executiveSummary === "string"
                ? payload.executiveSummary
                : null,
            sections:
              payload.sections && typeof payload.sections === "object"
                ? (payload.sections as Partial<Record<string, boolean>>)
                : null,
          });
          if (ledgerJobId) {
            const { updateJobProgress } = await import("@/lib/queue/ledger");
            await updateJobProgress(
              ledgerJobId,
              {
                result: {
                  reportId: result.reportId,
                  shareToken: result.shareToken,
                  shareUrl: result.shareToken ? `/reports/share/${result.shareToken}` : null,
                  reportType: result.payload.reportType,
                  status: "ready",
                },
              },
              { completed: 1, total: 1 },
              { force: true }
            );
          }
          return { ok: true };
        } catch (err) {
          const reportId = optionalString(payload.reportId);
          if (reportId) {
            const { createServiceClient } = await import("@/lib/db/client");
            const supabase = createServiceClient();
            await supabase
              .from("reports")
              .update({
                artifact_status: "failed",
                error_message: (err instanceof Error ? err.message : String(err)).slice(0, 500),
              })
              .eq("id", reportId)
              .eq("business_id", businessId);
          }
          throw err;
        }
      }
      case "gbp_audit_module": {
        const businessId = String(payload.businessId ?? "");
        const module = String(payload.module ?? "");
        const organizationId = String(payload.organizationId ?? "");
        if (!businessId || !module || !organizationId) {
          return permanent("gbp_audit_module payload incomplete");
        }
        await requireBusinessOrg(businessId, organizationId);
        const { executeAuditModule, isAuditModule } = await import("@/lib/audit/run-module");
        if (!isAuditModule(module)) return permanent("Unknown GBP audit module");
        const result = await executeAuditModule({
          businessId,
          module,
          keyword: optionalString(payload.keyword),
        });
        const ledgerJobId =
          (typeof payload.ledgerJobId === "string" && payload.ledgerJobId) ||
          (typeof payload.jobId === "string" && payload.jobId) ||
          null;
        if (ledgerJobId) {
          const { updateJobProgress } = await import("@/lib/queue/ledger");
          await updateJobProgress(
            ledgerJobId,
            { result, module },
            { completed: 1, total: 1 },
            { force: true }
          );
          const supabase = createServiceClient();
          await supabase
            .from("job_queue")
            .update({ result_ref: `module_audits:${businessId}:${module}` })
            .eq("id", ledgerJobId);
        }
        return { ok: true };
      }
      case "data_retention": {
        await maybeRunDataRetentionCleanup();
        return { ok: true };
      }
      case "qr_anonymous_cleanup": {
        const { cleanupAbandonedAnonymousQrProjects } = await import(
          "@/lib/reputation/qr-campaigns"
        );
        await cleanupAbandonedAnonymousQrProjects();
        return { ok: true };
      }
      case "qr_daily_stats_reconcile": {
        // Counters are updated on each scan; this job is a no-op placeholder for
        // future backfills. Keeps the job type registered for schedulers.
        return { ok: true };
      }
      default:
        return permanent(`No handler registered for job type ${jobType}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("job_handler_failed", { jobType, error: message });
    // Do not release reservedUsage on retryable errors — processor releases only on terminal failure.
    if (PERMANENT_PATTERN.test(message)) {
      return { ok: false, permanent: true, error: message };
    }
    return { ok: false, permanent: false, error: message };
  }
}

function permanent(error: string): JobHandlerResult {
  return { ok: false, permanent: true, error };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

/**
 * Resolve organization from the business row in Postgres — never trust payload alone.
 * When both businessId and organizationId are present, they must match.
 */
async function resolveOrgId(payload: JobHandlerPayload): Promise<string | undefined> {
  if (typeof payload.businessId === "string" && payload.businessId) {
    const supabase = createServiceClient();
    const { data: biz } = await supabase
      .from("businesses")
      .select("organization_id")
      .eq("id", payload.businessId)
      .maybeSingle();
    const dbOrg = (biz?.organization_id as string | undefined) ?? undefined;
    if (!dbOrg) return undefined;
    if (
      typeof payload.organizationId === "string" &&
      payload.organizationId &&
      payload.organizationId !== dbOrg
    ) {
      throw new Error("Tenant mismatch: business does not belong to organization");
    }
    return dbOrg;
  }
  if (typeof payload.organizationId === "string" && payload.organizationId) {
    return payload.organizationId;
  }
  return undefined;
}

/** Require business∈organization from DB before expensive or side-effecting work. */
async function requireBusinessOrg(
  businessId: string,
  organizationId: string
): Promise<{ businessId: string; organizationId: string }> {
  const supabase = createServiceClient();
  const { data: biz } = await supabase
    .from("businesses")
    .select("id, organization_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz || biz.organization_id !== organizationId) {
    throw new Error("Tenant mismatch: business does not belong to organization");
  }
  return { businessId, organizationId: biz.organization_id as string };
}
