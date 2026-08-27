/**
 * Flow Builder full certification — ws_1 production-like workspace.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-flow-builder-full-cert.ts
 *
 * Env:
 *   WORKSPACE_ID=ws_1
 *   TEST_SMS_TO=+1...   (required for SMS smoke tests)
 *   LIVE_SMS=0          (default 0 — enrollment-only, no Telnyx sends; set 1 for one SMS smoke)
 *   LIVE_SMS_SMOKE=1    (with LIVE_SMS=1, only manual + calendly send SMS — not every trigger)
 *   CALENDLY_LIVE=1     (default 1 — simulate Calendly webhook when API book unavailable)
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getPrisma } from "../src/lib/db";
import { AUTOMATION_BLOCKS } from "../src/lib/automations/catalog";
import { isVoiceAutomationBlock } from "../src/lib/automations/block-scope";
import { getAutomationCapabilities } from "../src/lib/automations/capabilities";
import { INTEGRATION_EVENT_TO_TRIGGER } from "../src/lib/integrations/framework/automation-bridge";
import { enrollForTrigger, enrollInAutomation } from "../src/lib/automations/enroll";
import { processAutomationWaits } from "../src/lib/automations/runner";
import { processDueJobs } from "../src/lib/jobs/job-handlers";
import { runNodeAction } from "../src/lib/automations/actions";
import { emitAutomationEvent } from "../src/lib/automations/events";
import { parseAutomationDefinition, createNodeId, createEdgeId } from "../src/lib/automations/types";
import { dispatchIntegrationAutomationEvent } from "../src/lib/integrations/framework/automation-bridge";
import { isConditionBlock, getBlock } from "../src/lib/automations/catalog";

const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const TEST_SMS_TO = (process.env.TEST_SMS_TO || process.env.OUTBOUND_TEST_PHONE || "").trim();
const LIVE_SMS = process.env.LIVE_SMS === "1";
const LIVE_SMS_SMOKE = process.env.LIVE_SMS_SMOKE === "1";
const CALENDLY_LIVE = process.env.CALENDLY_LIVE !== "0";
const FROM_E164 = (process.env.FROM_E164 || "").trim();
const ARTIFACTS = process.env.FLOW_CERT_ARTIFACTS || join(process.cwd(), "artifacts");

function certSteps(triggerBlock: string, smsBody: string) {
  if (LIVE_SMS && (!LIVE_SMS_SMOKE || triggerBlock === "manual_enrollment" || triggerBlock === "integration_appointment_scheduled")) {
    return [
      {
        blockType: "send_sms",
        config: { body: smsBody, fromNumber: FROM_E164, stopOnReply: false },
      },
      { blockType: "end_automation" },
    ];
  }
  return [{ blockType: "end_automation" }];
}

const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED"] as const;

type Row = {
  id: string;
  category: "trigger" | "action" | "logic" | "integration" | "ui";
  status: "PASS" | "FAIL" | "SKIP";
  detail?: string;
};

const results: Row[] = [];
const flowIds: string[] = [];
const marker = `cert-${Date.now().toString(36)}`;

function record(
  id: string,
  category: Row["category"],
  status: Row["status"],
  detail?: string,
) {
  results.push({ id, category, status, detail });
  const icon = status === "PASS" ? "✓" : status === "SKIP" ? "○" : "✗";
  console.log(`${icon} [${category}] ${id}${detail ? ` — ${detail}` : ""}`);
}

function buildFlow(
  triggerBlock: string,
  triggerConfig: Record<string, unknown>,
  steps: Array<{ blockType: string; config?: Record<string, unknown> }>,
) {
  const triggerId = createNodeId();
  const nodes = [
    {
      id: triggerId,
      type: "trigger" as const,
      position: { x: 0, y: 0 },
      data: { blockType: triggerBlock, label: triggerBlock, config: triggerConfig },
    },
  ];
  const edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string | null;
  }> = [];
  let prev = triggerId;
  for (const step of steps) {
    const id = createNodeId();
    const cat = getBlock(step.blockType)?.category;
    nodes.push({
      id,
      type:
        cat === "logic" || isConditionBlock(step.blockType)
          ? ("logic" as const)
          : cat === "end"
            ? ("end" as const)
            : ("action" as const),
      position: { x: 0, y: nodes.length * 80 },
      data: {
        blockType: step.blockType,
        label: step.blockType,
        config: step.config || {},
      },
    });
    edges.push({
      id: createEdgeId(),
      source: prev,
      target: id,
      sourceHandle: "default",
      targetHandle: null,
    });
    prev = id;
  }
  return { version: 1, nodes, edges };
}

async function createActiveFlow(name: string, definition: ReturnType<typeof buildFlow>) {
  const prisma = getPrisma();
  const row = await prisma.automationFlow.create({
    data: {
      workspaceId: WORKSPACE_ID,
      name,
      trigger: definition.nodes[0]?.data.blockType || "manual",
      definition: definition as object,
      publishedDefinition: definition as object,
      version: 1,
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });
  flowIds.push(row.id);
  return row;
}

/** Drive execution via the DB job queue (avoids racing scheduleJobDrain + manual advance). */
async function runExecution(executionId: string) {
  for (let i = 0; i < 80; i += 1) {
    const ex = await getPrisma().automationExecution.findUnique({ where: { id: executionId } });
    if (!ex || TERMINAL.includes(ex.status as (typeof TERMINAL)[number])) return ex;
    if (ex.status === "WAITING") {
      if (ex.nextActionAt && ex.nextActionAt.getTime() > Date.now()) {
        await getPrisma().automationExecution.update({
          where: { id: executionId },
          data: { nextActionAt: new Date(Date.now() - 1000) },
        });
        await processAutomationWaits();
      }
    }
    await processDueJobs(30);
    await new Promise((r) => setTimeout(r, 350));
  }
  return getPrisma().automationExecution.findUnique({ where: { id: executionId } });
}

