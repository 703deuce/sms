/** Lightweight job dispatch — MCTB recovery uses DB SCHEDULED rows + processDueMctbRecoverySends. */
export async function enqueueJob(name: string, payload: unknown): Promise<void> {
  if (name === "phone_mctb_recovery_send") {
    const { processDueMctbRecoverySends } = await import("@/lib/server/mctb/recovery-scheduler");
    const p = payload as { workspaceId?: string };
    await processDueMctbRecoverySends({ workspaceId: p.workspaceId });
    return;
  }
}
