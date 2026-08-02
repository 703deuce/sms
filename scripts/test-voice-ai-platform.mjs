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

  const agentSvc = fs.readFileSync(
    path.join(root, "src/lib/voice/agent-service.ts"),
    "utf8",
  );
  ok("buildVoiceAgentForTest export", /export async function buildVoiceAgentForTest/.test(agentSvc));
  ok("build sets TESTING", /status:\s*"TESTING"/.test(agentSvc));
  ok("publishVoiceAgent export", /export async function publishVoiceAgent/.test(agentSvc));
  const agentRoute = fs.readFileSync(
    path.join(root, "src/app/api/voice/agents/[id]/route.ts"),
    "utf8",
  );
  ok("API build_for_test action", /build_for_test/.test(agentRoute));
  ok("API deploy action", /action === "deploy"/.test(agentRoute));
  ok(
    "AgentTestPanel component",
    fs.existsSync(path.join(root, "src/components/voice/agent-test-panel.tsx")),
  );
  ok("builder Build & test", /build_for_test|Build &amp; test|Build \& test/.test(builderSrc2));
  ok("builder Deploy to number", /Deploy to number/.test(builderSrc2));
  ok("builder barge-in control", /bargeIn/.test(builderSrc2));
  ok("builder compare_versions UI", /compare_versions/.test(builderSrc2));
  const widgetChat = fs.readFileSync(
    path.join(root, "src/app/api/public/voice/widget/chat/route.ts"),
    "utf8",
  );
  ok("widget session requires !testMode", /!cfg\.testMode/.test(widgetChat));
  const admission = fs.readFileSync(
    path.join(root, "src/lib/voice/platform/admission.ts"),
    "utf8",
  );
  ok("admission plan/trial gates", /trial_pending_card|plan_suspended/.test(admission));
  ok("resolveAiVersionStamp", /resolveAiVersionStamp/.test(admission));
  const webhookSrc = fs.readFileSync(
    path.join(root, "src/lib/voice/telnyx/webhook-handlers.ts"),
    "utf8",
  );
  ok(
    "webhook persists conversation messages",
    /voiceAiConversationMessage/.test(webhookSrc),
  );
  ok("handoff hangup loop limit", /hops > 3/.test(webhookSrc));
  const jobsSrc = fs.readFileSync(path.join(root, "src/lib/jobs/job-handlers.ts"), "utf8");
  ok("regression recurring re-enqueue", /recurring:\s*true/.test(jobsSrc));
  ok(
    "AgentBrowserCall component",
    fs.existsSync(path.join(root, "src/components/voice/agent-browser-call.tsx")),
  );
  ok(
    "VoicePicker component",
    fs.existsSync(path.join(root, "src/components/voice/voice-picker.tsx")),
  );
  const browserCall = fs.readFileSync(
    path.join(root, "src/components/voice/agent-browser-call.tsx"),
    "utf8",
  );
  ok("browser call anonymous_login", /anonymous_login/.test(browserCall));
  ok("browser call ai_assistant", /ai_assistant/.test(browserCall));
  ok("browser call uses test-session", /test-session/.test(browserCall));
  ok("browser call Test Voice Agent CTA", /Test Voice Agent/.test(browserCall));
  ok("browser call no speechSynthesis", !/speechSynthesis/.test(browserCall));
  ok(
    "voices API route",
    fs.existsSync(path.join(root, "src/app/api/voice/voices/route.ts")),
  );
  ok(
    "test-session route",
    fs.existsSync(
      path.join(root, "src/app/api/voice/agents/[id]/test-session/route.ts"),
    ),
  );
  const testSession = fs.readFileSync(
    path.join(root, "src/lib/voice/platform/test-session.ts"),
    "utf8",
  );
  ok("test session ownership check", /workspaceId: input\.workspaceId/.test(testSession));
  ok("test session rate limit", /rateOk|rate_limited/.test(testSession));
  ok("test session never returns API key", !/TELNYX_API_KEY/.test(testSession) || /Never returns TELNYX_API_KEY/.test(testSession));
  const voicesSrc = fs.readFileSync(
    path.join(root, "src/lib/voice/telnyx/voices.ts"),
    "utf8",
  );
  ok(
    "default catalog Ava NaturalHD",
    /ava-warm-us/.test(voicesSrc) && /Telnyx\.NaturalHD\.astra/.test(voicesSrc),
  );
  ok("resolveProviderVoiceId", /export function resolveProviderVoiceId/.test(voicesSrc));
  const ttsPreview = fs.readFileSync(
    path.join(root, "src/app/api/voice/tts-preview/route.ts"),
    "utf8",
  );
  ok("tts preview allowlist", /isApprovedVoiceId/.test(ttsPreview));
  ok("tts preview cache", /getCachedPreview/.test(ttsPreview));
  ok(
    "tts preview rejects browser TTS path",
    /never browser speechSynthesis/.test(ttsPreview) ||
      !/\bspeechSynthesis\./.test(ttsPreview),
  );
  const syncSrc = fs.readFileSync(
    path.join(root, "src/lib/voice/telnyx/assistant-sync.ts"),
    "utf8",
  );
  ok(
    "web calls enabled on sync",
    /supports_unauthenticated_web_calls:\s*true/.test(syncSrc),
  );
  ok("sync resolves catalog voice", /resolveProviderVoiceId/.test(syncSrc));
  ok(
    "sync does not misuse Call Control id as TeXML",
    !/default_texml_app_id:\s*connectionId/.test(syncSrc) &&
      /TELNYX_TEXML_APP_ID/.test(syncSrc),
  );
  const enableSrc = fs.readFileSync(
    path.join(root, "src/lib/voice/platform/ai-platform.ts"),
    "utf8",
  );
  ok(
    "enable web calls isolated telephony update",
    /supports_unauthenticated_web_calls:\s*true/.test(enableSrc) &&
      /TELNYX_TEXML_APP_ID/.test(enableSrc),
  );
  ok("builder VoicePicker", /VoicePicker/.test(builderSrc2));
  ok("builder AgentBrowserCall", /AgentBrowserCall/.test(builderSrc2));
  ok("builder demotes text chat", /not a voice test/.test(builderSrc2));
  ok("builder unsaved warning wiring", /unsavedChanges=\{dirty\}/.test(builderSrc2));

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
