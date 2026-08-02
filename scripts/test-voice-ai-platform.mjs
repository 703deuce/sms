#!/usr/bin/env node
/**
 * Contract-style checks for Telnyx AI Voice platform wiring.
 * Runs without live Telnyx when env is missing (imports + registry assertions).
 */
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const failures = [];
function ok(name, cond, detail = "") {
  if (cond) console.log("✓", name);
  else {
    console.log("✗", name, detail);
    failures.push(name);
  }
}

async function main() {
  const fs = await import("fs");
  const regPath = path.join(root, "src/lib/voice/telnyx/capability-registry.ts");
  ok("capability-registry file", fs.existsSync(regPath));
  const regSrc = fs.readFileSync(regPath, "utf8");
  ok("registry has deferred outbound", /outbound_campaigns/.test(regSrc));
  ok("registry has versions", /id: \"versions\"/.test(regSrc));
  ok("registry has canary", /id: \"canary\"/.test(regSrc));
  ok("registry has mcp", /id: \"mcp\"/.test(regSrc));
  ok("registry has conversations", /id: \"conversations\"/.test(regSrc));
  ok("registry marks capabilities live", /status: \"live\"/.test(regSrc));
  ok("registry marks outbound deferred", /id: \"outbound_campaigns\"[\s\S]*?status: \"deferred\"/.test(regSrc));
  ok("registry notes SIP REFER", /SIP REFER/.test(regSrc));

  ok("ai-client file", fs.existsSync(path.join(root, "src/lib/voice/telnyx/ai-client.ts")));
  const clientSrc = fs.readFileSync(path.join(root, "src/lib/voice/telnyx/ai-client.ts"), "utf8");
  for (const fn of [
    "listAssistants",
    "promoteVersion",
    "createCanary",
    "triggerSuiteRun",
    "createScheduledEvent",
    "listMcpServers",
    "listConversations",
    "createInsightGroup",
    "sendDtmf",
    "chatAssistant",
    "getTestRun",
    "smsChatAssistant",
  ]) {
    ok(`ai-client exports ${fn}`, new RegExp(`export async function ${fn}`).test(clientSrc));
  }

  const platformSrc = fs.readFileSync(
    path.join(root, "src/lib/voice/platform/ai-platform.ts"),
    "utf8",
  );
  for (const fn of [
    "enrichAssistantRemoteConfig",
    "seedDefaultRegressionSuite",
    "approveMcpServer",
    "saveObservabilityConfig",
    "ingestInsightWebhook",
    "assertAiCallAdmission",
  ]) {
    // assertAiCallAdmission lives in admission.ts
    if (fn === "assertAiCallAdmission") {
      ok(
        "admission assertAiCallAdmission",
        /export async function assertAiCallAdmission/.test(
          fs.readFileSync(path.join(root, "src/lib/voice/platform/admission.ts"), "utf8"),
        ),
      );
      continue;
    }
    ok(`platform ${fn}`, new RegExp(`export async function ${fn}`).test(platformSrc));
  }

  ok(
    "dynamic-variables webhook route",
    fs.existsSync(path.join(root, "src/app/api/telnyx/voice/dynamic-variables/route.ts")),
  );
  ok(
    "insights webhook route",
    fs.existsSync(path.join(root, "src/app/api/telnyx/voice/insights/route.ts")),
  );
  ok(
    "widget chat public API",
    fs.existsSync(path.join(root, "src/app/api/public/voice/widget/chat/route.ts")),
  );
  ok(
    "widget embed page",
    fs.existsSync(path.join(root, "src/app/embed/voice/[agentId]/page.tsx")),
  );
  ok("voice ai API route", fs.existsSync(path.join(root, "src/app/api/voice/ai/route.ts")));
  ok(
    "ai-platform UI",
    fs.existsSync(path.join(root, "src/app/(app)/voice/ai-platform/page.tsx")),
  );
  ok("schema SQL", fs.existsSync(path.join(root, "supabase/voice-ai-platform-fields.sql")));
  ok("after matrix doc", fs.existsSync(path.join(root, "docs/TELNYX_AI_VOICE_AFTER.md")));

  const apiSrc = fs.readFileSync(path.join(root, "src/app/api/voice/ai/route.ts"), "utf8");
  for (const action of [
    "approve_mcp",
    "seed_suite",
    "sync_insights",
    "save_observability",
    "attach_insight_group",
    "upsert_concurrency",
  ]) {
    ok(`API action ${action}`, apiSrc.includes(`case "${action}"`));
  }

  const builderSrc = fs.readFileSync(
    path.join(root, "src/components/voice/voice-agent-builder.tsx"),
    "utf8",
  );
  ok("builder platform section body", /section === \"platform\"/.test(builderSrc));
  ok("builder platformAct", /async function platformAct/.test(builderSrc));

  const inboundSrc = fs.readFileSync(path.join(root, "src/lib/voice/inbound.ts"), "utf8");
  ok("inbound uses admission", /assertAiCallAdmission/.test(inboundSrc));
  const callSvc = fs.readFileSync(path.join(root, "src/lib/voice/call-service.ts"), "utf8");
  ok("outbound uses admission", /assertAiCallAdmission/.test(callSvc));
  const mw = fs.readFileSync(path.join(root, "src/middleware.ts"), "utf8");
  ok("middleware allows embed/voice", /\/embed\/voice\//.test(mw));
  ok(
    "transovo MCP route",
    fs.existsSync(path.join(root, "src/app/api/public/voice/mcp/route.ts")),
  );
  ok(
    "widget session route",
    fs.existsSync(path.join(root, "src/app/api/public/voice/widget/session/route.ts")),
  );
  ok(
    "conversations id route",
    fs.existsSync(path.join(root, "src/app/api/voice/conversations/[id]/route.ts")),
  );
  ok(
    "retention module",
    fs.existsSync(path.join(root, "src/lib/voice/platform/retention.ts")),
  );
  ok(
    "live acceptance script",
    fs.existsSync(path.join(root, "scripts/test-voice-ai-live-acceptance.mjs")),
  );
  const apiSrc2 = fs.readFileSync(path.join(root, "src/app/api/voice/ai/route.ts"), "utf8");
  for (const action of [
    "ensure_transovo_mcp",
    "preview_memory",
    "canary_metrics",
    "sms_chat_preview",
    "schedule_regression",
    "run_retention",
  ]) {
    ok(`API action ${action}`, apiSrc2.includes(`case "${action}"`));
  }
  const clientTs = fs.readFileSync(
    path.join(root, "src/lib/messaging/telnyx/client.ts"),
    "utf8",
  );
  ok("telnyx client retries", /maxAttempts|RETRYABLE/.test(clientTs));
  ok("telnyx client redaction", /redact\(/.test(clientTs));
  const transfersSrc = fs.readFileSync(path.join(root, "src/lib/voice/transfers.ts"), "utf8");
  ok("SIP REFER path", /sip_refer|actions\/refer/.test(transfersSrc));
  const builderSrc2 = fs.readFileSync(
    path.join(root, "src/components/voice/voice-agent-builder.tsx"),
    "utf8",
  );
  ok("builder transcription tab", /id: \"transcription\"/.test(builderSrc2));
  ok("builder memory tab", /id: \"memory\"/.test(builderSrc2));
  ok("builder security tab", /id: \"security\"/.test(builderSrc2));

  const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  for (const model of [
    "VoiceRemoteAssistantVersion",
    "VoiceCanaryDeploy",
    "VoiceAssistantTest",
    "VoiceTestSuite",
    "VoiceAiConversation",
    "VoiceMemoryConfig",
    "VoiceInsightGroup",
    "VoiceScheduledEvent",
    "VoiceMcpServer",
    "VoiceConcurrencyAllocation",
    "VoiceTransferDestination",
    "VoiceWidgetConfig",
    "VoiceObservabilityConfig",
    "VoiceFailureDiagnostic",
  ]) {
    ok(`prisma model ${model}`, new RegExp(`model ${model} `).test(schema));
  }
  ok("outboundAiEnabled default false", /outboundAiEnabled Boolean\s+@default\(false\)/.test(schema));
  ok("mcp approved default false", /approved\s+Boolean\s+@default\(false\)/.test(schema));

  if (failures.length) {
    console.error("\nFAILED", failures.length, failures);
    process.exit(1);
  }
  console.log("\nAll contract checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
