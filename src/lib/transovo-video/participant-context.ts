export function buildParticipantContext(input: {
  displayName: string;
  transovoParticipantId: string;
  role: string;
}): string {
  return JSON.stringify({
    displayName: input.displayName,
    transovoParticipantId: input.transovoParticipantId,
    role: input.role,
  });
}

export function parseParticipantContext(context?: string | null): {
  displayName?: string;
  transovoParticipantId?: string;
  role?: string;
} {
  if (!context) return {};
  try {
    const parsed = JSON.parse(context) as Record<string, unknown>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : undefined,
      transovoParticipantId:
        typeof parsed.transovoParticipantId === "string"
          ? parsed.transovoParticipantId
          : undefined,
      role: typeof parsed.role === "string" ? parsed.role : undefined,
    };
  } catch {
    return {};
  }
}
