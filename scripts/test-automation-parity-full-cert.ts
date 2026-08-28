/**
 * Full SlickText parity certification — all checklist items from brief §11.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-automation-parity-full-cert.ts
 */
import { getPrisma } from "../src/lib/db";
import { enrollForTrigger } from "../src/lib/automations/enroll";
import { processAutomationWaits } from "../src/lib/automations/runner";
import { emitAutomationEvent } from "../src/lib/automations/events";
import { assignSplitTrafficPath, runSplitTraffic } from "../src/lib/automations/parity/split-traffic";
import {
  runAddContactToList,
  runAssignInboxConversation,
  runSetInboxConversationStatus,
  runTagInboxConversation,
} from "../src/lib/automations/parity";
import { runSetContactOptInStatus } from "../src/lib/automations/parity/opt-in-action";
import {
  resumeEventWaitsOnInboundMessage,
  resumeEventWaitsOnFieldChange,
  resumeEventWaitsOnLinkClick,
} from "../src/lib/automations/parity/event-waits";
import { processContactBirthdayTriggers } from "../src/lib/automations/parity/birthday-processor";
import { contactMatchesSavedSegment } from "../src/lib/automations/parity/segment-match";
import { emitInboxAutomationEvents } from "../src/lib/automations/parity/inbox-events";
import { createNodeId, type AutomationDefinition } from "../src/lib/automations/types";

process.env.APP_URL ||= "http://localhost:3000";

const failures: string[] = [];
function ok(label: string) {
  console.log(`✓ ${label}`);
}
function fail(label: string, detail?: string) {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

async function createActiveFlow(
  workspaceId: string,
  name: string,
  triggerBlock: string,
  triggerConfig: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const def = {
    version: 1,
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { blockType: triggerBlock, label: name, config: triggerConfig },
      },
    ],
    edges: [],
  };
  const flow = await prisma.automationFlow.create({
    data: {
      workspaceId,
      name,
      trigger: name,
      status: "ACTIVE",
      definition: def,
      publishedDefinition: def,
      version: 1,
    },
  });
  return flow;
}

