/**
 * Manual outbound lead qualification smoke call.
 *
 * Preferred (no Coolify terminal):
 *   curl -X POST "$APP_URL/api/voice/outbound/qualification/test" \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"workspaceId":"ws_1","destinationPhone":"+15714776175"}'
 *
 * Or set OUTBOUND_AUTO_SMOKE_CALL=1 + OUTBOUND_TEST_PHONE on Coolify and redeploy.
 *
 * CLI (still requires OUTBOUND_VOICE_TEST_MODE=1):
 *   OUTBOUND_VOICE_TEST_MODE=1 npx tsx scripts/outbound-lead-smoke-call.ts --phone=+15714776175
 */
import dotenv from "dotenv";
import { assertOutboundTestModeEnabled } from "../src/lib/voice/outbound/outbound-call-service";
import { triggerOutboundQualificationCall } from "../src/lib/voice/outbound/trigger-qualification-call";

dotenv.config();

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

async function main() {
  assertOutboundTestModeEnabled();

  const phone = arg("phone") || process.env.OUTBOUND_TEST_PHONE;
  if (!phone?.trim()) {
    throw new Error("Pass --phone=+1... or set OUTBOUND_TEST_PHONE");
  }

  const workspaceId = arg("workspace-id") || process.env.WORKSPACE_ID || "ws_1";
  const agentId = arg("agent-id");
  const scheduleAt = arg("schedule");
  if (scheduleAt) {
    const when = new Date(scheduleAt);
    const delay = when.getTime() - Date.now();
    if (delay > 0) {
      console.log(`Scheduling dial in ${Math.round(delay / 1000)}s (${when.toISOString()})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  const result = await triggerOutboundQualificationCall({
    workspaceId,
    agentId,
    destinationPhone: phone,
    leadName: arg("lead-name") || "Anthony",
    triggerSource: "manual_smoke_cli",
    triggerReason: "Developer outbound qualification smoke",
    requireTestModeEnv: true,
  });

  console.log(JSON.stringify({ ok: result.status !== "failed", ...result }, null, 2));
  if (result.status === "failed") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
