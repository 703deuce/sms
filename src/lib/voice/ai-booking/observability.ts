export function logVoiceAiBookingEvent(
  event: string,
  fields: Record<string, unknown> & { workspaceId: string; callId?: string | null },
) {
  console.log(
    JSON.stringify({
      event: "voice_ai_booking",
      kind: event,
      at: new Date().toISOString(),
      ...fields,
    }),
  );
}
