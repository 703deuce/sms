/** Structured logs for PSTN bridge certification (grep server logs during test call). */
export function logRealtimeBridgeEvent(
  event: string,
  fields: Record<string, unknown>,
): void {
  console.info(
    JSON.stringify({
      source: "realtime_bridge",
      event,
      ts: new Date().toISOString(),
      ...fields,
    }),
  );
}
