import "server-only";

export function logMctbDurableOperationEvent(
  step: string,
  detail: Record<string, unknown>,
): void {
  console.info(
    "[mctb/durable-operation]",
    JSON.stringify({
      step,
      at: new Date().toISOString(),
      ...detail,
    }),
  );
}