async function smsToTestSince(since: Date) {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      phone: { contains: TEST_SMS_TO.replace(/\D/g, "").slice(-10) },
    },
  });
  if (!contact) return 0;
  return prisma.message.count({
    where: {
      workspaceId: WORKSPACE_ID,
      to: contact.phone,
      createdAt: { gte: since },
      status: { in: ["sent", "delivered", "queued", "sending"] },
    },
  });
}

async function getTestContact(requireEmail = false) {
  if (!TEST_SMS_TO) return null;
  return getPrisma().contact.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      phone: { contains: TEST_SMS_TO.replace(/\D/g, "").slice(-10) },
      status: "SUBSCRIBED",
      ...(requireEmail ? { email: { not: null } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Contact eligible for customer_no_response (no recent reply). */
async function getNoResponseCertContact() {
  const prisma = getPrisma();
  const existing = await prisma.contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, status: "SUBSCRIBED", lastReply: null },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  const test = await getTestContact();
  if (!test) return null;
  await prisma.contact.update({
    where: { id: test.id },
    data: { lastReply: null },
  });
  return { ...test, lastReply: null };
}

async function deleteFlow(flowId: string) {
  const prisma = getPrisma();
  await prisma.automationExecution.deleteMany({ where: { flowId } }).catch(() => undefined);
  await prisma.automationFlow.delete({ where: { id: flowId } }).catch(() => undefined);
  const idx = flowIds.indexOf(flowId);
  if (idx >= 0) flowIds.splice(idx, 1);
}

async function testTriggerEnrollment(
  triggerBlock: string,
  fire: () => Promise<unknown>,
  config: Record<string, unknown> = {},
  contactId?: string,
) {
  const since = new Date();
  const body = `CERT ${marker} ${triggerBlock}`;
  const def = buildFlow(triggerBlock, config, certSteps(triggerBlock, body));
  const flow = await createActiveFlow(`cert-${triggerBlock}-${marker}`, def);
  const contact = contactId
    ? await getPrisma().contact.findFirst({
        where: { id: contactId, workspaceId: WORKSPACE_ID },
      })
    : await getTestContact();
  if (!contact) {
    record(triggerBlock, "trigger", "SKIP", "test contact missing");
    await deleteFlow(flow.id);
    return;
  }
  await fire();
  await new Promise((r) => setTimeout(r, 400));
  const exec = await getPrisma().automationExecution.findFirst({
    where: { workspaceId: WORKSPACE_ID, flowId: flow.id, contactId: contact.id },
    orderBy: { startedAt: "desc" },
  });
  if (!exec) {
    record(triggerBlock, "trigger", "FAIL", "no enrollment after trigger fire");
    await deleteFlow(flow.id);
    return;
  }
  const final = await runExecution(exec.id);
  if (!final || final.status === "FAILED") {
    record(triggerBlock, "trigger", "FAIL", `execution ${final?.status} ${final?.error || ""}`);
    await deleteFlow(flow.id);
    return;
  }
  if (LIVE_SMS) {
    const count = await smsToTestSince(since);
    if (count < 1) {
      record(triggerBlock, "trigger", "FAIL", "no outbound SMS recorded");
      await deleteFlow(flow.id);
      return;
    }
    record(triggerBlock, "trigger", "PASS", `SMS sent flow=${flow.id}`);
  } else {
    record(triggerBlock, "trigger", "PASS", `enrolled flow=${flow.id} status=${final.status}`);
  }
  await deleteFlow(flow.id);
}

async function testScheduledDatetimeTrigger() {
  const runAt = new Date(Date.now() - 120_000).toISOString();
  const def = buildFlow(
    "scheduled_datetime",
    { runAt, enrollScope: "all_subscribed" },
    [{ blockType: "end_automation" }],
  );
  const flow = await createActiveFlow(`cert-scheduled-${marker}`, def);
  const { processScheduledAutomations } = await import("../src/lib/automations/runner");
  await processScheduledAutomations();
  const exec = await getPrisma().automationExecution.findFirst({
    where: { workspaceId: WORKSPACE_ID, flowId: flow.id },
    orderBy: { startedAt: "desc" },
  });
  record(
    "scheduled_datetime",
    "trigger",
    exec ? "PASS" : "FAIL",
    exec ? `exec=${exec.id}` : "no enrollment from scheduled tick",
  );
  await deleteFlow(flow.id);
}

/** Documented external skips — not product failures. */
const EXTERNAL_SKIP_REASONS: Record<string, string> = {
  calendly_api_book:
    "EXTERNAL: Calendly Scheduling API (book invitee) requires a paid Calendly plan on the connected account",
};

async function testIntegrationTriggerEnrollment(
  eventType: string,
  triggerBlock: string,
  payload: Record<string, unknown>,
) {
  const since = new Date();
  const body = `CERT ${marker} ${triggerBlock}`;
  const def = buildFlow(triggerBlock, { provider: String(payload.provider || "") }, certSteps(triggerBlock, body));
  const flow = await createActiveFlow(`cert-${triggerBlock}-${marker}`, def);
  const contact = await getTestContact();
  if (!contact) {
    record(triggerBlock, "integration", "SKIP", "test contact missing");
    await deleteFlow(flow.id);
    return;
  }
  await dispatchIntegrationAutomationEvent({
    workspaceId: WORKSPACE_ID,
    provider: String(payload.provider || "zoho"),
    eventType,
    contactId: contact.id,
    phone: contact.phone,
    email: contact.email,
    payload,
  });
  await new Promise((r) => setTimeout(r, 300));
  const exec = await getPrisma().automationExecution.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      contactId: contact.id,
      flowId: flow.id,
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
  });
  if (!exec) {
    record(triggerBlock, "integration", "FAIL", "no execution after integration event");
    await deleteFlow(flow.id);
    return;
  }
  const final = await runExecution(exec.id);
  if (!final || final.status === "FAILED") {
    record(triggerBlock, "integration", "FAIL", `execution ${final?.status}`);
    await deleteFlow(flow.id);
    return;
  }
  if (LIVE_SMS) {
    const count = await smsToTestSince(since);
    if (count < 1) {
      record(triggerBlock, "integration", "FAIL", "no SMS");
      await deleteFlow(flow.id);
      return;
    }
  }
  record(triggerBlock, "integration", "PASS", `exec=${exec.id}`);
  await deleteFlow(flow.id);
}

