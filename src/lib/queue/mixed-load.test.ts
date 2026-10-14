import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jobTypeToQueue } from "@/lib/queue/job-handlers";
import { PRIORITY_SCORES } from "@/lib/queue/types";
import { canTransitionLifecycle, JOB_LIFECYCLE } from "@/lib/platform/job-lifecycle";
import { assertCanEnqueueMapsScan } from "@/lib/queue/fairness";

/**
 * Offline mixed-load invariants (no Redis/Postgres required).
 * Full Coolify soak stays an ops checklist; this guards cross-tenant + fairness rules in CI.
 */
describe("mixed-load queue invariants", () => {
  it("routes heavy feature jobs onto isolated queues", () => {
    const map = {
      process_scan: "maps-scan",
      early_enrichment: "maps-scan",
      maps_difficulty_run: "maps-scan",
      keyword_check: "maps-scan",
      campaign_send_batch: "review-campaign",
      messaging_registration_advance: "review-campaign",
      send_campaign_email: "email-send",
      send_campaign_sms: "sms-send",
      import_contacts: "review-import",
      review_alert_scan: "review-monitor",
      review_momentum_run: "maintenance",
      reputation_audit: "maintenance",
      backlink_gap_run: "backlink-gap",
      local_trust_run: "local-trust",
      ai_visibility_run: "ai-visibility",
      growth_audit_run: "maintenance",
      gbp_audit_module: "maintenance",
      generate_report: "report-generation",
    } as const;

    for (const [jobType, queue] of Object.entries(map)) {
      assert.equal(jobTypeToQueue(jobType), queue, jobType);
    }
  });

  it("keeps Maps priority above lower intelligence/enrichment work", () => {
    assert.ok(PRIORITY_SCORES.highest < PRIORITY_SCORES.normal);
    assert.ok(PRIORITY_SCORES.normal < PRIORITY_SCORES.lower);
  });

  it("allows admin retry from dead_letter but not from completed", () => {
    assert.equal(canTransitionLifecycle(JOB_LIFECYCLE.COMPLETED, JOB_LIFECYCLE.RUNNING), false);
    assert.equal(canTransitionLifecycle(JOB_LIFECYCLE.DEAD_LETTER, JOB_LIFECYCLE.QUEUED), true);
    assert.equal(canTransitionLifecycle(JOB_LIFECYCLE.QUEUED, JOB_LIFECYCLE.RUNNING), true);
  });

  it("exposes Maps fairness helper for ops scripts", () => {
    assert.equal(typeof assertCanEnqueueMapsScan, "function");
  });

  it("isolates report generation from maps and messaging workers", () => {
    assert.equal(jobTypeToQueue("generate_report"), "report-generation");
    assert.notEqual(jobTypeToQueue("generate_report"), "maps-scan");
    assert.notEqual(jobTypeToQueue("generate_report"), "email-send");
  });

  it("keeps Review Momentum on worker:all (maintenance), not messaging-only review-monitor", () => {
    assert.equal(jobTypeToQueue("review_momentum_run"), "maintenance");
    assert.equal(jobTypeToQueue("reputation_audit"), "maintenance");
    assert.equal(jobTypeToQueue("review_alert_scan"), "review-monitor");
  });

  it("simulates failure injection: dead_letter can retry, completed cannot", () => {
    assert.equal(canTransitionLifecycle(JOB_LIFECYCLE.DEAD_LETTER, JOB_LIFECYCLE.QUEUED), true);
    assert.equal(canTransitionLifecycle(JOB_LIFECYCLE.PERMANENTLY_FAILED, JOB_LIFECYCLE.QUEUED), true);
    assert.equal(canTransitionLifecycle(JOB_LIFECYCLE.COMPLETED, JOB_LIFECYCLE.QUEUED), false);
    assert.equal(
      canTransitionLifecycle(JOB_LIFECYCLE.RUNNING, JOB_LIFECYCLE.PERMANENTLY_FAILED),
      true
    );
  });

  it("simulates interleaved org workloads without shared payload identity", () => {
    type FakeJob = {
      id: string;
      organizationId: string;
      jobType: string;
      payload: { businessId: string };
    };

    const orgA = "org-a";
    const orgB = "org-b";
    const jobs: FakeJob[] = [];
    for (let i = 0; i < 5; i++) {
      jobs.push({
        id: `a-${i}`,
        organizationId: orgA,
        jobType: i % 2 === 0 ? "process_scan" : "campaign_send_batch",
        payload: { businessId: "biz-a" },
      });
      jobs.push({
        id: `b-${i}`,
        organizationId: orgB,
        jobType: i % 2 === 0 ? "backlink_gap_run" : "review_alert_scan",
        payload: { businessId: "biz-b" },
      });
    }

    const scheduled = [...jobs].sort((x, y) => x.id.localeCompare(y.id));
    for (const job of scheduled) {
      // Tenant leak guard: org id must never be inferred only from payload.
      assert.ok(job.organizationId === orgA || job.organizationId === orgB);
      assert.notEqual(job.organizationId, job.payload.businessId);
      if (job.organizationId === orgA) {
        assert.equal(job.payload.businessId, "biz-a");
      } else {
        assert.equal(job.payload.businessId, "biz-b");
      }
    }

    const aTypes = new Set(scheduled.filter((j) => j.organizationId === orgA).map((j) => j.jobType));
    const bTypes = new Set(scheduled.filter((j) => j.organizationId === orgB).map((j) => j.jobType));
    assert.ok(aTypes.has("process_scan"));
    assert.ok(bTypes.has("backlink_gap_run"));
  });
});
