/**
 * Start transovo-voice-runtime inside the Coolify web container so operators
 * don't need a second service. Spawns the same entrypoint as
 * `npm run voice-runtime:start`.
 *
 * Disable with DISABLE_INPROCESS_VOICE_RUNTIME=1 when running the worker
 * externally (second Coolify service or `lk agent deploy`).
 */

import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { TRANSOVO_LIVEKIT_AGENT_NAME } from "@/lib/telephony/provisioning/config";
import {
  isLiveKitVoiceRuntime,
  requireLiveKitEnv,
} from "@/lib/voice/runtime-provider/config";

declare global {
  // eslint-disable-next-line no-var
  var __transovoInProcessVoiceRuntimeStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __transovoVoiceRuntimeChild: ChildProcess | undefined;
}

function hasVoiceRuntimeCredentials(): boolean {
  try {
    requireLiveKitEnv();
  } catch {
    return false;
  }
  if (!process.env.DATABASE_URL?.trim()) return false;
  if (!process.env.OPENAI_API_KEY?.trim()) return false;
  return true;
}

export function inProcessVoiceRuntimeEnabled(): boolean {
  if (!isLiveKitVoiceRuntime()) return false;
  if (process.env.DISABLE_INPROCESS_VOICE_RUNTIME === "1") return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return true;
}

function resolveVoiceRuntimeSpawn(): { command: string; args: string[] } {
  const entry = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "voice-runtime",
    "src",
    "main.ts",
  );
  const tsxBin = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "node_modules",
    ".bin",
    "tsx",
  );
  if (existsSync(tsxBin)) {
    return { command: tsxBin, args: [entry, "start"] };
  }
  return { command: "npx", args: ["tsx", entry, "start"] };
}

function attachChildLogging(child: ChildProcess) {
  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(`[voice-runtime] ${chunk}`);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[voice-runtime] ${chunk}`);
  });
}

function attachGracefulShutdown(child: ChildProcess) {
  const shutdown = () => {
    if (child.killed || child.exitCode !== null) return;
    child.kill("SIGTERM");
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

/**
 * Spawn the LiveKit voice worker as a child of the Next.js process.
 * Safe to call multiple times — only the first call starts a child.
 */
export async function startInProcessVoiceRuntime(): Promise<void> {
  if (!inProcessVoiceRuntimeEnabled()) {
    console.log(
      "[voice-runtime] in-process worker disabled (not livekit mode, DISABLE_INPROCESS_VOICE_RUNTIME=1, or build phase)",
    );
    return;
  }

  if (!hasVoiceRuntimeCredentials()) {
    console.warn(
      "[voice-runtime] skipping in-process worker — set LIVEKIT_*, DATABASE_URL, and OPENAI_API_KEY",
    );
    return;
  }

  if (globalThis.__transovoInProcessVoiceRuntimeStarted) return;
  globalThis.__transovoInProcessVoiceRuntimeStarted = true;

  const { url } = requireLiveKitEnv();
  const { command, args } = resolveVoiceRuntimeSpawn();

  console.log(
    `[voice-runtime] spawning ${TRANSOVO_LIVEKIT_AGENT_NAME} via ${path.basename(command)} (${url})`,
  );

  const child = spawn(command, args, {
    env: {
      ...process.env,
      LIVEKIT_AGENT_NAME: TRANSOVO_LIVEKIT_AGENT_NAME,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  globalThis.__transovoVoiceRuntimeChild = child;
  attachChildLogging(child);
  attachGracefulShutdown(child);

  child.on("exit", (code, signal) => {
    console.error(
      `[voice-runtime] child exited code=${code ?? "null"} signal=${signal ?? "null"} — redeploy to recover`,
    );
    globalThis.__transovoInProcessVoiceRuntimeStarted = false;
    globalThis.__transovoVoiceRuntimeChild = undefined;
  });

  child.on("error", (err) => {
    console.error("[voice-runtime] failed to spawn child", err);
    globalThis.__transovoInProcessVoiceRuntimeStarted = false;
    globalThis.__transovoVoiceRuntimeChild = undefined;
  });
}