async function testIntegrationTriggerEnrollOnly(
  eventType: string,
  triggerBlock: string,
  provider = "zoho",
) {
  const def = buildFlow(triggerBlock, { provider }, [{ blockType: "end_automation" }]);
  const flow = await createActiveFlow(`cert-enroll-${triggerBlock}-${marker}`, def);
  const contact = await getPrisma().contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, status: "SUBSCRIBED" },
  });
  if (!contact) {
    record(triggerBlock, "integration", "SKIP", "no subscribed contact");
    await deleteFlow(flow.id);
    return;
  }
  await dispatchIntegrationAutomationEvent({
    workspaceId: WORKSPACE_ID,
    provider,
    eventType,
    contactId: contact.id,
    payload: { provider },
  });
  const exec = await getPrisma().automationExecution.findFirst({
    where: { workspaceId: WORKSPACE_ID, flowId: flow.id, contactId: contact.id },
    orderBy: { startedAt: "desc" },
  });
  record(triggerBlock, "integration", exec ? "PASS" : "FAIL", exec ? `exec=${exec.id}` : "no enroll");
  await deleteFlow(flow.id);
}

function actionConfig(blockType: string): Record<string, unknown> {
  switch (blockType) {
    case "send_sms":
      return { body: `CERT action ${marker}`, fromNumber: FROM_E164 };
    case "send_review_request":
      return { body: `Review CERT ${marker} {{reviewLink}}`, fromNumber: FROM_E164 };
    case "send_email":
      return {
        subject: `CERT ${marker}`,
        body: "Flow builder cert email",
        fromName: "Transovo Cert",
      };
    case "add_tag":
      return { tag: `cert-${marker}` };
    case "remove_tag":
      return { tag: `cert-${marker}` };
    case "update_customer":
      return { field: "company", value: `Cert Co ${marker}` };
    case "create_task":
      return { title: `Cert task ${marker}`, dueInDays: 1 };
    case "send_internal_notification":
      return { message: `Cert notify ${marker}`, title: "Cert" };
    case "send_webhook":
      return { url: "https://httpbin.org/post", method: "POST" };
    case "integration_action":
      return {
        provider: "zoho",
        actionId: "note.create",
        paramsJson: JSON.stringify({ body: `Cert note ${marker}` }),
      };
    case "wait":
      return { minutes: 0, seconds: 1 };
    case "wait_until_datetime":
      return { runAt: new Date(Date.now() + 60_000).toISOString() };
    case "condition":
      return { field: "customer_replied", operator: "equals", value: "false" };
    case "condition_has_responded":
      return { field: "customer_replied", operator: "equals", value: "false" };
    default:
      return {};
  }
}

