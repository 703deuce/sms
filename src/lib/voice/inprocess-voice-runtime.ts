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

/** LiveKit voice is Python-only — no TypeScript worker exists. */
export function voiceRuntimeImpl(): "python" {
  return "python";
}

export function inProcessVoiceRuntimeEnabled(): boolean {
  if (!isLiveKitVoiceRuntime()) return false;
  if (process.env.ENABLE_INPROCESS_VOICE_RUNTIME !== "1") return false;
  if (process.env.DISABLE_INPROCESS_VOICE_RUNTIME === "1") return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return true;
}

function pythonVenvPath(): string {
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "voice-runtime-python",
    ".venv",
    "bin",
    "python",
  );
}

async function resolveVoiceRuntimeSpawn(): Promise<{
  command: string;
  args: string[];
}> {
  const { existsSync } = await import("node:fs");
  const venvPython = pythonVenvPath();
  if (existsSync(venvPython)) {
    return {
      command: venvPython,
      args: ["-m", "transovo_voice.main", "start"],
    };
  }
  throw new Error(
    "Python voice runtime venv not found — inbound calls require voice-runtime-python/.venv",
  );
}

function attachChildLogging(child: ChildProcess, prefix: string) {
  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(`[${prefix}] ${chunk}`);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[${prefix}] ${chunk}`);
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

function voiceRuntimeInternalUrl(): string {
  const explicit = process.env.TRANSOVO_BACKEND_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}`;
}

function spawnVoiceRuntimeChild(command: string, args: string[]): ChildProcess {
  const internalKey =
    process.env.TRANSOVO_INTERNAL_API_KEY?.trim() ||
    process.env.VOICE_RUNTIME_INTERNAL_SECRET?.trim() ||
    process.env.INTEGRATION_SECRET_KEY?.trim();

  return spawn(command, args, {
    env: {
      ...process.env,
      VOICE_WORKER_PROFILE: "v3",
      LIVEKIT_AGENT_NAME: TRANSOVO_LIVEKIT_AGENT_NAME,
      VOICE_V3_LIVEKIT_AGENT_NAME: TRANSOVO_LIVEKIT_AGENT_NAME,
      TRANSOVO_BACKEND_URL: voiceRuntimeInternalUrl(),
      ...(internalKey ? { TRANSOVO_INTERNAL_API_KEY: internalKey } : {}),
      PYTHONPATH: path.join(/* turbopackIgnore: true */ process.cwd(), "voice-runtime-python"),
    },
    cwd: path.join(/* turbopackIgnore: true */ process.cwd(), "voice-runtime-python"),
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
}

/** Spawn the Python LiveKit voice worker as a child of the Next.js process. */
export async function startInProcessVoiceRuntime(): Promise<void> {
  if (!inProcessVoiceRuntimeEnabled()) {
    console.log(
      "[voice-python] in-process worker disabled (not livekit mode, DISABLE_INPROCESS_VOICE_RUNTIME=1, or build phase)",
    );
    return;
  }

  if (!hasVoiceRuntimeCredentials()) {
    console.warn(
      "[voice-python] skipping in-process worker — set LIVEKIT_*, DATABASE_URL, and OPENAI_API_KEY",
    );
    return;
  }

  if (globalThis.__transovoInProcessVoiceRuntimeStarted) return;
  globalThis.__transovoInProcessVoiceRuntimeStarted = true;

  const { url } = requireLiveKitEnv();
  const { command, args } = await resolveVoiceRuntimeSpawn();

  console.log(
    `[voice-python] spawning ${TRANSOVO_LIVEKIT_AGENT_NAME} via ${path.basename(command)} (${url})`,
  );

  const child = spawnVoiceRuntimeChild(command, args);
  globalThis.__transovoVoiceRuntimeChild = child;
  attachChildLogging(child, "voice-python");
  attachGracefulShutdown(child);

  child.on("exit", (code, signal) => {
    console.error(
      `[voice-python] child exited code=${code ?? "null"} signal=${signal ?? "null"} — redeploy to recover`,
    );
    globalThis.__transovoInProcessVoiceRuntimeStarted = false;
    globalThis.__transovoVoiceRuntimeChild = undefined;
  });

  child.on("error", (err) => {
    console.error("[voice-python] failed to spawn child", err);
    globalThis.__transovoInProcessVoiceRuntimeStarted = false;
    globalThis.__transovoVoiceRuntimeChild = undefined;
  });
}
