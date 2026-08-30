/**
 * A/B/C benchmark: same inbox video, same lean prompt, different model/reasoning settings.
 *
 *   npx tsx scripts/ui-agent/kimi-reasoning-benchmark.ts
 *   npx tsx scripts/ui-agent/kimi-reasoning-benchmark.ts --variant B
 *
 * Variants:
 *   A = kimi-k3 + reasoning_effort high (prior default behavior)
 *   B = kimi-k3 + reasoning_effort low (recommended for UI codegen)
 *   C = kimi-k2.7-code (thinking always on; no reasoning_effort)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildReferenceImplementation } from "./reference-builder";
import { KimiVisionProvider } from "./kimi-client";
import { buildProjectManifest } from "./project-context";
import { resolveAllReferenceMediaForKimi } from "./reference-resolve";
import { listGeneratedFiles } from "./generated-sandbox";
import { initProgress, progressTailPath } from "./progress";
import { startKimiTiming, printKimiTimingReport, getKimiTiming } from "./kimi-timing";
import { auditPath } from "./kimi-request-audit";
import { createSessionId, saveSession } from "./session";
import { REPO_ROOT, UI_AGENT_REPORTS_DIR } from "./config";
import { log } from "./logger";

const INBOX_VIDEO = "Navigating the SlickText Inbox SlickText Tutorials - SlickText (360p)";
const TARGET = "/conversations";
const INSTRUCTION =
  "Recreate SlickText inbox + Transovo-branded sidebar (keep nav links). Mock data OK. Emit files with KIMI_FILE_BEGIN/END.";

const VARIANTS = {
  A: { label: "K3-high", model: "kimi-k3", reasoningEffort: "high" as const },
  B: { label: "K3-low", model: "kimi-k3", reasoningEffort: "low" as const },
  C: { label: "K2.7-code", model: "kimi-k2.7-code" },
};

const BENCHMARK_TIMEOUT_MS = Number(process.env.KIMI_BENCHMARK_TIMEOUT_MS || 20 * 60 * 1000);

async function runVariant(key: keyof typeof VARIANTS): Promise<Record<string, unknown>> {
  const variant = VARIANTS[key];
  const sessionId = `${createSessionId()}-bench-${key}`;
  const manifest = buildProjectManifest(TARGET);

  saveSession({
    id: sessionId,
    createdAt: new Date().toISOString(),
    target: TARGET,
    instruction: INSTRUCTION,
    referenceMedia: [],
    currentMedia: [],
    manifest,
    generatedDir: `.ui-agent/generated/${sessionId}`,
    status: "generating",
  });

  initProgress(sessionId, `Benchmark ${key} (${variant.label})`);
  startKimiTiming(sessionId);
  log("benchmark", `${key}: ${variant.label} session=${sessionId}`);

  const referenceMedia = await resolveAllReferenceMediaForKimi({
    videoNames: [INBOX_VIDEO],
    imageNames: [],
    videoFiles: [],
    imageFiles: [],
    legacyNames: [],
  });

  const provider = await KimiVisionProvider.createValidated({
    model: variant.model,
    reasoningEffort: "reasoningEffort" in variant ? variant.reasoningEffort : undefined,
  });

  const started = Date.now();
  let files: string[] = [];
  let error: string | undefined;

  const timeout = setTimeout(() => {
    log("benchmark", `${key}: timeout after ${BENCHMARK_TIMEOUT_MS}ms`);
  }, BENCHMARK_TIMEOUT_MS);

  try {
    const build = await buildReferenceImplementation(provider, {
      sessionId,
      target: TARGET,
      manifest,
      referenceMedia,
      currentMedia: [],
      instruction: INSTRUCTION,
    });
    files = build.files;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeout);
  }

  printKimiTimingReport(sessionId);
  const timing = getKimiTiming(sessionId);

  return {
    variant: key,
    label: variant.label,
    model: variant.model,
    reasoningEffort: "reasoningEffort" in variant ? variant.reasoningEffort : null,
    sessionId,
    elapsedMs: Date.now() - started,
    files: listGeneratedFiles(sessionId),
    error,
    timing,
    payloadAudit: auditPath(sessionId),
    progressLog: progressTailPath(sessionId),
  };
}

async function main(): Promise<void> {
  const only = process.argv.find((a) => a.startsWith("--variant="))?.split("=")[1]?.toUpperCase() as
    | keyof typeof VARIANTS
    | undefined;
  const keys = only && VARIANTS[only] ? [only] : (["A", "B", "C"] as const);

  mkdirSync(UI_AGENT_REPORTS_DIR, { recursive: true });
  const results: Record<string, unknown>[] = [];

  for (const key of keys) {
    console.log(`\n========== Benchmark ${key}: ${VARIANTS[key].label} ==========\n`);
    results.push(await runVariant(key));
  }

  const reportPath = join(UI_AGENT_REPORTS_DIR, `kimi-reasoning-benchmark-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify({ recordedAt: new Date().toISOString(), results }, null, 2), "utf8");

  console.log("\n========== Benchmark summary ==========\n");
  for (const r of results) {
    const t = r.timing as ReturnType<typeof getKimiTiming>;
    console.log(
      `${r.variant} ${r.label}: first_reasoning=${fmt(t.firstReasoningTokenMs)} first_content=${fmt(t.firstContentTokenMs)} first_file=${fmt(t.firstCompleteFileMs)} total=${fmt(t.generationTotalMs)} files=${(r.files as string[]).length}${r.error ? ` ERROR=${r.error}` : ""}`,
    );
  }
  console.log(`\nFull report: ${reportPath}\n`);
}

function fmt(ms?: number): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
