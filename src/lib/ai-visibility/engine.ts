export async function runAiVisibilityCheck(_input: unknown): Promise<unknown> {
  return { status: "skipped", reason: "not_configured" };
}
