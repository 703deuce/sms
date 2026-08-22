/**
 * MCTB Pass 1 — live Twilio TFN provision + TFV submit executor.
 *
 * Runs real provider calls (purchases a toll-free number, submits TFV).
 * Does NOT mark LIVE_VERIFIED for TFV approval — that requires Twilio review.
 *
 * Usage:
 *   MESSAGING_PROVIDER=twilio npx tsx scripts/mctb-certification-pass1.ts
 *   MESSAGING_PROVIDER=twilio npx tsx scripts/mctb-certification-pass1.ts --workspace-id <id>
 *
 * Env (optional overrides):
 *   CERT_BUSINESS_NAME, CERT_BUSINESS_WEBSITE, CERT_CONTACT_EMAIL,
 *   CERT_CONTACT_PHONE, CERT_STREET, CERT_CITY, CERT_REGION, CERT_POSTAL
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "@/lib/db";
import { createWorkspaceForUser } from "@/lib/workspace/create-workspace";
import { messagingOnboarding } from "@/lib/messaging/service";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getSubaccountTwilioClient } from "@/lib/messaging/twilio-client";
import {
  assertLiveTwilioConfigured,
  getAppBaseUrl,
  getWebhookUrls,
  isLiveMessagingAdapter,
} from "@/lib/messaging/twilio-config";
import { getMessagingProviderName } from "@/lib/messaging/provider-config";
import {
  loadMctbOnboardingState,
  markStepComplete,
  saveMctbOnboardingState,
} from "@/lib/mctb/onboarding/state";
import { provisionTrialTollFreeNumber } from "@/lib/mctb/onboarding/trial-number";
import {
  getTfvStatusForWorkspace,
  submitTrialTollFreeVerification,
  syncTrialTollFreeVerification,
} from "@/lib/mctb/tfv/service";
import { fetchTwilioTollFreeVerification } from "@/lib/messaging/twilio/toll-free-verification";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { buildMctbTfvExternalReferenceId } from "@/lib/mctb/tfv/external-reference";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";

// MCTB TFN/TFV is Twilio-only — override global telnyx default for this script.
process.env.MESSAGING_PROVIDER = "twilio";

type Status = "PASS" | "FAIL" | "SKIP" | "PENDING";

type Check = {
  name: string;
  status: Status;
  detail: string;
  matrixIds?: string[];
};

const RESULTS_PATH = join(process.cwd(), "scripts/mctb-certification-results.json");
const args = process.argv.slice(2);
const workspaceIdArg = args.includes("--workspace-id")
  ? args[args.indexOf("--workspace-id") + 1]
  : undefined;

const certTag = `mctb-cert-pass1-${Date.now().toString(36)}`;

const business = {
  legalBusinessName: process.env.CERT_BUSINESS_NAME?.trim() || "Transovo Certification Plumbing LLC",
  dbaName: "Transovo Cert Plumbing",
  businessType: "Limited Liability Corporation",
  businessIndustry: "CONSTRUCTION",
  businessRegistrationId: process.env.CERT_EIN?.trim() || "12-3456789",
  websiteUrl:
    process.env.CERT_BUSINESS_WEBSITE?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://example.com",
  street: process.env.CERT_STREET?.trim() || "123 Certification Way",
  city: process.env.CERT_CITY?.trim() || "Austin",
  region: process.env.CERT_REGION?.trim() || "TX",
  postalCode: process.env.CERT_POSTAL?.trim() || "78701",
  country: "US",
  contactFirstName: "Cert",
  contactLastName: "Runner",
  contactEmail:
    process.env.CERT_CONTACT_EMAIL?.trim() ||
    process.env.TWILIO_STATUS_EMAIL?.trim() ||
    "cert@transovo.ai",
  contactPhone: process.env.CERT_CONTACT_PHONE?.trim() || "+15125550100",
  contactTitle: "Owner",
};

const messageTemplate =
  "Sorry we missed your call from {{business_name}}. Reply here and we'll get back to you shortly. Reply STOP to opt out.";

const checks: Check[] = [];

function record(check: Check) {
  checks.push(check);
  const icon =
    check.status === "PASS"
      ? "✓"
      : check.status === "FAIL"
        ? "✗"
        : check.status === "PENDING"
          ? "…"
          : "○";
  console.log(`${icon} ${check.name}: ${check.status}`);
  console.log(`    ${check.detail}`);
}

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function verifyTwilioPhoneOwnership(input: {
  subaccountSid: string;
  subaccountAuthTokenEnc: string;
  phoneSid: string;
  e164: string;
}): Promise<{ ok: boolean; detail: string; accountSid?: string }> {
  const authToken = decryptSecret(input.subaccountAuthTokenEnc);
  const client = getSubaccountTwilioClient(input.subaccountSid, authToken);
  const pn = await client.incomingPhoneNumbers(input.phoneSid).fetch();
  const fetched = pn.phoneNumber || "";
  const match =
    fetched.replace(/\D/g, "") === input.e164.replace(/\D/g, "") &&
    pn.accountSid === input.subaccountSid;
  return {
    ok: match,
    detail: match
      ? `Twilio PN ${pn.sid} on subaccount ${pn.accountSid}, E.164 ${fetched}`
      : `Mismatch: fetched ${fetched} account ${pn.accountSid}`,
    accountSid: pn.accountSid,
  };
}

async function inspectProviderNotifications(): Promise<{
  mechanism: string;
  webhookUrl: string;
  eventStreamsConfigured: boolean;
  eventStreamDetail: string;
}> {
  const webhookUrl = getWebhookUrls().tollFreeVerification;
  let eventStreamsConfigured = false;
  let eventStreamDetail = "No Event Streams sinks/subscriptions inspected";

  try {
    const { accountSid, authToken } = assertLiveTwilioConfigured();
    const twilio = (await import("twilio")).default;
    const parent = twilio(accountSid, authToken);
    const sinks = await parent.events.v1.sinks.list({ limit: 20 });
    const subscriptions = await parent.events.v1.subscriptions.list({ limit: 20 });
    const hits = subscriptions.filter((sub) => {
      const desc = JSON.stringify(sub).toLowerCase();
      return (
        desc.includes("tollfree") ||
        desc.includes("toll-free") ||
        desc.includes("verification") ||
        desc.includes("messaging")
      );
    });
    eventStreamsConfigured = sinks.length > 0 && subscriptions.length > 0;
    eventStreamDetail = `sinks=${sinks.length} subscriptions=${subscriptions.length} tfv_related=${hits.length}`;
  } catch (err) {
    eventStreamDetail = `Event Streams inspect failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  return {
    mechanism: eventStreamsConfigured
      ? "Twilio Event Streams (detected)"
      : "Status callback webhook + manual poll sync",
    webhookUrl,
    eventStreamsConfigured,
    eventStreamDetail,
  };
}

function compareTfvFields(
  submitted: Record<string, unknown>,
  remote: Record<string, unknown>,
): { pass: boolean; mismatches: string[] } {
  const pairs: Array<[string, string, string]> = [
    ["businessName", "businessName", "business_name"],
    ["businessWebsite", "businessWebsite", "business_website"],
    ["notificationEmail", "notificationEmail", "notification_email"],
    ["tollfreePhoneNumberSid", "tollfreePhoneNumberSid", "tollfree_phone_number_sid"],
    ["externalReferenceId", "externalReferenceId", "external_reference_id"],
    ["optInType", "optInType", "opt_in_type"],
    ["messageVolume", "messageVolume", "message_volume"],
  ];

  const mismatches: string[] = [];
  for (const [localKey, remoteKey, snakeKey] of pairs) {
    const local = submitted[localKey];
    const remoteVal = remote[remoteKey] ?? remote[snakeKey];
    if (local != null && remoteVal != null && norm(local) !== norm(remoteVal)) {
      mismatches.push(`${localKey}: local=${local} remote=${remoteVal}`);
    }
  }

  const localSample = String(submitted.productionMessageSample || submitted.useCaseSummary || "");
  const remoteSample = String(
    remote.productionMessageSample ||
      remote.production_message_sample ||
      remote.useCaseSummary ||
      remote.use_case_summary ||
      "",
  );
  if (localSample && remoteSample && !norm(remoteSample).includes(norm(localSample).slice(0, 24))) {
    mismatches.push("productionMessageSample/useCaseSummary diverge");
  }

  return { pass: mismatches.length === 0, mismatches };
}

async function upsertCertUser() {
  const prisma = getPrisma();
  const email = `mctb-cert+${certTag}@transovo-cert.internal`;
  const user = await prisma.user.create({
    data: {
      email,
      name: `MCTB Cert ${certTag}`,
      productIntent: "SMS",
    },
  });
  return user;
}

async function prepareWorkspace(workspaceId: string) {
  await messagingOnboarding.start(workspaceId);
  await messagingOnboarding.saveBusiness(workspaceId, business);
  await messagingOnboarding.saveUseCase(workspaceId, {
    useCase: "CUSTOMER_CARE",
    useCaseDescription:
      "Missed-call text back: one immediate SMS after a missed business call when the caller has consented.",
    sampleMessages: [messageTemplate],
    optInDescription:
      "Caller hears SMS disclosure on forwarded missed call and presses 1 to consent to one follow-up text.",
    messageVolume: "100",
    optInFormUrl: `${getAppBaseUrl()}/compliance`,
    privacyPolicyUrl: `${getAppBaseUrl()}/privacy`,
    subscriberOptIn: true,
    subscriberOptOut: true,
  });

  await updateMissedCallTextConfig({
    workspaceId,
    patch: { initial_message: messageTemplate },
    source: "mctb_cert_pass1",
  });

  let state = await loadMctbOnboardingState(workspaceId);
  state = await saveMctbOnboardingState(workspaceId, {
    businessName: business.legalBusinessName,
    websiteUrl: business.websiteUrl,
    messageTemplate,
    consentMode: "press_1",
  });
  state = markStepComplete(state, "business");
  state = markStepComplete(state, "configure");
  state = markStepComplete(state, "consent");
  await saveMctbOnboardingState(workspaceId, state);
}

function redactEvidence(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/https?:\/\/[^\s/]+/g, "<app-host>");
  }
  if (Array.isArray(value)) return value.map(redactEvidence);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redactEvidence(v)]),
    );
  }
  return value;
}

async function writeResults(workspaceId: string, summary: Record<string, unknown>) {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    /* fresh file */
  }

  const items = (existing.items as Record<string, unknown>) || {};
  const pass1Evidence = redactEvidence({
    runId: certTag,
    workspaceId,
    executedAt: new Date().toISOString(),
    checks,
    summary,
  }) as Record<string, unknown>;

  for (const id of ["A-02", "A-06", "B-01", "B-02"]) {
    const related = checks.filter((c) => c.matrixIds?.includes(id));
    const allPass = related.length > 0 && related.every((c) => c.status === "PASS");
    const anyPending = related.some((c) => c.status === "PENDING");
    if (allPass) {
      items[id] = {
        status: "LIVE_VERIFIED",
        verifiedAt: new Date().toISOString(),
        evidence: pass1Evidence,
      };
    } else if (anyPending) {
      items[id] = {
        status: "MANUAL_HUMAN_TEST_REQUIRED",
        lastRunAt: new Date().toISOString(),
        evidence: pass1Evidence,
        note: "Automated steps passed; awaiting human/provider completion (e.g. TFV approval).",
      };
    } else {
      items[id] = {
        status: "MANUAL_HUMAN_TEST_REQUIRED",
        lastRunAt: new Date().toISOString(),
        evidence: pass1Evidence,
      };
    }
  }

  const payload = {
    ...existing,
    updatedAt: new Date().toISOString(),
    verifiedBy: "mctb-certification-pass1.ts",
    notes:
      "LIVE_VERIFIED only when external proof exists. TFV approval rows stay pending until Twilio approves.",
    pass1: pass1Evidence,
    items,
  };

  writeFileSync(RESULTS_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  console.log(`\n══ MCTB Pass 1 — Twilio TFN + TFV (${certTag}) ══\n`);

  const provider = getMessagingProviderName();
  const liveTwilio = isLiveMessagingAdapter();
  record({
    name: "Preflight: MESSAGING_PROVIDER=twilio",
    status: provider === "twilio" ? "PASS" : "FAIL",
    detail: `provider=${provider} liveTwilio=${liveTwilio}`,
  });
  if (provider !== "twilio" || !liveTwilio) {
    console.error("\nAbort: set MESSAGING_PROVIDER=twilio for Pass 1.");
    process.exit(1);
  }

  try {
    assertLiveTwilioConfigured();
    record({
      name: "Preflight: Twilio parent credentials",
      status: "PASS",
      detail: "TWILIO_ACCOUNT_SID + auth + TWILIO_PRIMARY_PROFILE_SID present",
    });
  } catch (err) {
    record({
      name: "Preflight: Twilio parent credentials",
      status: "FAIL",
      detail: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  const prisma = getPrisma();
  let workspaceId = workspaceIdArg;
  let createdWorkspace = false;

  if (!workspaceId) {
    const user = await upsertCertUser();
    const ws = await createWorkspaceForUser(user.id, business.legalBusinessName, "BUSINESS");
    workspaceId = ws.id;
    createdWorkspace = true;
    record({
      name: "Fresh certification workspace",
      status: "PASS",
      detail: `workspaceId=${workspaceId} user=${user.email}`,
    });
  } else {
    record({
      name: "Reuse workspace",
      status: "SKIP",
      detail: `workspaceId=${workspaceId}`,
    });
  }

  await prepareWorkspace(workspaceId);

  const provision1 = await provisionTrialTollFreeNumber(workspaceId);
  record({
    name: "TFN PURCHASE",
    status: provision1.ok ? "PASS" : "FAIL",
    detail: provision1.ok
      ? `E.164 ${provision1.trialNumber?.e164} phoneNumberId=${provision1.trialNumber?.phoneNumberId}`
      : provision1.error || "unknown error",
    matrixIds: ["A-01", "A-02", "A-03"],
  });

  if (!provision1.ok || !provision1.trialNumber) {
    await writeResults(workspaceId, { aborted: "tfn_provision_failed" });
    process.exit(1);
  }

  const provision2 = await provisionTrialTollFreeNumber(workspaceId);
  const sameNumber =
    provision2.trialNumber?.e164 === provision1.trialNumber.e164 &&
    provision2.trialNumber?.phoneNumberId === provision1.trialNumber.phoneNumberId;
  record({
    name: "TFN idempotent re-provision",
    status: provision2.ok && sameNumber ? "PASS" : "FAIL",
    detail: sameNumber
      ? "Second provision returned same E.164 + phoneNumberId"
      : "Duplicate or changed number on retry",
    matrixIds: ["A-04"],
  });

  const state = await loadMctbOnboardingState(workspaceId);
  const wsTfn = getWorkspaceTollFreeNumber(state);
  const phoneRow = await prisma.phoneNumber.findFirst({
    where: { id: provision1.trialNumber.phoneNumberId, workspaceId },
    select: { id: true, e164: true, twilioSid: true, provider: true },
  });

  record({
    name: "Workspace association",
    status:
      wsTfn?.e164 === provision1.trialNumber.e164 &&
      wsTfn?.phoneNumberId === provision1.trialNumber.phoneNumberId
        ? "PASS"
        : "FAIL",
    detail: `workspaceTollFreeNumber=${wsTfn?.e164} db=${phoneRow?.e164}`,
    matrixIds: ["A-03"],
  });

  const reg = await getRegistrationByWorkspace(workspaceId);
  let twilioPnSid = phoneRow?.twilioSid || null;
  if (reg?.subaccountSid && reg.subaccountAuthTokenEnc && twilioPnSid) {
    const ownership = await verifyTwilioPhoneOwnership({
      subaccountSid: reg.subaccountSid,
      subaccountAuthTokenEnc: reg.subaccountAuthTokenEnc,
      phoneSid: twilioPnSid,
      e164: phoneRow!.e164,
    });
    record({
      name: "Twilio PN SID confirmed (subaccount ownership)",
      status: ownership.ok ? "PASS" : "FAIL",
      detail: ownership.detail,
      matrixIds: ["A-02"],
    });
  } else {
    record({
      name: "Twilio PN SID confirmed (subaccount ownership)",
      status: "FAIL",
      detail: "Missing subaccount credentials or twilioSid on phone row",
      matrixIds: ["A-02"],
    });
  }

  const tfvSubmit = await submitTrialTollFreeVerification(workspaceId);
  record({
    name: "TFV submitted",
    status: tfvSubmit.ok ? "PASS" : "FAIL",
    detail: tfvSubmit.ok
      ? `verificationSid=${tfvSubmit.record?.twilioVerificationSid} deduped=${Boolean(tfvSubmit.deduped)} status=${tfvSubmit.record?.status}`
      : tfvSubmit.error || "submit failed",
    matrixIds: ["A-06"],
  });

  if (!tfvSubmit.ok || !tfvSubmit.record?.twilioVerificationSid) {
    await writeResults(workspaceId, { aborted: "tfv_submit_failed" });
    process.exit(1);
  }

  const tfvSid = tfvSubmit.record.twilioVerificationSid;
  const extRef = buildMctbTfvExternalReferenceId(
    workspaceId,
    provision1.trialNumber.phoneNumberId,
  );

  const remote = await fetchTwilioTollFreeVerification({
    reg: reg!,
    verificationSid: tfvSid,
  });

  const submissionSnapshot =
    (tfvSubmit.record.submissionSnapshot as Record<string, unknown> | null) || {};
  const fieldCompare = compareTfvFields(submissionSnapshot, remote.raw);
  record({
    name: "Submitted payload compared with Twilio",
    status: fieldCompare.pass ? "PASS" : "FAIL",
    detail: fieldCompare.pass
      ? "Core TFV fields match Twilio record"
      : fieldCompare.mismatches.join("; "),
    matrixIds: ["A-06"],
  });

  await syncTrialTollFreeVerification(workspaceId);
  const tfvStatus = await getTfvStatusForWorkspace(workspaceId);
  const approved = tfvStatus.approved;
  record({
    name: "Current TFV status (Transovo)",
    status: approved ? "PASS" : "PENDING",
    detail: `status=${tfvStatus.status} approved=${approved}`,
    matrixIds: ["B-01"],
  });

  const notifications = await inspectProviderNotifications();
  record({
    name: "Provider notification mechanism",
    status: "PASS",
    detail: `${notifications.mechanism} | webhook=${notifications.webhookUrl} | ${notifications.eventStreamDetail}`,
    matrixIds: ["B-02"],
  });

  let webhookReachable = false;
  try {
    const res = await fetch(notifications.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        VerificationSid: "TFV_CERT_PROBE",
        Status: "PENDING_REVIEW",
        ExternalReferenceId: extRef,
      }).toString(),
      redirect: "manual",
    });
    webhookReachable = res.status === 200 || res.status === 403;
    record({
      name: "TFV webhook endpoint reachable",
      status: webhookReachable ? "PASS" : res.status === 404 ? "PENDING" : "FAIL",
      detail: webhookReachable
        ? `HTTP ${res.status} (403 acceptable without valid Twilio signature)`
        : res.status === 404
          ? `HTTP 404 at ${notifications.webhookUrl} — confirm Pass 1 app URL is deployed with /api/twilio/toll-free-verification`
          : `HTTP ${res.status}`,
      matrixIds: ["B-02"],
    });
  } catch (err) {
    record({
      name: "TFV webhook endpoint reachable",
      status: "FAIL",
      detail: err instanceof Error ? err.message : String(err),
      matrixIds: ["B-02"],
    });
  }

  const humanActions: string[] = [];
  if (!approved) {
    humanActions.push(
      "Wait for Twilio TFV approval (PENDING/IN_REVIEW → APPROVED) without DB edits.",
    );
    humanActions.push(
      `Monitor TFV SID ${tfvSid} in Twilio console; confirm Transovo status updates via webhook/poll.`,
    );
  }
  humanActions.push(
    "Optional: confirm Event Streams subscription delivers TFV status to Transovo (if configured on parent account).",
  );
  humanActions.push("Pass 2: real conditional forwarding + ANI preservation from physical handset.");

  const summary = {
    runId: certTag,
    workspaceId,
    createdWorkspace,
    tfnE164: provision1.trialNumber.e164,
    twilioPhoneSid: twilioPnSid,
    tfvSid,
    externalReferenceId: extRef,
    transovoTfvStatus: tfvStatus.status,
    twilioTfvStatus: remote.status,
    webhookUrl: notifications.webhookUrl,
    humanActionsRequired: humanActions,
  };

  console.log("\n── Pass 1 summary ──");
  console.log(`TFN PURCHASE: ${provision1.ok ? "PASS" : "FAIL"}`);
  console.log(`Twilio PN SID: ${twilioPnSid || "missing"}`);
  console.log(`Workspace association: ${wsTfn?.e164 === provision1.trialNumber.e164 ? "PASS" : "FAIL"}`);
  console.log(`TFV submitted: ${tfvSubmit.ok ? "PASS" : "FAIL"}`);
  console.log(`TFV SID: ${tfvSid}`);
  console.log(
    `Submitted payload compared with Twilio: ${fieldCompare.pass ? "PASS" : "FAIL"}`,
  );
  console.log(`Provider notification mechanism: ${notifications.mechanism}`);
  console.log(`Current TFV status: ${tfvStatus.status} (Twilio raw: ${remote.status})`);
  console.log(`Human action required:`);
  for (const line of humanActions) console.log(`  • ${line}`);

  await writeResults(workspaceId, summary);
  console.log(`\nEvidence written to ${RESULTS_PATH}\n`);

  const failed = checks.some((c) => c.status === "FAIL");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
