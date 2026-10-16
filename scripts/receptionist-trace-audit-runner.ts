/**
 * Full receptionist wizard trace audit: hydrate prod DB, start Next with tracing,
 * Playwright walkthrough (save per step + publish scenario), extract log lines.
 *
 * Usage:
 *   npx tsx scripts/receptionist-trace-audit-runner.ts
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import {
  hydrateProdDatabaseUrlFromCoolify,
  hydrateProdSupabaseFromCoolify,
} from "./cloud-agent/hydrate-prod-test-env";

const PORT = Number(process.env.RECEPTIONIST_TRACE_AUDIT_PORT || 3015);
const BASE = `http://127.0.0.1:${PORT}`;
const ARTIFACT_DIR = "/opt/cursor/artifacts";
const SERVER_LOG = path.join(ARTIFACT_DIR, "receptionist-trace-server.log");
const EXTRACT_LOG = path.join(ARTIFACT_DIR, "receptionist-trace-extract.log");
const AUDIT_JSON = path.join(ARTIFACT_DIR, "receptionist-trace-audit.json");

const TRACE_PATTERNS = [
  "[RECEPTIONIST]",
  "receptionist_config_trace",
  "VOICE_V3_WIZARD_BROWSER_LIVE",
];

async function waitForServer(maxMs = 180_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(2000);
  }
  throw new Error(`Server did not become ready on ${BASE} within ${maxMs}ms`);
}

function startDevServer(): ChildProcess {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(SERVER_LOG, `--- receptionist trace audit server log port=${PORT} ---\n`);

  const env = {
    ...process.env,
    PORT: String(PORT),
    RECEPTIONIST_CONFIG_TRACE: "1",
    RECEPTIONIST_CONFIG_TRACE_VERBOSE: "1",
    NEXT_PUBLIC_RECEPTIONIST_CONFIG_TRACE: "1",
    DEV_AUTH_BYPASS: "1",
    DEV_AUTH_BYPASS_AUTO: "1",
  };

  const child = spawn("npm", ["run", "dev", "--", "-p", String(PORT)], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (buf: Buffer) => {
    appendFileSync(SERVER_LOG, buf.toString());
  });
  child.stderr?.on("data", (buf: Buffer) => {
    appendFileSync(SERVER_LOG, buf.toString());
  });

  return child;
}

async function runPlaywrightAudit(): Promise<Record<string, unknown>> {
  const { chromium } = await import("playwright");

  const apiTraces: Array<{
    step: string;
    status: number;
    receptionistTraceId?: string;
    published?: boolean;
    liveSyncPending?: boolean;
  }> = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[RECEPTIONIST][UI_CHANGE]")) {
      appendFileSync(SERVER_LOG, `[browser-console] ${text}\n`);
    }
  });

  await page.goto(`${BASE}/api/auth/dev-bypass?next=/voice/receptionist/edit`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });

  await page.waitForURL(/\/voice\/receptionist/, { timeout: 120_000 });

  const steps = [
    "goals",
    "phone",
    "information",
    "appointments",
    "call-handling",
    "voice",
    "test",
    "activate",
  ] as const;

  for (const step of steps) {
    await page.goto(`${BASE}/voice/receptionist/edit?step=${step}`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    await sleep(1500);

    if (step === "appointments") {
      const sendLink = page.getByRole("radio", { name: /send.*link/i }).first();
      if (await sendLink.isVisible().catch(() => false)) {
        await sendLink.click();
      }
    }

    const saveBtn = page
      .getByRole("button", { name: /save draft/i })
      .or(page.getByRole("button", { name: /save & continue/i }))
      .first();
    if (await saveBtn.isVisible().catch(() => false)) {
      const [res] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/api/solutions/appointment-receptionist") &&
            r.request().method() === "POST",
          { timeout: 120_000 },
        ),
        saveBtn.click(),
      ]);
      let json: { data?: Record<string, unknown> } = {};
      try {
        json = await res.json();
      } catch {
        json = {};
      }
      apiTraces.push({
        step,
        status: res.status(),
        receptionistTraceId: json.data?.receptionistTraceId as string | undefined,
        published: json.data?.published as boolean | undefined,
        liveSyncPending: json.data?.liveSyncPending as boolean | undefined,
      });
      await sleep(2000);
    }
  }

  await browser.close();
  return { apiTraces, stepsAttempted: steps.length };
}

function extractTraceLines(): string[] {
  const raw = readFileSync(SERVER_LOG, "utf8");
  const lines = raw.split("\n");
  return lines.filter((line) =>
    TRACE_PATTERNS.some((p) => line.includes(p)),
  );
}

async function main() {
  if (!hydrateProdDatabaseUrlFromCoolify()) {
    console.error("FAIL: could not hydrate DATABASE_URL");
    process.exit(1);
  }
  hydrateProdSupabaseFromCoolify();

  const server = startDevServer();
  try {
    await waitForServer();
    console.log("Server ready:", BASE);
    const audit = await runPlaywrightAudit();
    await sleep(3000);
    const extracted = extractTraceLines();
    writeFileSync(EXTRACT_LOG, extracted.join("\n"));
    const summary = {
      port: PORT,
      serverLog: SERVER_LOG,
      extractLog: EXTRACT_LOG,
      extractedLineCount: extracted.length,
      phases: {
        UI_CHANGE: extracted.filter((l) => l.includes("UI_CHANGE")).length,
        SAVE_DRAFT: extracted.filter((l) => l.includes("SAVE_DRAFT")).length,
        MERGE: extracted.filter((l) => l.includes("MERGE")).length,
        PUBLISH: extracted.filter((l) => l.includes("PUBLISH")).length,
        PUBLISH_DIFF: extracted.filter((l) => l.includes("PUBLISH_DIFF")).length,
        RUNTIME_LOAD: extracted.filter((l) => l.includes("RUNTIME_LOAD")).length,
        SIDE_EFFECT: extracted.filter((l) => l.includes("SIDE_EFFECT")).length,
      },
      audit,
    };
    writeFileSync(AUDIT_JSON, JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    if (extracted.length < 5) {
      console.warn("WARN: few trace lines captured — check", SERVER_LOG);
      process.exitCode = 1;
    }
  } finally {
    server.kill("SIGTERM");
    await sleep(2000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
