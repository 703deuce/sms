#!/usr/bin/env npx tsx
/**
 * Phase 2B — real Redis L2 latency (requires REDIS_URL).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/benchmark-voice-v2-redis-phase-2b.ts
 */
import { performance } from "node:perf_hooks";
import {
  resetVoiceV2CallContextStoreSingleton,
  resetVoiceV2CallContextStoreForTests,
  createVoiceV2CallContext,
  loadVoiceV2CallContextRecord,
  resolveVoiceV2SessionKey,
  getVoiceV2CallContextStoreMode,
} from "../src/lib/voice-v2/session/call-context-store";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import { clearVoiceV2CallSessions } from "../src/lib/voice-v2/intake/session-store";

function pct(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(samples: number[]) {
  const s = [...samples].sort((a, b) => a - b);
  return { p50: pct(s, 50), p95: pct(s, 95), max: s[s.length - 1] ?? 0 };
}

async function main() {
  if (!process.env.REDIS_URL?.trim()) {
    console.log(
      JSON.stringify({
        REDIS_BENCHMARK: "SKIP_NO_REDIS_URL",
        note: "Set REDIS_URL for production-class L2 measurements.",
      }),
    );
    process.exit(0);
  }

  delete process.env.VOICE_V2_ALLOW_MEMORY_L2;
  resetVoiceV2CallContextStoreSingleton();
  clearVoiceV2CallSessions();

  const creates: number[] = [];
  const gets: number[] = [];
  const aliases: number[] = [];
  const schema = intakeSchemaFromWizardOnly({
    fields: { name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" } },
  });

  for (let i = 0; i < 20; i++) {
    const cc = `redis-bench-${i}`;
    const tAlias = performance.now();
    await resolveVoiceV2SessionKey({ callControlId: cc });
    aliases.push(performance.now() - tAlias);

    const tCreate = performance.now();
    await createVoiceV2CallContext(
      {
        payload: {
          sessionKey: `cc:${cc}`,
          workspaceId: "ws_test",
          agentId: "agent_test",
          businessTimezone: "America/New_York",
          intakeSchema: schema,
          intakeState: {},
          askedFields: {},
          compiledAt: new Date().toISOString(),
          intakeSaveCount: 0,
        },
        identity: {
          sessionKey: `cc:${cc}`,
          callId: `call-${i}`,
          workspaceId: "ws_test",
          agentId: "agent_test",
          telnyxCallControlId: cc,
        },
        enrollment: { enrolledAt: new Date().toISOString() },
      },
      { l2Persist: "await" },
    );
    creates.push(performance.now() - tCreate);

    const tGet = performance.now();
    await loadVoiceV2CallContextRecord(`cc:${cc}`);
    gets.push(performance.now() - tGet);
  }

  console.log(
    JSON.stringify(
      {
        storeMode: getVoiceV2CallContextStoreMode(),
        L2_CREATE_MS: summarize(creates),
        L2_GET_MS: summarize(gets),
        ALIAS_LOOKUP_MS: summarize(aliases),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