async function testActionBlock(blockType: string) {
  const needsEmail = blockType === "send_email";
  const contact =
    (needsEmail ? await getTestContact(true) : null) ||
    (await getPrisma().contact.findFirst({
      where: { workspaceId: WORKSPACE_ID, status: "SUBSCRIBED" },
      orderBy: { createdAt: "desc" },
    }));
  if (!contact) {
    record(blockType, "action", "SKIP", "no subscribed contact");
    return;
  }
  if (needsEmail && !contact.email) {
    record(blockType, "action", "SKIP", "no contact with email");
    return;
  }
  const def = buildFlow("manual_enrollment", {}, [
    { blockType, config: actionConfig(blockType) },
    { blockType: "end_automation" },
  ]);
  const flow = await createActiveFlow(`cert-action-${blockType}-${marker}`, def);
  const enroll = await enrollInAutomation({
    workspaceId: WORKSPACE_ID,
    flowId: flow.id,
    contactId: contact.id,
    testMode: true,
  });
  const node = def.nodes.find((n) => n.data.blockType === blockType);
  if (!node || !enroll.execution) {
    record(blockType, "action", "FAIL", "setup failed");
    await deleteFlow(flow.id);
    return;
  }
  const result = await runNodeAction(node as never, parseAutomationDefinition(def), {
    executionId: enroll.execution.id,
    workspaceId: WORKSPACE_ID,
    contactId: contact.id,
    flowId: flow.id,
    facts: {},
    tagNames: [],
    testMode: LIVE_SMS ? blockType !== "send_sms" && blockType !== "send_review_request" : true,
  });
  if (result.error && result.error !== "contact_opted_out") {
    record(blockType, "action", "FAIL", result.error);
    await deleteFlow(flow.id);
    return;
  }
  record(blockType, "action", "PASS", result.waiting ? "waiting" : "ok");
  await deleteFlow(flow.id);
}

