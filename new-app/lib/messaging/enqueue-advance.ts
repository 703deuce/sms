/** Lightweight job dispatch — MCTB recovery uses durable job_queue + SCHEDULED rows. */
export async function enqueueJob(name: string, payload: unknown): Promise<void> {
  if (name === "phone_mctb_recovery_send") {
    const { processDueMctbRecoveryJobs } = await import("@/lib/server/jobs/mctb-jobs");
    const p = payload as { workspaceId?: string };
    await processDueMctbRecoveryJobs({ limit: p.workspaceId ? 10 : 25 });
    return;
  }
  if (name === "phone_mctb_recovery_tick") {
    const { runMctbRecoveryScheduler } = await import("@/lib/server/mctb/recovery-scheduler");
    await runMctbRecoveryScheduler();
    return;
  }
}
