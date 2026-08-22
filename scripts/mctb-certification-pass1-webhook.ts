/**
 * MCTB Pass 1 — TFV webhook production verification (re-run after deploy).
 *
 * Probes the live /api/twilio/toll-free-verification endpoint and validates
 * signature behavior. Does NOT mark B-02 LIVE_VERIFIED unless all checks pass.
 *
 * Usage:
 *   MESSAGING_PROVIDER=twilio npx tsx scripts/mctb-certification-pass1-webhook.ts
 *   MESSAGING_PROVIDER=twilio npx tsx scripts/mctb-certification-pass1-webhook.ts \
 *     --workspace-id cmt3m55zl0p2f5o1l16604i73
 *
 * Env:
 *   CERT_WEBHOOK_URL — override probe URL (defaults to getWebhookUrls().tollFreeVerification)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import twilio from "twilio";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import {
  getTfvStatusForWorkspace,
  syncTrialTollFreeVerification,
} from "@/lib/mctb/tfv/service";
import { fetchTwilioTollFreeVerification } from "@/lib/messaging/twilio/toll-free-verification";
import { getTwilioParentCredentials, getWebhookUrls } from "@/lib/messaging/twilio-config";
import { getMessagingProviderName } from "@/lib/messaging/provider-config";
import { buildMctbTfvExternalReferenceId } from "@/lib/mctb/tfv/external-reference";
import { mergeTfvStatuses } from "@/lib/mctb/tfv/state-update";
import type { TollFreeVerificationStatus } from "@/lib/messaging/compliance/messaging-compliance";

process.env.MESSAGING_PROVIDER = "twilio";

type Status = "PASS" | "FAIL" | "PENDING";
type Check = { name: string; status: Status; detail: string; matrixIds?: string[] };

const RESULTS_PATH = join(process.cwd(), "scripts/mctb-certification-results.json");
const args = process.argv.slice(2);
const workspaceId =
  args.includes("--workspace-id") ? args[args.indexOf("--workspace-id") + 1] : "cmt3m55zl0p2f5o1l16604i73";

const checks: Check[] = [];

function record(check: Check) {
  checks.push(check);
  const icon = check.status === "PASS" ? "✓" : check.status === "FAIL" ? "✗" : "…";
  console.log(`${icon} ${check.name}: ${check.status}`);
  console.log(`    ${check.detail}`);
}

async function postWebhook(
  url: string,
  params: Record<string, string>,
  signature?: string,
): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(signature ? { "X-Twilio-Signature": signature } : {}),
    },
    body: new URLSearchParams(params).toString(),
    redirect: "manual",
  });
  return { status: res.status, body: await res.text() };
}

function mergeResults(existing: Record<string, unknown>, patch: Record<string, unknown>) {
  return { ...existing, ...patch, updatedAt: new Date().toISOString() };
}

async function main() {
  console.log("\n══ MCTB Pass 1 — TFV webhook verification ══\n");

  if (getMessagingProviderName() !== "twilio") {
    console.error("Set MESSAGING_PROVIDER=twilio");
    process.exit(1);
  }

  const { authToken } = getTwilioParentCredentials();
  if (!authToken) {
    record({ name: "Twilio auth token", status: "FAIL", detail: "Missing TWILIO auth token" });
    process.exit(1);
  }

  const webhookUrl = process.env.CERT_WEBHOOK_URL?.trim() || getWebhookUrls().tollFreeVerification;
  record({
    name: "Webhook URL configured",
    status: "PASS",
    detail: webhookUrl.replace(/https?:\/\/[^/]+/, "<app-host>"),
  });

  // Route must exist (not 404). Twilio only POSTs; GET may 405/404.
  const noBody = await postWebhook(webhookUrl, {});
  const routeExists = noBody.status !== 404;
  record({
    name: "Endpoint deployed (not HTTP 404)",
    status: routeExists ? "PASS" : "FAIL",
    detail: `POST empty body → HTTP ${noBody.status}`,
    matrixIds: ["B-02"],
  });

  if (!routeExists) {
    console.log("\nHuman action: deploy production build with /api/twilio/toll-free-verification, then re-run.");
    writePass1WebhookResults(false);
    process.exit(1);
  }

  const badSig = await postWebhook(webhookUrl, { Status: "PENDING_REVIEW" }, "invalid-signature");
  record({
    name: "Bad signature rejected",
    status: badSig.status === 403 ? "PASS" : "FAIL",
    detail: `HTTP ${badSig.status} (expected 403)`,
    matrixIds: ["B-02"],
  });

  const tfv = await getTfvStatusForWorkspace(workspaceId);
  const phoneNumberId = tfv.phoneNumberId;
  const extRef = phoneNumberId
    ? buildMctbTfvExternalReferenceId(workspaceId, phoneNumberId)
    : workspaceId;

  const probeParams: Record<string, string> = {
    VerificationSid: tfv.record?.twilioVerificationSid || "TFV_CERT_PROBE",
    Status: "PENDING_REVIEW",
    ExternalReferenceId: extRef,
    TollfreePhoneNumberSid: "",
  };

  const validSig = twilio.getExpectedTwilioSignature(authToken, webhookUrl, probeParams);
  const signed = await postWebhook(webhookUrl, probeParams, validSig);
  const signedOk = signed.status === 200;
  record({
    name: "Valid Twilio signature accepted",
    status: signedOk ? "PASS" : "FAIL",
    detail: `HTTP ${signed.status}`,
    matrixIds: ["B-02"],
  });

  if (signedOk && tfv.record?.twilioVerificationSid) {
    let parsed: { matched?: boolean } = {};
    try {
      parsed = JSON.parse(signed.body) as { matched?: boolean };
    } catch {
      /* ignore */
    }
    record({
      name: "Webhook resolves TFV/workspace",
      status: parsed.matched === true || signed.body.includes("matched") ? "PASS" : "PENDING",
      detail: signed.body.slice(0, 200),
      matrixIds: ["B-02"],
    });
  }

  if (tfv.record?.twilioVerificationSid) {
    const reg = await getRegistrationByWorkspace(workspaceId);
    if (reg) {
      const remoteBefore = await fetchTwilioTollFreeVerification({
        reg,
        verificationSid: tfv.record.twilioVerificationSid,
      });
      await syncTrialTollFreeVerification(workspaceId);
      const after = await getTfvStatusForWorkspace(workspaceId);
      const pollMatches =
        after.status === remoteBefore.mapped ||
        (after.status === "PENDING" && remoteBefore.mapped === "PENDING");
      record({
        name: "Poll sync matches Twilio provider state",
        status: pollMatches ? "PASS" : "PENDING",
        detail: `Twilio=${remoteBefore.status} mapped=${remoteBefore.mapped} Transovo=${after.status}`,
        matrixIds: ["B-01", "B-02"],
      });
    }
  }

  // Stale callback cannot regress APPROVED (local canonical merge — already unit-tested).
  const staleBlocked = mergeTfvStatuses("APPROVED", "PENDING") === "APPROVED";
  record({
    name: "Stale callback cannot regress APPROVED (merge policy)",
    status: staleBlocked ? "PASS" : "FAIL",
    detail: "mergeTfvStatuses(APPROVED, PENDING) === APPROVED",
    matrixIds: ["B-06"],
  });

  const b02Pass = checks.filter((c) => c.matrixIds?.includes("B-02")).every((c) => c.status === "PASS");
  const b01Approved = tfv.approved;

  console.log("\n── Summary ──");
  console.log(`B-02 webhook production proof: ${b02Pass ? "PASS" : "NOT YET"}`);
  console.log(`B-01 TFV lifecycle: ${b01Approved ? "APPROVED" : `PENDING (${tfv.status})`}`);
  console.log(
    b01Approved
      ? "Human: confirm status changed without DB edit (check tfvApprovedAt in onboarding state)."
      : "Human: wait for Twilio PENDING_REVIEW → APPROVED; re-run this script after approval.",
  );

  writePass1WebhookResults(b02Pass);
  process.exit(checks.some((c) => c.status === "FAIL") ? 1 : 0);
}

function writePass1WebhookResults(b02Pass: boolean) {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    /* fresh */
  }

  const items = (existing.items as Record<string, unknown>) || {};
  items["B-02"] = b02Pass
    ? {
        status: "LIVE_VERIFIED",
        verifiedAt: new Date().toISOString(),
        note: "Production TFV webhook deployed; signature + routing verified",
      }
    : {
        status: "MANUAL_HUMAN_TEST_REQUIRED",
        lastRunAt: new Date().toISOString(),
        note: "Deploy /api/twilio/toll-free-verification and re-run pass1-webhook script",
        checks,
      };

  const payload = mergeResults(existing, {
    verifiedBy: "mctb-certification-pass1-webhook.ts",
    pass1Webhook: { executedAt: new Date().toISOString(), checks },
    pass1Status: "PARTIAL",
    pass1Remaining: [
      ...(b02Pass ? [] : ["B-02 production webhook proof"]),
      "B-01 TFV approval via poll/webhook without DB edit",
    ],
    items,
  });

  writeFileSync(RESULTS_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
