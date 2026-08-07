#!/usr/bin/env node
/**
 * Direct SMS send test — same path John MCTB uses (sendQuickSms).
 *
 *   npx tsx scripts/test-send-sms.mjs
 *
 * Optional:
 *   WORKSPACE_ID=ws_1
 *   FROM=+15714073615
 *   TO=+15714776175
 *   BODY="John SMS test — please ignore"
 */
const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const FROM = (process.env.FROM || "+15714073615").trim();
const TO = (process.env.TO || "+15714776175").trim();
const BODY =
  process.env.BODY ||
  `John SMS test ${new Date().toISOString().slice(11, 19)} UTC — please ignore`;

async function main() {
  // Use live Telnyx even when local .env says mock.
  process.env.MESSAGING_PROVIDER = process.env.MESSAGING_PROVIDER || "telnyx";

  const { sendQuickSms } = await import("../src/lib/sms/send-quick.ts");
  const { getRegistrationByWorkspace } = await import("../src/lib/messaging/store.ts");
  const { isMessagingReady } = await import("../src/lib/messaging/status.ts");
  const { resolveMctbSmsSender } = await import(
    "../src/lib/agents/missed-call-text-back/sms-sender.ts"
  );
  const { loadMissedCallTextConfig } = await import(
    "../src/lib/agents/missed-call-text-back/config.ts"
  );

  const reg = await getRegistrationByWorkspace(WORKSPACE_ID);
  const config = await loadMissedCallTextConfig(WORKSPACE_ID);
  const sender = await resolveMctbSmsSender({ workspaceId: WORKSPACE_ID, config });

  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        messagingReady: isMessagingReady(reg),
        registrationPhone: reg?.phoneE164,
        registrationProvider: reg?.messagingProvider,
        johnConfig: {
          enabled: config.enabled,
          phoneNumberId: config.phoneNumberId,
          smsPhoneNumberId: config.smsPhoneNumberId,
        },
        resolvedSender: sender,
        willSend: { from: FROM || sender?.e164, to: TO, body: BODY },
      },
      null,
      2,
    ),
  );

  if (!isMessagingReady(reg)) {
    throw new Error("Messaging registration not ready for this workspace");
  }

  const from = FROM || sender?.e164;
  if (!from) throw new Error("No FROM number resolved");

  console.log("\nSending...");
  const result = await sendQuickSms({
    workspaceId: WORKSPACE_ID,
    to: TO,
    from,
    body: BODY,
    idempotencyKey: `sms-test:${Date.now()}`,
  });

  console.log("\nResult:", JSON.stringify(result, null, 2));
  console.log("\nCheck your phone at", TO);
}

main().catch((err) => {
  console.error("\nSMS test FAILED:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
