/**
 * Step through LiveKit SIP API calls used during ensureNumberProvisioned.
 * Usage: MEDIA_BACKEND_MODE=... LIVEKIT_*=... npx tsx scripts/livekit-sip-probe.ts [--e164=+15714073615]
 */
import { getLiveKitBackendConfig, getMediaBackendMode } from "@/lib/voice/media-backend/config";
import { getLiveKitSipClientForBackend } from "@/lib/voice/media-backend/client";
import type { MediaBackend } from "@/lib/voice/media-backend/types";

const e164 = process.argv.find((a) => a.startsWith("--e164="))?.split("=")[1] || "+15714073615";

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    const summary =
      Array.isArray(result)
        ? { count: result.length }
        : result && typeof result === "object"
          ? { keys: Object.keys(result as object).slice(0, 8) }
          : { result };
    console.log(JSON.stringify({ step: name, ok: true, ...summary }));
    return result;
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; code?: string; metadata?: unknown };
    console.log(
      JSON.stringify({
        step: name,
        ok: false,
        error: e?.message || String(err),
        status: e?.status,
        code: e?.code,
      }),
    );
    throw err;
  }
}

async function probeBackend(backend: MediaBackend) {
  const cfg = getLiveKitBackendConfig(backend);
  console.log(
    JSON.stringify({
      backend,
      apiUrl: cfg.url,
      sipHost: cfg.sipHost,
      inboundTrunkId: cfg.inboundTrunkId,
      dispatchRuleId: cfg.dispatchRuleId,
    }),
  );
  const client = getLiveKitSipClientForBackend(backend);
  await step(`${backend}:listSipInboundTrunk`, () => client.listSipInboundTrunk());
  if (cfg.inboundTrunkId) {
    await step(`${backend}:listSipInboundTrunk(id)`, () =>
      client.listSipInboundTrunk({ trunkIds: [cfg.inboundTrunkId!] }),
    );
  }
  await step(`${backend}:listSipDispatchRule`, () => client.listSipDispatchRule());
}

async function main() {
  console.log(JSON.stringify({ activeMode: getMediaBackendMode(), e164 }));
  const mode = getMediaBackendMode();
  await probeBackend(mode);
  if (mode !== "livekit_cloud") {
    await probeBackend("livekit_cloud");
  }
  if (mode !== "self_hosted") {
    await probeBackend("self_hosted");
  }
}

main().catch(() => process.exit(1));
