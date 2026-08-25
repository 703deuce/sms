/**
 * Next.js server boot hook — MCTB-only production.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  console.log(
    JSON.stringify({
      service: "transovo-web",
      event: "web_boot_started",
      product: "mctb-only",
      timestamp: new Date().toISOString(),
    }),
  );

  const { startInProcessWorker } = await import("@/lib/jobs/inprocess-worker");
  await startInProcessWorker();
}
