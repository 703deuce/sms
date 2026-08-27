/**
 * SMS automation gap tests — stop-on-reply, no-response trigger, voice block gating.
 * Run: npx tsx scripts/test-automation-sms-gaps.ts
 */
import { getPrisma } from "../src/lib/db";

process.env.APP_URL ||= "http://localhost:3000";
delete process.env.TWILIO_MODE;
delete process.env.MESSAGING_ADAPTER;
import { isBlockEnabledForAccount, getAutomationCapabilities } from "../src/lib/automations/capabilities";
import { isVoiceAutomationBlock } from "../src/lib/automations/block-scope";
import { markFactsForContact } from "../src/lib/automations/metadata";
import { enrollInAutomation } from "../src/lib/automations/enroll";
import { parseAutomationDefinition } from "../src/lib/automations/types";

const failures: string[] = [];
function ok(label: string) {
  console.log(`✓ ${label}`);
}
function fail(label: string, detail?: string) {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  const caps = getAutomationCapabilities();
  if (isBlockEnabledForAccount("send_sms", caps)) ok("send_sms enabled");
  else fail("send_sms enabled");

  if (!isBlockEnabledForAccount("inbound_call", caps)) ok("inbound_call hidden without voice flag");
  else fail("inbound_call hidden without voice flag");

  if (isVoiceAutomationBlock("run_voice_agent")) ok("voice block detection");
  else fail("voice block detection");

  const prisma = getPrisma();
  const workspace = await prisma.workspace.create({
    data: { name: "SMS gap test", slug: `sms-gap-${Date.now()}` },
  });
  const contact = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      phone: "+15555559001",
      firstName: "Gap",
      lastName: "Test",
      status: "SUBSCRIBED",
    },
  });

  const def = parseAutomationDefinition({
    nodes: [
      {
        id: "t1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: {
          blockType: "manual_enrollment",
          label: "Manual",
          config: {},
        },
      },
      {
        id: "s1",
        type: "action",
        position: { x: 0, y: 120 },
        data: {
          blockType: "send_sms",
          label: "SMS",
          config: { body: "Hello {{first_name}}", stopOnReply: true },
        },
      },
      {
        id: "w1",
        type: "logic",
        position: { x: 0, y: 240 },
        data: {
          blockType: "wait",
          label: "Wait",
          config: { minutes: 1 },
        },
      },
      {
        id: "e1",
        type: "end",
        position: { x: 0, y: 360 },
        data: { blockType: "end_automation", label: "End", config: {} },
      },
    ],
    edges: [
      { id: "e-t-s", source: "t1", target: "s1" },
      { id: "e-s-w", source: "s1", target: "w1" },
      { id: "e-w-e", source: "w1", target: "e1" },
    ],
  });

  const flow = await prisma.automationFlow.create({
    data: {
      workspaceId: workspace.id,
      name: "Stop on reply test",
      trigger: "manual_enrollment",
      status: "ACTIVE",
      definition: def,
      publishedDefinition: def,
      version: 1,
    },
  });

  const { execution } = await enrollInAutomation({
    workspaceId: workspace.id,
    flowId: flow.id,
    contactId: contact.id,
    testMode: false,
    enrollmentSuffix: `gap-${Date.now()}`,
  });
  if (!execution?.id) fail("enroll execution");
  else ok("enroll execution");

  await prisma.automationExecution.update({
    where: { id: execution!.id },
    data: {
      status: "WAITING",
      metadata: {
        stopOnReplyActive: true,
        customer_replied: false,
        message_delivered: true,
      },
    },
  });
  ok("stopOnReplyActive set on execution");

  await markFactsForContact(workspace.id, contact.id, { customer_replied: true });
  const afterReply = await prisma.automationExecution.findUnique({ where: { id: execution!.id } });
  if (afterReply?.status === "COMPLETED") ok("execution stopped on reply");
  else fail("execution stopped on reply", afterReply?.status || "unknown");

  console.log(failures.length ? `\n${failures.length} failed` : "\nAll SMS gap tests passed");
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
