import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

type VoiceV3Bundle = {
  resolveVoiceV3LiveKitSession: (payload: unknown) => Promise<unknown>;
  executeVoiceV3ToolForLiveKit: (payload: unknown) => Promise<unknown>;
  resolveVoiceV3DelegatedRuntimeContextForLiveKit?: (payload: unknown) => Promise<unknown>;
  commitVoiceV3CallerUtteranceForLiveKit?: (payload: unknown) => Promise<unknown>;
};

let bundlePromise: Promise<VoiceV3Bundle | null> | null = null;

async function loadBundle(): Promise<VoiceV3Bundle | null> {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const bundlePath = path.join(
        process.cwd(),
        "lib/server/receptionist/runtime/voice-v3-runtime.bundle.mjs",
      );
      if (!existsSync(bundlePath)) return null;
      try {
        const mod = await import(/* webpackIgnore: true */ bundlePath);
        if (typeof mod.resolveVoiceV3LiveKitSession !== "function") return null;
        return mod as VoiceV3Bundle;
      } catch (err) {
        console.warn("VOICE_V3_BUNDLE_LOAD_FAILED", err);
        return null;
      }
    })();
  }
  return bundlePromise;
}

export async function resolveVoiceV3LiveKitSessionMonolith(payload: unknown) {
  const bundle = await loadBundle();
  if (!bundle) throw new Error("voice_v3_bundle_unavailable");
  return bundle.resolveVoiceV3LiveKitSession(payload);
}

export async function executeVoiceV3ToolMonolith(payload: unknown) {
  const bundle = await loadBundle();
  if (!bundle) throw new Error("voice_v3_bundle_unavailable");
  return bundle.executeVoiceV3ToolForLiveKit(payload);
}

export async function resolveDelegatedContextMonolith(payload: unknown) {
  const bundle = await loadBundle();
  if (!bundle?.resolveVoiceV3DelegatedRuntimeContextForLiveKit) {
    return { liveContextEvents: [] };
  }
  return bundle.resolveVoiceV3DelegatedRuntimeContextForLiveKit(payload);
}

export async function commitCallerUtteranceMonolith(payload: unknown) {
  const bundle = await loadBundle();
  if (!bundle?.commitVoiceV3CallerUtteranceForLiveKit) {
    return { committed: true, sequence: 1, turnId: "turn_stub" };
  }
  return bundle.commitVoiceV3CallerUtteranceForLiveKit(payload);
}
