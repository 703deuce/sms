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

export function voiceRuntimeImpl(): "python" | "typescript" {
  const raw = (process.env.VOICE_RUNTIME_IMPL || "python").trim().toLowerCase();
  if (raw === "typescript" || raw === "ts") return "typescript";
  return "python";
}

export function inProcessVoiceRuntimeEnabled(): boolean {
  if (!isLiveKitVoiceRuntime()) return false;
  if (process.env.DISABLE_INPROCESS_VOICE_RUNTIME === "1") return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return true;
}

function resolveTypescriptSpawn(): { command: string; args: string[] } {
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

function resolvePythonSpawn(): { command: string; args: string[] } {
  const venvPython = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "voice-runtime-python",
    ".venv",
    "bin",
    "python",
  );
  if (existsSync(venvPython)) {
    return { command: venvPython, args: ["-m", "transovo_voice.main", "start"] };
  }
  return { command: "python3", args: ["-m", "transovo_voice.main", "start"] };
}

function resolveVoiceRuntimeSpawn(): { command: string; args: string[]; impl: "python" | "typescript" } {
  const impl = voiceRuntimeImpl();
  if (impl === "python") {
    return { ...resolvePythonSpawn(), impl };
  }
  return { ...resolveTypescriptSpawn(), impl };
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
  const { command, args, impl } = resolveVoiceRuntimeSpawn();
  const logPrefix = impl === "python" ? "voice-python" : "voice-runtime";

  console.log(
    `[${logPrefix}] spawning ${TRANSOVO_LIVEKIT_AGENT_NAME} via ${path.basename(command)} impl=${impl} (${url})`,
  );

  const child = spawn(command, args, {
    env: {
      ...process.env,
      LIVEKIT_AGENT_NAME: TRANSOVO_LIVEKIT_AGENT_NAME,
      PYTHONPATH: path.join(/* turbopackIgnore: true */ process.cwd(), "voice-runtime-python"),
    },
    cwd:
      impl === "python"
        ? path.join(/* turbopackIgnore: true */ process.cwd(), "voice-runtime-python")
        : /* turbopackIgnore: true */ process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  globalThis.__transovoVoiceRuntimeChild = child;
  attachChildLogging(child, logPrefix);
  attachGracefulShutdown(child);

  child.on("exit", (code, signal) => {
    console.error(
      `[${logPrefix}] child exited code=${code ?? "null"} signal=${signal ?? "null"} — redeploy to recover`,
    );
    globalThis.__transovoInProcessVoiceRuntimeStarted = false;
    globalThis.__transovoVoiceRuntimeChild = undefined;
  });

  child.on("error", (err) => {
    console.error(`[${logPrefix}] failed to spawn child`, err);
    globalThis.__transovoInProcessVoiceRuntimeStarted = false;
    globalThis.__transovoVoiceRuntimeChild = undefined;
  });
}
