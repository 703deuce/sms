export type EntitlementResult = { ok: true } | { ok: false; error: string };
export async function checkCreditBalance(_workspaceId: string): Promise<EntitlementResult> {
  return { ok: true };
}