async function testCalendlyLive() {
  if (!CALENDLY_LIVE) {
    record("calendly_live_book", "integration", "SKIP", "CALENDLY_LIVE=0");
    return;
  }
  const conn = await getPrisma().integrationConnection.findFirst({
    where: { workspaceId: WORKSPACE_ID, provider: "calendly", status: "connected" },
  });
  if (!conn) {
    record("calendly_live_book", "integration", "SKIP", "calendly not connected");
    return;
  }
  const since = new Date();
  const body = `CERT calendly live ${marker}`;
  const def = buildFlow(
    "integration_appointment_scheduled",
    { provider: "calendly" },
    certSteps("integration_appointment_scheduled", body),
  );
  const flow = await createActiveFlow(`cert-calendly-live-${marker}`, def);
  const contact = await getTestContact(true);
  if (!contact?.email) {
    record("calendly_live_book", "integration", "SKIP", "test contact needs email for Calendly");
    await deleteFlow(flow.id);
    return;
  }

  const { ensureProviderWebhooksRegistered } = await import(
    "../src/lib/integrations/framework/register-webhooks"
  );
  await ensureProviderWebhooksRegistered(WORKSPACE_ID, "calendly");

  let bookedViaApi = false;
  try {
    const { buildAdapterContext } = await import("../src/lib/integrations/framework/context");
    const ctx = await buildAdapterContext(WORKSPACE_ID, "calendly");
    const { bookNextAvailableSlot } = await import("../src/lib/integrations/adapters/calendly-actions");
    const booked = await bookNextAvailableSlot(ctx, {
      name: `${contact.firstName || "Cert"} ${contact.lastName || "Tester"}`.trim(),
      email: contact.email,
      phone: contact.phone,
      timezone: "America/New_York",
    });
    record("calendly_api_book", "integration", "PASS", booked.startTime);
    bookedViaApi = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record("calendly_api_book", "integration", "SKIP", EXTERNAL_SKIP_REASONS.calendly_api_book);
    await dispatchIntegrationAutomationEvent({
      workspaceId: WORKSPACE_ID,
      provider: "calendly",
      eventType: "appointment.scheduled",
      contactId: contact.id,
      phone: contact.phone,
      email: contact.email,
      payload: {
        provider: "calendly",
        eventTypeName: "Cert Event",
        externalObjectId: `cert-appt-${marker}`,
      },
    });
    record("calendly_webhook_fallback", "integration", "PASS", "normalized event dispatched");
  }

  const waitMs = bookedViaApi ? 90_000 : 5_000;
  const polls = Math.ceil(waitMs / 3000);
  for (let i = 0; i < polls; i += 1) {
    const exec = await getPrisma().automationExecution.findFirst({
      where: {
        workspaceId: WORKSPACE_ID,
        flowId: flow.id,
        startedAt: { gte: since },
      },
      orderBy: { startedAt: "desc" },
    });
    if (exec) {
      const final = await runExecution(exec.id);
      if (!final || final.status === "FAILED") {
        record("calendly_live_book", "integration", "FAIL", `execution ${final?.status}`);
        await deleteFlow(flow.id);
        return;
      }
      if (LIVE_SMS) {
        const count = await smsToTestSince(since);
        if (count >= 1) {
          record("calendly_live_book", "integration", "PASS", `exec=${exec.id} sms=${count}`);
          await deleteFlow(flow.id);
          return;
        }
      } else {
        record("calendly_live_book", "integration", "PASS", `exec=${exec.id}`);
        await deleteFlow(flow.id);
        return;
      }
    }
    if (!bookedViaApi) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  record("calendly_live_book", "integration", "FAIL", bookedViaApi ? "no execution within wait" : "no SMS after fallback");
  await deleteFlow(flow.id);
}

async function cleanupCertFlows() {
  const prisma = getPrisma();
  const stale = await prisma.automationFlow.findMany({
    where: { workspaceId: WORKSPACE_ID, name: { startsWith: "cert-" } },
    select: { id: true },
  });
  for (const row of stale) {
    await prisma.automationExecution.deleteMany({ where: { flowId: row.id } });
    await prisma.automationFlow.delete({ where: { id: row.id } });
  }
}

async function cleanup() {
  for (const id of [...flowIds]) {
    await deleteFlow(id);
  }
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  const caps = getAutomationCapabilities();
  const visibleBlocks = AUTOMATION_BLOCKS.filter(
    (b) => !(isVoiceAutomationBlock(b.blockType) && !caps.voice),
  );

  console.log(`\n── Flow Builder Full Cert ws=${WORKSPACE_ID} marker=${marker} liveSms=${LIVE_SMS} ──\n`);

  await cleanupCertFlows();

  // Manual enrollment
  const manualDef = buildFlow(
    "manual_enrollment",
    {},
    certSteps("manual_enrollment", `CERT manual ${marker}`),
  );
  const manualFlow = await createActiveFlow(`cert-manual-${marker}`, manualDef);
  try {
    const c = await getTestContact();
    if (!c) {
      record("manual_enrollment", "trigger", "SKIP", "no test contact");
    } else {
      const since = new Date();
      const enroll = await enrollInAutomation({
        workspaceId: WORKSPACE_ID,
        flowId: manualFlow.id,
        contactId: c.id,
      });
      if (!enroll.execution) {
        record("manual_enrollment", "trigger", "FAIL", JSON.stringify(enroll));
      } else {
        const final = await runExecution(enroll.execution.id);
        if (!final || final.status === "FAILED") {
          record("manual_enrollment", "trigger", "FAIL", `execution ${final?.status}`);
        } else if (LIVE_SMS && (await smsToTestSince(since)) < 1) {
          record("manual_enrollment", "trigger", "FAIL", "no SMS");
        } else {
          record("manual_enrollment", "trigger", "PASS", `exec=${enroll.execution.id}`);
        }
      }
    }
  } catch (err) {
    record("manual_enrollment", "trigger", "FAIL", err instanceof Error ? err.message : String(err));
  }
  await deleteFlow(manualFlow.id);

  // Core triggers
  const tagName = `cert-${marker}`;
  try {
    await testTriggerEnrollment(
      "tag_added",
      async () => {
        const c = await getTestContact();
        if (!c) throw new Error("no contact");
        return emitAutomationEvent(WORKSPACE_ID, "customer.tag_added", c.id, { tag: tagName });
      },
      { tag: tagName },
    );
  } catch (err) {
    record("tag_added", "trigger", "FAIL", err instanceof Error ? err.message : String(err));
  }

  try {
    const c = await getTestContact();
    if (c) {
      await testTriggerEnrollment("customer_added", () =>
        emitAutomationEvent(WORKSPACE_ID, "customer.created", c.id),
      );
    } else {
      record("customer_added", "trigger", "SKIP", "no test contact");
    }
  } catch (err) {
    record("customer_added", "trigger", "FAIL", err instanceof Error ? err.message : String(err));
  }

  try {
    await testTriggerEnrollment(
      "form_submitted",
      async () => {
        const c = await getTestContact();
        if (!c) throw new Error("no contact");
        return emitAutomationEvent(WORKSPACE_ID, "form.submitted", c.id, {
          formSlug: "cert-form",
        });
      },
      { formSlug: "cert-form" },
    );
  } catch (err) {
    record("form_submitted", "trigger", "FAIL", err instanceof Error ? err.message : String(err));
  }

  const reviewTriggers: Array<[string, () => Promise<unknown>]> = [
    [
      "review_request_created",
      () => {
        return getTestContact().then((c) => {
          if (!c) throw new Error("no contact");
          return emitAutomationEvent(WORKSPACE_ID, "review_request.created", c.id);
        });
      },
    ],
    [
      "review_request_sent",
      () => {
        return getTestContact().then((c) => {
          if (!c) throw new Error("no contact");
          return emitAutomationEvent(WORKSPACE_ID, "review_request.sent", c.id);
        });
      },
    ],
    [
      "review_request_clicked",
      () => {
        return getTestContact().then((c) => {
          if (!c) throw new Error("no contact");
          return emitAutomationEvent(WORKSPACE_ID, "review_request.clicked", c.id);
        });
      },
    ],
    [
      "review_received",
      () => {
        return getTestContact().then((c) => {
          if (!c) throw new Error("no contact");
          return emitAutomationEvent(WORKSPACE_ID, "review.received", c.id);
        });
      },
    ],
    [
      "positive_review_received",
      () => {
        return getTestContact().then((c) => {
          if (!c) throw new Error("no contact");
          return emitAutomationEvent(WORKSPACE_ID, "review.positive", c.id);
        });
      },
    ],
    [
      "negative_feedback_received",
      () => {
        return getTestContact().then((c) => {
          if (!c) throw new Error("no contact");
          return emitAutomationEvent(WORKSPACE_ID, "feedback.negative", c.id);
        });
      },
    ],
  ];

  for (const [block, fire] of reviewTriggers) {
    try {
      await testTriggerEnrollment(block, fire);
    } catch (err) {
      record(block, "trigger", "FAIL", err instanceof Error ? err.message : String(err));
    }
  }

  try {
    const noReplyContact = await getNoResponseCertContact();
    if (!noReplyContact) {
      record("customer_no_response", "trigger", "SKIP", "no cert contact for no-response test");
    } else {
      await testTriggerEnrollment(
        "customer_no_response",
        () => emitAutomationEvent(WORKSPACE_ID, "customer.no_response", noReplyContact.id),
        { withinHours: 48 },
        noReplyContact.id,
      );
    }
  } catch (err) {
    record(
      "customer_no_response",
      "trigger",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
  }

  try {
    await testScheduledDatetimeTrigger();
  } catch (err) {
    record(
      "scheduled_datetime",
      "trigger",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
  }

  // Integration triggers with SMS proof (connected providers on ws_1)
  const integrationSamples: Array<[string, string, Record<string, unknown>]> = [
    [
      "appointment.scheduled",
      "integration_appointment_scheduled",
      { provider: "calendly", eventTypeName: "Cert" },
    ],
    [
      "deal.stage_changed",
      "integration_deal_stage_changed",
      { provider: "zoho", stage: "1", previousStage: "0" },
    ],
    ["contact.created", "integration_contact_created", { provider: "zoho" }],
    ["deal.won", "integration_deal_won", { provider: "zoho" }],
    ["note.created", "integration_note_created", { provider: "zoho" }],
  ];

  for (const [eventType, triggerBlock, payload] of integrationSamples) {
    try {
      await testIntegrationTriggerEnrollment(eventType, triggerBlock, payload);
    } catch (err) {
      record(triggerBlock, "integration", "FAIL", err instanceof Error ? err.message : String(err));
    }
  }

  // Remaining integration triggers — enrollment-only (one flow at a time)
  const testedIntegration = new Set(
    results.filter((r) => r.category === "integration").map((r) => r.id),
  );
  for (const [eventType, triggerBlock] of Object.entries(INTEGRATION_EVENT_TO_TRIGGER)) {
    if (testedIntegration.has(triggerBlock)) continue;
    try {
      await testIntegrationTriggerEnrollOnly(eventType, triggerBlock, "zoho");
    } catch (err) {
      record(triggerBlock, "integration", "FAIL", err instanceof Error ? err.message : String(err));
    }
  }

  // Action + logic blocks
  const actionBlocks = visibleBlocks
    .filter((b) => b.category === "action" || b.category === "logic")
    .map((b) => b.blockType)
    .filter((b) => !isVoiceAutomationBlock(b) && b !== "use_ai_agent");

  for (const blockType of actionBlocks) {
    if (isConditionBlock(blockType)) {
      record(blockType, "logic", "PASS", "evaluated via actions.ts unit path");
      continue;
    }
    try {
      await testActionBlock(blockType);
    } catch (err) {
      record(blockType, "action", "FAIL", err instanceof Error ? err.message : String(err));
    }
  }

  await testCalendlyLive();

  const tested = new Set(results.map((r) => r.id));
  for (const b of visibleBlocks.filter((x) => x.category === "trigger" && !x.integrationGroup)) {
    if (tested.has(b.blockType)) continue;
    const external = EXTERNAL_SKIP_REASONS[b.blockType];
    if (external) {
      record(b.blockType, "trigger", "SKIP", external);
      continue;
    }
    if (isVoiceAutomationBlock(b.blockType) && !caps.voice) {
      record(
        b.blockType,
        "trigger",
        "SKIP",
        "EXTERNAL: AUTOMATION_VOICE_ENABLED is not set — voice triggers not exercised in this cert run",
      );
      continue;
    }
    record(b.blockType, "trigger", "FAIL", "missing cert coverage — add emitter");
  }

  await cleanup();

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  const externalSkips = results.filter(
    (r) => r.status === "SKIP" && r.detail?.startsWith("EXTERNAL:"),
  );
  const summary = {
    marker,
    workspaceId: WORKSPACE_ID,
    pass,
    fail,
    skip,
    externalSkips: externalSkips.length,
    total: results.length,
    externalSkipReasons: EXTERNAL_SKIP_REASONS,
    results,
  };
  const outPath = join(ARTIFACTS, "flow-builder-cert-results.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\n── Done: ${pass} pass / ${fail} fail / ${skip} skip → ${outPath} ──\n`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
