#!/usr/bin/env npx tsx
/**
 * Compare rich vs minimal Telnyx tool webhook (production-shaped).
 */
import { POST as toolWebhookPost } from "../src/app/api/telnyx/voice/tools/route";
import {
  buildTelnyxMinimalToolWebhookRequest,
  buildTelnyxToolWebhookRequest,
} from "../src/lib/voice/testing/telnyx-fixtures";
import {
  cleanupHeadlessFixture,
  seedWoodbridgeHeadlessFixture,
} from "../src/lib/voice/testing/headless/woodbridge-fixture";
import { newTelnyxIds } from "../src/lib/voice/testing/preprod-harness";
import { clearRecordingSmsOutbox, getRecordingSmsOutbox } from "../src/lib/voice/testing/headless/recording-sms";
import { getPrisma } from "../src/lib/db";

async function run(label: string, request: Request) {
  const started = Date.now();
  const res = await toolWebhookPost(request);
  const json = (await res.json()) as Record<string, unknown>;
  return {
    label,
    ms: Date.now() - started,
    ok: json.ok !== false,
    fast_path: json.fast_path,
    result: json.result,
    speak: json.speak,
  };
}

async function main() {
  const fixture = await seedWoodbridgeHeadlessFixture();
  const ids = newTelnyxIds("parity");
  try {
    clearRecordingSmsOutbox();
    const rich = buildTelnyxToolWebhookRequest({
      workspaceId: fixture.workspaceId,
      agentId: fixture.agentId,
      toolType: "send_resource",
      body: { resource_type: "booking", verbal_sms_consent: true },
      callControlId: ids.callControlId,
      conversationId: ids.conversationId,
      fromE164: fixture.callerE164,
      toE164: fixture.toE164,
    });
    const minimalControlId = `${ids.callControlId}-minimal`;
    const prisma = getPrisma();
    await prisma.voiceCall.create({
      data: {
        workspaceId: fixture.workspaceId,
        agentId: fixture.agentId,
        phoneNumberId: fixture.phoneNumberId,
        direction: "INBOUND",
        status: "IN_PROGRESS",
        fromE164: fixture.callerE164,
        toE164: fixture.toE164,
        telnyxCallControlId: minimalControlId,
        startedAt: new Date(),
        answeredAt: new Date(),
      },
    });

    const minimal = buildTelnyxMinimalToolWebhookRequest({
      workspaceId: fixture.workspaceId,
      agentId: fixture.agentId,
      toolType: "send_resource",
      body: { resource_type: "booking" },
      callControlId: minimalControlId,
    });

    const results = [await run("rich", rich), await run("minimal", minimal)];
    console.log(JSON.stringify(results, null, 2));
    console.log("sms count", getRecordingSmsOutbox().length);
    const failed = results.filter((r) => !r.ok || r.ms > 10000 || !r.fast_path);
    if (failed.length) {
      console.error("PARITY FAIL", failed);
      process.exit(1);
    }
    console.log("PARITY PASS");
  } finally {
    await cleanupHeadlessFixture(fixture);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
