/**
 * Sequential native-voice benchmark for outbound OpenAI Realtime (Amy receptionist A/B).
 *
 * Triggers Marin → Coral → Shimmer → Cedar by default (same prompt/flow/model/VAD).
 * Judge: which voice makes you forget fastest that Amy is AI?
 *
 * CLI (requires OUTBOUND_VOICE_TEST_MODE=1):
 *   OUTBOUND_VOICE_TEST_MODE=1 npx tsx scripts/outbound-realtime-voice-benchmark.ts \
 *     --phone=+15714776175
 *
 * HTTP (no redeploy between voices):
 *   for v in marin coral shimmer cedar; do
 *     curl -s -X POST "$APP_URL/api/voice/outbound/qualification/test" \
 *       -H "Authorization: Bearer $CRON_SECRET" \
 *       -H "Content-Type: application/json" \
 *       -d "{\"workspaceId\":\"ws_1\",\"destinationPhone\":\"+15714776175\",\"realtimeVoice\":\"$v\"}"
 *     sleep 180
 *   done
 *
 * Env:
 *   OUTBOUND_VOICE_BENCHMARK_VOICES=marin,coral,shimmer,cedar
 *   OUTBOUND_VOICE_BENCHMARK_DELAY_SEC=180   # pause between dials (default 3 min)
 */
import dotenv from "dotenv";
import { assertOutboundTestModeEnabled } from "../src/lib/voice/outbound/outbound-call-service";
import {
  OUTBOUND_REALTIME_VOICE_BENCHMARK,
  parseRealtimeNativeVoiceList,
} from "../src/lib/voice/outbound/realtime-native-voices";
import { triggerOutboundQualificationCall } from "../src/lib/voice/outbound/trigger-qualification-call";

dotenv.config();

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

function resolveVoices(): string[] {
  const fromArg = arg("voices");
  const fromEnv = process.env.OUTBOUND_VOICE_BENCHMARK_VOICES?.trim();
  if (fromArg) return parseRealtimeNativeVoiceList(fromArg, "voices");
  if (fromEnv) return parseRealtimeNativeVoiceList(fromEnv, "OUTBOUND_VOICE_BENCHMARK_VOICES");
  return [...OUTBOUND_REALTIME_VOICE_BENCHMARK];
}

function resolveDelaySec(): number {
  const raw = arg("delay-sec") || process.env.OUTBOUND_VOICE_BENCHMARK_DELAY_SEC || "180";
  const sec = Number(raw);
  if (!Number.isFinite(sec) || sec < 0) {
    throw new Error(`Invalid delay seconds: ${raw}`);
  }
  return sec;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  assertOutboundTestModeEnabled();

  const phone = arg("phone") || process.env.OUTBOUND_TEST_PHONE;
  if (!phone?.trim()) {
    throw new Error("Pass --phone=+1... or set OUTBOUND_TEST_PHONE");
  }

  const workspaceId = arg("workspace-id") || process.env.WORKSPACE_ID || "ws_1";
  const agentId = arg("agent-id");
  const voices = resolveVoices();
  const delaySec = resolveDelaySec();
  const dryRun = process.argv.includes("--dry-run");

  console.log(
    JSON.stringify({
      source: "outbound-voice-benchmark",
      event: "benchmark_plan",
      workspaceId,
      destinationPhone: phone,
      voices,
      delaySec,
      model: process.env.VOICE_REALTIME_MODEL?.trim() || "agent default",
      outputMode: process.env.VOICE_REALTIME_OUTPUT_MODE?.trim() || "native",
      vadMode: process.env.VOICE_REALTIME_VAD_MODE?.trim() || "semantic",
      vadEagerness: process.env.VOICE_REALTIME_VAD_EAGERNESS?.trim() || "high",
      dryRun,
    }),
  );

  const results: Array<{ voice: string; callId?: string; status?: string; error?: string }> = [];

  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    console.log(
      JSON.stringify({
        source: "outbound-voice-benchmark",
        event: "dial_start",
        index: i + 1,
        total: voices.length,
        voice,
      }),
    );

    if (dryRun) {
      results.push({ voice, status: "dry_run" });
      continue;
    }

    try {
      const result = await triggerOutboundQualificationCall({
        workspaceId,
        agentId,
        destinationPhone: phone,
        leadName: arg("lead-name") || "Anthony",
        triggerSource: "voice_benchmark_cli",
        triggerReason: `Native voice benchmark: ${voice}`,
        requireTestModeEnv: true,
        realtimeVoice: voice,
      });
      results.push({
        voice,
        callId: result.callId,
        status: result.status,
        ...(result.error ? { error: result.error } : {}),
      });
      console.log(
        JSON.stringify({
          source: "outbound-voice-benchmark",
          event: "dial_started",
          voice,
          callId: result.callId,
          status: result.status,
          roomName: result.roomName,
        }),
      );
      if (result.status === "failed") {
        console.error(`[outbound-voice-benchmark] ${voice} dial failed: ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ voice, status: "failed", error: message });
      console.error(`[outbound-voice-benchmark] ${voice} error:`, message);
    }

    if (i < voices.length - 1 && delaySec > 0) {
      console.log(
        JSON.stringify({
          source: "outbound-voice-benchmark",
          event: "waiting_before_next",
          delaySec,
          nextVoice: voices[i + 1],
        }),
      );
      await sleep(delaySec * 1000);
    }
  }

  console.log(
    JSON.stringify(
      {
        source: "outbound-voice-benchmark",
        event: "benchmark_complete",
        results,
      },
      null,
      2,
    ),
  );

  const failed = results.filter((r) => r.status === "failed" || r.error);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
