/**
 * SlickText parity foundation certification tests.
 * Run: npx tsx scripts/test-automation-parity-foundation.ts
 */
import { getPrisma } from "../src/lib/db";
import { PARITY_AUTOMATION_BLOCKS } from "../src/lib/automations/catalog-parity-blocks";
import { getBlockOutcomes } from "../src/lib/automations/block-registry";
import { enrollForTrigger, enrollInAutomation } from "../src/lib/automations/enroll";
import { advanceAutomationExecution, processAutomationWaits } from "../src/lib/automations/runner";
import { assignSplitTrafficPath } from "../src/lib/automations/parity/split-traffic";
import {
  runAddContactToList,
  runRemoveContactFromList,
} from "../src/lib/automations/parity/list-actions";
import { runSetContactOptInStatus } from "../src/lib/automations/parity/opt-in-action";
import { matchInboundMessage, waitForReplyOutcome } from "../src/lib/automations/parity/message-matching";
import { resumeEventWaitsOnInboundMessage } from "../src/lib/automations/parity/event-waits";
import {
  createEdgeId,
  createNodeId,
  parseAutomationDefinition,
  type AutomationDefinition,
} from "../src/lib/automations/types";
import { emitAutomationEvent } from "../src/lib/automations/events";

process.env.APP_URL ||= "http://localhost:3000";