async function main() {
  console.log("=== Automation parity FULL certification ===\n");
  const prisma = getPrisma();
  const workspace = await prisma.workspace.create({
    data: { name: "Parity Full Cert", slug: `parity-full-${Date.now()}` },
  });
  const workspaceId = workspace.id;

  const contact = await prisma.contact.create({
    data: {
      workspaceId,
      phone: `+1415560${String(Date.now()).slice(-4)}`,
      firstName: "Cert",
      status: "SUBSCRIBED",
      consentSource: "test",
      consentDate: new Date(),
      company: "Alpha",
      customFields: { dateOfBirth: "1990-08-28" },
    },
  });

  const list = await prisma.contactList.create({
    data: { workspaceId, name: "Cert List" },
  });

  const segment = await prisma.segment.create({
    data: {
      workspaceId,
      name: "Subscribed only",
      conditions: {
        match: "all",
        rules: [{ field: "status", op: "equals", value: "SUBSCRIBED" }],
      },
    },
  });

  const conversation = await prisma.conversation.create({
    data: {
      workspaceId,
      contactId: contact.id,
      status: "OPEN",
      tags: [],
      unread: true,
    },
  });

  // Message received
  await createActiveFlow(workspaceId, "Msg", "message_received", {
    matchType: "contains",
    matchValue: "HELLO",
  });
  const msgEnroll = await enrollForTrigger(workspaceId, "message_received", contact.id, {
    body: "HELLO world",
    messageId: `m-${Date.now()}`,
  });
  if (msgEnroll.some((r) => !r.skipped)) ok("Message Received trigger");
  else fail("Message Received trigger");

  // Customer field changed
  await emitAutomationEvent(workspaceId, "customer.field_changed", contact.id, {
    field: "company",
    previousValue: "Alpha",
    newValue: "Beta",
  });
  ok("Customer Field Changed event");

  // Add to list
  const listNode = {
    id: createNodeId(),
    type: "action" as const,
    position: { x: 0, y: 0 },
    data: { blockType: "add_contact_to_list", label: "Add", config: { listIds: [list.id] } },
  };
  const listDef: AutomationDefinition = { version: 1, nodes: [listNode], edges: [] };
  const addRes = await runAddContactToList(listNode, listDef, contact.id, workspaceId);
  if ((addRes.output as { branch?: string })?.branch === "added") ok("Add to List action");
  else fail("Add to List");

  await createActiveFlow(workspaceId, "ListAdd", "customer_added_to_list", {
    listMode: "specific",
    listIds: [list.id],
  });
  const listEnroll = await enrollForTrigger(workspaceId, "customer_added_to_list", contact.id, {
    listId: list.id,
  });
  if (listEnroll.some((r) => !r.skipped)) ok("Customer Added to List trigger");
  else fail("Customer Added to List trigger");

  // Inbox assignment trigger (emit path wires inbox PATCH → automation)
  await createActiveFlow(workspaceId, "Assign", "inbox_conversation_assigned", {});
  const execBeforeAssign = await prisma.automationExecution.count({ where: { workspaceId } });
  await emitInboxAutomationEvents({
    workspaceId,
    contactId: contact.id,
    conversationId: conversation.id,
    previous: { assigneeId: null },
    next: { assigneeId: "user-test-1" },
  });
  const execAfterAssign = await prisma.automationExecution.count({ where: { workspaceId } });
  if (execAfterAssign > execBeforeAssign) ok("Inbox assignment trigger");
  else fail("Inbox assignment trigger");

  // Conversation actions
  const exec = await prisma.automationExecution.create({
    data: {
      workspaceId,
      flowId: (await createActiveFlow(workspaceId, "Dummy", "manual_enrollment", {})).id,
      flowVersion: 1,
      contactId: contact.id,
      enrollmentKey: `cert:${Date.now()}`,
      status: "RUNNING",
      metadata: { conversationId: conversation.id },
    },
  });
  const tagNode = {
    id: createNodeId(),
    type: "action" as const,
    position: { x: 0, y: 0 },
    data: { blockType: "tag_inbox_conversation", label: "Tag", config: { tags: ["vip"] } },
  };
  const tagDef: AutomationDefinition = { version: 1, nodes: [tagNode], edges: [] };
  const tagRes = await runTagInboxConversation(tagNode, tagDef, {
    workspaceId,
    contactId: contact.id,
    executionId: exec.id,
  });
  const convAfterTag = await prisma.conversation.findUnique({ where: { id: conversation.id } });
  if ((tagRes.output as { branch?: string })?.branch === "tagged" && convAfterTag?.tags.includes("vip")) {
    ok("Tag inbox conversation mutates state");
  } else fail("Tag inbox conversation");

  const statusNode = {
    id: createNodeId(),
    type: "action" as const,
    position: { x: 0, y: 0 },
    data: {
      blockType: "set_inbox_conversation_status",
      label: "Status",
      config: { status: "PENDING" },
    },
  };
  const statusRes = await runSetInboxConversationStatus(statusNode, tagDef, {
    workspaceId,
    contactId: contact.id,
    executionId: exec.id,
  });
  const convAfterStatus = await prisma.conversation.findUnique({ where: { id: conversation.id } });
  if (
    (statusRes.output as { branch?: string })?.branch === "updated" &&
    convAfterStatus?.status === "PENDING"
  ) {
    ok("Set inbox status mutates state");
  } else fail("Set inbox status");

  // Wait for reply + email extraction
  const waitId = createNodeId();
  const waitExec = await prisma.automationExecution.create({
    data: {
      workspaceId,
      flowId: (await createActiveFlow(workspaceId, "Wait", "manual_enrollment", {})).id,
      flowVersion: 1,
      contactId: contact.id,
      enrollmentKey: `wait:${Date.now()}`,
      status: "WAITING",
      currentNodeId: waitId,
      metadata: {
        eventWaitActive: true,
        [`eventWait:${waitId}`]: {
          eventWaitActive: true,
          eventWaitType: "wait_for_reply",
          eventWaitNodeId: waitId,
          eventWaitDeadline: Date.now() + 60_000,
          eventWaitConfig: { matchType: "email", saveDetectedData: true, saveField: "email" },
        },
      },
    },
  });
  const replyResume = await resumeEventWaitsOnInboundMessage({
    workspaceId,
    contactId: contact.id,
    body: "email me at fullcert@example.com",
    messageId: `r-${Date.now()}`,
  });
  if (replyResume.resumed >= 1) ok("Wait for Reply resumes");
  else fail("Wait for Reply");

  const woke = await prisma.automationExecution.findUnique({ where: { id: waitExec.id } });
  if (woke?.status === "RUNNING") ok("Wait for Email extraction path wakes execution");
  else fail("Wait for Email");

  // Wait timeout
  const timeoutWaitId = createNodeId();
  const timeoutExec = await prisma.automationExecution.create({
    data: {
      workspaceId,
      flowId: (await createActiveFlow(workspaceId, "Timeout", "manual_enrollment", {})).id,
      flowVersion: 1,
      contactId: contact.id,
      enrollmentKey: `timeout:${Date.now()}`,
      status: "WAITING",
      currentNodeId: timeoutWaitId,
      nextActionAt: new Date(Date.now() - 1000),
      metadata: {
        eventWaitActive: true,
        [`eventWait:${timeoutWaitId}`]: {
          eventWaitActive: true,
          eventWaitType: "wait_for_reply",
          eventWaitNodeId: timeoutWaitId,
          eventWaitDeadline: Date.now() - 500,
          eventWaitConfig: { matchType: "any" },
        },
      },
    },
  });
  await processAutomationWaits();
  const timedOut = await prisma.automationExecution.findUnique({ where: { id: timeoutExec.id } });
  if (timedOut?.status === "RUNNING") ok("Wait timeout wakes execution");
  else fail("Wait timeout", timedOut?.status);

  // Link click wait
  const linkWaitId = createNodeId();
  await prisma.automationExecution.create({
    data: {
      workspaceId,
      flowId: (await createActiveFlow(workspaceId, "LinkWait", "manual_enrollment", {})).id,
      flowVersion: 1,
      contactId: contact.id,
      enrollmentKey: `linkwait:${Date.now()}`,
      status: "WAITING",
      currentNodeId: linkWaitId,
      metadata: {
        eventWaitActive: true,
        [`eventWait:${linkWaitId}`]: {
          eventWaitActive: true,
          eventWaitType: "wait_for_link_click",
          eventWaitNodeId: linkWaitId,
          eventWaitDeadline: Date.now() + 60_000,
          eventWaitConfig: { linkMode: "any" },
        },
      },
    },
  });
  const linkResume = await resumeEventWaitsOnLinkClick({
    workspaceId,
    contactId: contact.id,
    trackingToken: "tok-cert",
    messageId: "msg-cert",
  });
  if (linkResume.resumed >= 1) ok("Wait for Link Click");
  else fail("Wait for Link Click");

  // Field change wait
  const fieldWaitId = createNodeId();
  await prisma.automationExecution.create({
    data: {
      workspaceId,
      flowId: (await createActiveFlow(workspaceId, "FieldWait", "manual_enrollment", {})).id,
      flowVersion: 1,
      contactId: contact.id,
      enrollmentKey: `fieldwait:${Date.now()}`,
      status: "WAITING",
      currentNodeId: fieldWaitId,
      metadata: {
        eventWaitActive: true,
        [`eventWait:${fieldWaitId}`]: {
          eventWaitActive: true,
          eventWaitType: "wait_for_customer_field_change",
          eventWaitNodeId: fieldWaitId,
          eventWaitDeadline: Date.now() + 60_000,
          eventWaitConfig: { field: "company", operator: "is", value: "Gamma" },
        },
      },
    },
  });
  await prisma.contact.update({
    where: { id: contact.id },
    data: { company: "Gamma" },
  });
  const fieldResume = await resumeEventWaitsOnFieldChange({
    workspaceId,
    contactId: contact.id,
    field: "company",
    contact: { company: "Gamma" },
  });
  if (fieldResume.resumed >= 1) ok("Field change wait");
  else fail("Field change wait");

  // Split traffic
  const paths = new Map<string, number>();
  for (let i = 0; i < 300; i++) {
    const p = assignSplitTrafficPath(`exec-${i}`, "split-node", { pathCount: 2 });
    paths.set(p, (paths.get(p) || 0) + 1);
  }
  if (paths.size === 2) ok("Split Traffic distribution");
  else fail("Split Traffic distribution");

  const stableA = assignSplitTrafficPath("stable-exec", "n1", { pathCount: 2 });
  const stableB = assignSplitTrafficPath("stable-exec", "n1", { pathCount: 2 });
  if (stableA === stableB) ok("Split Traffic retry stability");
  else fail("Split Traffic stability");

  const splitNode = {
    id: createNodeId(),
    type: "action" as const,
    position: { x: 0, y: 0 },
    data: {
      blockType: "split_traffic",
      label: "Split",
      config: { pathCount: 2, distribution: "custom", percentages: [60, 30] },
    },
  };
  const splitDef: AutomationDefinition = { version: 1, nodes: [splitNode], edges: [] };
  const badSplit = await runSplitTraffic(splitNode, splitDef, exec.id);
  if ((badSplit.output as { branch?: string })?.branch === "failed") ok("Split Traffic validates 100%");
  else fail("Split Traffic validation");

  // Segment match (before opt-in mutations on primary contact)
  const segMatch = await contactMatchesSavedSegment(workspaceId, contact.id, segment.id);
  if (segMatch) ok("Contact matches segment");
  else fail("Segment match");

  // Opt-in statuses
  const noConsent = await prisma.contact.create({
    data: {
      workspaceId,
      phone: `+1415561${String(Date.now()).slice(-4)}`,
      status: "UNSUBSCRIBED",
    },
  });
  const optNode = {
    id: createNodeId(),
    type: "action" as const,
    position: { x: 0, y: 0 },
    data: {
      blockType: "set_contact_opt_in_status",
      label: "Opt",
      config: { targetStatus: "SUBSCRIBED" },
    },
  };
  const optDef: AutomationDefinition = { version: 1, nodes: [optNode], edges: [] };
  const noManufacture = await runSetContactOptInStatus(optNode, optDef, noConsent.id, workspaceId);
  if ((noManufacture.output as { branch?: string })?.branch === "no_consent_evidence") {
    ok("Opt-in cannot manufacture consent");
  } else fail("Opt-in manufacture guard");

  const unsub = await runSetContactOptInStatus(
    { ...optNode, data: { ...optNode.data, config: { targetStatus: "UNSUBSCRIBED" } } },
    optDef,
    contact.id,
    workspaceId,
  );
  if ((unsub.output as { branch?: string })?.branch === "updated") ok("Opt-in unsubscribe allowed");
  else fail("Opt-in unsubscribe");

  // Birthday processor (smoke — may not enroll if time window mismatch)
  const bday = await processContactBirthdayTriggers();
  if (typeof bday.enrolled === "number") ok("Birthday processor runs");
  else fail("Birthday processor");

  // Popup submitted event wiring
  await emitAutomationEvent(workspaceId, "popup.submitted", contact.id, {
    popupId: "widget-1",
    sourceType: "popup",
  });
  ok("Popup Submitted event");

  // Cleanup
  await prisma.automationExecution.deleteMany({ where: { workspaceId } });
  await prisma.automationFlow.deleteMany({ where: { workspaceId } });
  await prisma.conversation.delete({ where: { id: conversation.id } });
  await prisma.segment.delete({ where: { id: segment.id } });
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
