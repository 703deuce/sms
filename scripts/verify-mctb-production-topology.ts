/**
 * Fail when production web commitSha != SMS worker commitSha (Coolify drift).
 *
 * Env:
 *   MCTB_PROD_CERT_BASE_URL — web origin (production base URL from cert env)
 *   MCTB_SMS_WORKER_HEALTH_URL — worker /health (optional; required for strict check)
 *
 * Run:
 *   MCTB_PROD_CERT_BASE_URL=https://… MCTB_SMS_WORKER_HEALTH_URL=http://…:8082/health \
 *     npx tsx scripts/verify-mctb-production-topology.ts
 */
const base = process.env.MCTB_PROD_CERT_BASE_URL?.trim().replace(/\/$/, "");
const workerUrl = process.env.MCTB_SMS_WORKER_HEALTH_URL?.trim();

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Non-JSON from ${url}: ${text.slice(0, 200)}`);
  }
}

async function main() {
  if (!base) {
    console.error("verify-mctb-production-topology: set MCTB_PROD_CERT_BASE_URL");
    process.exit(2);
  }

  const web = await fetchJson(`${base}/api/health`);
  const webSha = String(web.commitSha || "").trim();
  if (!webSha) {
    console.error("verify-mctb-production-topology: web /api/health missing commitSha");
    process.exit(1);
  }

  if (!workerUrl) {
    console.warn(
      "verify-mctb-production-topology: SKIP worker parity (MCTB_SMS_WORKER_HEALTH_URL unset). web=" +
        webSha,
    );
    process.exit(0);
  }

  const worker = await fetchJson(workerUrl);
  const workerSha = String(worker.commitSha || "").trim();
  if (!workerSha) {
    console.error("verify-mctb-production-topology: worker health missing commitSha");
    process.exit(1);
  }

  if (webSha !== workerSha) {
    console.error(
      `verify-mctb-production-topology: FAIL web=${webSha} worker=${workerSha}`,
    );
    process.exit(1);
  }

  console.log(`verify-mctb-production-topology: PASS web=${webSha} worker=${workerSha}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