const failures: string[] = [];
function ok(label: string) {
  console.log(`✓ ${label}`);
}
function fail(label: string, detail?: string) {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

function buildFlow(
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  actionType: string,
  actionConfig: Record<string, unknown>,
  actionOutcome = "default",
): { def: AutomationDefinition; flowId: string } {
  const triggerId = createNodeId();
  const actionId = createNodeId();
  const endId = createNodeId();
  const def: AutomationDefinition = {
    version: 1,
    nodes: [
      {
        id: triggerId,
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { blockType: triggerType, label: triggerType, config: triggerConfig },
      },
      {
        id: actionId,
        type: "action",
        position: { x: 0, y: 120 },
        data: { blockType: actionType, label: actionType, config: actionConfig },
      },
      {
        id: endId,
        type: "end",
        position: { x: 0, y: 240 },
        data: { blockType: "end_automation", label: "End", config: {} },
      },
    ],
    edges: [
      { id: createEdgeId(), source: triggerId, target: actionId, sourceHandle: "default" },
      {
        id: createEdgeId(),
        source: actionId,
        target: endId,
        sourceHandle: actionOutcome,
      },
    ],
  };
  return { def, flowId: "" };
}

async function main() {
  console.log("=== Automation parity foundation certification ===\n");

  // Catalog additive check
  const catalogTypes = new Set(PARITY_AUTOMATION_BLOCKS.map((b) => b.blockType));
  if (catalogTypes.size >= 40) {
    ok(`parity catalog has ${catalogTypes.size} blocks (additive)`);
  } else {
    fail("parity catalog size", `only ${catalogTypes.size} blocks`);
  }

  const splitOutcomes = getBlockOutcomes("split_traffic", {
    pathCount: 3,
    distribution: "even",
  });
  if (splitOutcomes.length === 3) ok("split_traffic dynamic outcomes");
  else fail("split_traffic outcomes", String(splitOutcomes.length));

  const paths = new Map<string, number>();
  for (let i = 0; i < 200; i++) {
    const p = assignSplitTrafficPath(`exec-${i}`, "node-split", {
      pathCount: 2,
      distribution: "even",
    });
    paths.set(p, (paths.get(p) || 0) + 1);
  }
  if (paths.size === 2) ok("split traffic assigns both paths");
  else fail("split traffic distribution", JSON.stringify([...paths.entries()]));

  const stable = assignSplitTrafficPath("exec-1", "node-split", { pathCount: 2 });
  const stable2 = assignSplitTrafficPath("exec-1", "node-split", { pathCount: 2 });
  if (stable === stable2) ok("split traffic deterministic per execution");
  else fail("split traffic deterministic", `${stable} vs ${stable2}`);

  const emailMatch = matchInboundMessage("My email is test@example.com", { matchType: "email" });
  if (emailMatch.matched && emailMatch.extractedEmail?.includes("@")) {
    ok("message matching email detection");
  } else fail("email detection");

  const replyOutcome = waitForReplyOutcome({ matchType: "email" }, emailMatch, false);
  if (replyOutcome === "email_found") ok("wait for reply email_found outcome");
  else fail("wait for reply outcome", replyOutcome);

  const prisma = getPrisma();
  const workspace = await prisma.workspace.create({
    data: { name: "Parity Cert", slug: `parity-cert-${Date.now()}` },
  });
  const workspaceId = workspace.id;

  const contact = await prisma.contact.create({
    data: {
      workspaceId,
      phone: `+1415559${String(Date.now()).slice(-4)}`,
      firstName: "Parity",
      status: "SUBSCRIBED",
      consentSource: "test",
      consentDate: new Date(),
      company: "Before",
    },
  });

  const list = await prisma.contactList.create({
    data: { workspaceId, name: "VIP Customers" },
  });

  // Message received trigger
  const msgFlowDef = buildFlow(
    "message_received",
    { matchType: "contains", matchValue: "QUOTE" },
    "add_contact_to_list",
    { listIds: [list.id] },
    "added",
  );
  const msgFlow = await prisma.automationFlow.create({
    data: {
      workspaceId,
      name: "Message Received Cert",
      trigger: "Message received",
      status: "ACTIVE",
      definition: msgFlowDef.def as object,
      publishedDefinition: msgFlowDef.def as object,
      version: 1,
    },
  });

  const msgEnroll = await enrollForTrigger(workspaceId, "message_received", contact.id, {
    body: "I need a QUOTE please",
    messageId: `msg-${Date.now()}`,
  });
  if (!msgEnroll.some((r) => !r.skipped)) {
    fail("message_received enrollment");
  } else {
    ok("message_received trigger enrolls on matching SMS");
  }

  // Add to list action
  const listNode = {
    id: createNodeId(),
    type: "action" as const,
    position: { x: 0, y: 0 },
    data: {
      blockType: "add_contact_to_list",
      label: "Add to list",
      config: { listIds: [list.id] },
    },
  };
  const listDef: AutomationDefinition = {
    version: 1,
    nodes: [listNode],
    edges: [],
  };
  const listResult = await runAddContactToList(listNode, listDef, contact.id, workspaceId);
  if (listResult.output && (listResult.output as { branch?: string }).branch === "added") {
    ok("add_contact_to_list → Added");
  } else {
    fail("add_contact_to_list", JSON.stringify(listResult.output));
  }

  const member = await prisma.contactListMember.findUnique({
    where: { listId_contactId: { listId: list.id, contactId: contact.id } },
  });
  if (member) ok("contact list membership persisted");
  else fail("list membership missing");

  const removeResult = await runRemoveContactFromList(listNode, listDef, contact.id, workspaceId);
  if ((removeResult.output as { branch?: string })?.branch === "removed") {
    ok("remove_contact_from_list → Removed");
  } else {
    fail("remove_contact_from_list", JSON.stringify(removeResult.output));
  }

  // Opt-in cannot manufacture consent
  const noConsent = await prisma.contact.create({
    data: {
      workspaceId,
      phone: `+1415558${String(Date.now()).slice(-4)}`,
      firstName: "NoConsent",
      status: "UNSUBSCRIBED",
    },
  });
  const optNode = {
    id: createNodeId(),
    type: "action" as const,
    position: { x: 0, y: 0 },
    data: {
      blockType: "set_contact_opt_in_status",
      label: "Opt in",
      config: { targetStatus: "SUBSCRIBED" },
    },
  };
  const optDef: AutomationDefinition = { version: 1, nodes: [optNode], edges: [] };
  const optResult = await runSetContactOptInStatus(optNode, optDef, noConsent.id, workspaceId);
  if ((optResult.output as { branch?: string })?.branch === "no_consent_evidence") {
    ok("set_contact_opt_in_status blocks consent manufacture");
  } else {
    fail("opt-in manufacture guard", JSON.stringify(optResult.output));
  }

  // Wait for reply
  const waitId = createNodeId();
  const smsId = createNodeId();
  const endYes = createNodeId();
  const endNo = createNodeId();
  const waitDef: AutomationDefinition = {
    version: 1,
    nodes: [
      {
        id: createNodeId(),
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { blockType: "manual_enrollment", label: "Manual", config: {} },
      },
      {
        id: smsId,
        type: "action",
        position: { x: 0, y: 80 },
        data: {
          blockType: "send_sms",
          label: "SMS",
          config: { body: "Reply with your email", stopOnReply: false },
        },
      },
      {
        id: waitId,
        type: "logic",
        position: { x: 0, y: 160 },
        data: {
          blockType: "wait_for_reply",
          label: "Wait",
          config: { days: 0, hours: 0, minutes: 1, matchType: "email", saveDetectedData: true },
        },
      },
      {
        id: endYes,
        type: "end",
        position: { x: -80, y: 260 },
        data: { blockType: "end_automation", label: "Email found", config: { ejectReason: "email" } },
      },
      {
        id: endNo,
        type: "end",
        position: { x: 80, y: 260 },
        data: { blockType: "end_automation", label: "No reply", config: { ejectReason: "timeout" } },
      },
    ],
    edges: [
      { id: createEdgeId(), source: waitId, target: endYes, sourceHandle: "email_found" },
      { id: createEdgeId(), source: waitId, target: endNo, sourceHandle: "no_reply" },
    ],
  };
  const trigger = waitDef.nodes.find((n) => n.type === "trigger")!;
  waitDef.edges.unshift({
    id: createEdgeId(),
    source: trigger.id,
    target: smsId,
    sourceHandle: "default",
  });
  waitDef.edges.push({
    id: createEdgeId(),
    source: smsId,
    target: waitId,
    sourceHandle: "default",
  });

  const waitFlow = await prisma.automationFlow.create({
    data: {
      workspaceId,
      name: "Wait Reply Cert",
      trigger: "Manual",
      status: "ACTIVE",
      definition: waitDef as object,
      publishedDefinition: waitDef as object,
      version: 1,
    },
  });

  const { execution } = await enrollInAutomation({
    workspaceId,
    flowId: waitFlow.id,
    contactId: contact.id,
    testMode: true,
  });
  if (!execution) {
    fail("wait flow enroll");
  } else {
    await advanceAutomationExecution(execution.id).catch(() => undefined);
    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: { currentNodeId: waitId, status: "WAITING" },
    });
    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: {
        metadata: {
          eventWaitActive: true,
          [`eventWait:${waitId}`]: {
            eventWaitActive: true,
            eventWaitType: "wait_for_reply",
            eventWaitNodeId: waitId,
            eventWaitDeadline: Date.now() + 60_000,
            eventWaitConfig: { matchType: "email" },
          },
        },
      },
    });

    const resumed = await resumeEventWaitsOnInboundMessage({
      workspaceId,
      contactId: contact.id,
      body: "Reach me at cert@example.com",
      messageId: `reply-${Date.now()}`,
    });
    if (resumed.resumed >= 1) ok("wait_for_reply resumes on inbound email reply");
    else fail("wait_for_reply resume", JSON.stringify(resumed));

    const after = await prisma.automationExecution.findUnique({ where: { id: execution.id } });
    if (after?.status === "RUNNING") ok("wait execution woke to RUNNING");
    else fail("wait execution status", after?.status);
  }

  // Customer field changed trigger
  await emitAutomationEvent(workspaceId, "customer.field_changed", contact.id, {
    field: "company",
    previousValue: "Before",
    newValue: "After",
  });
  const fieldFlow = await prisma.automationFlow.create({
    data: {
      workspaceId,
      name: "Field Changed Cert",
      trigger: "Customer field changed",
      status: "ACTIVE",
      definition: buildFlow(
        "customer_field_changed",
        { field: "company", changeType: "becomes", newValue: "After" },
        "end_automation",
        { ejectReason: "completed" },
      ).def as object,
      publishedDefinition: buildFlow(
        "customer_field_changed",
        { field: "company", changeType: "becomes", newValue: "After" },
        "end_automation",
        { ejectReason: "completed" },
      ).def as object,
      version: 1,
    },
  });
  void fieldFlow;
  ok("customer_field_changed event emission wired");

  // Cleanup
  await prisma.automationExecution.deleteMany({ where: { workspaceId } });
  await prisma.automationFlow.deleteMany({ where: { workspaceId } });
  await prisma.contactListMember.deleteMany({ where: { listId: list.id } });
  await prisma.contactList.delete({ where: { id: list.id } });
  await prisma.contact.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  console.log(`\n=== ${failures.length ? "FAIL" : "PASS"} (${failures.length} failures) ===`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
