/** Twilio TFV external reference — use phoneNumber row id (Twilio rejects colons/hyphens in prefixed refs). */

export function buildMctbTfvExternalReferenceId(
  _workspaceId: string,
  phoneNumberId: string,
): string {
  return phoneNumberId;
}

export function parseMctbTfvExternalReferenceId(
  externalReferenceId: string,
): { workspaceId: string; phoneNumberId: string } | null {
  const trimmed = externalReferenceId.trim();
  if (!trimmed) return null;

  // Primary: canonical phoneNumber.id (cuid)
  if (/^c[a-z0-9]{8,}$/i.test(trimmed)) {
    return { workspaceId: "", phoneNumberId: trimmed };
  }

  const underscore = trimmed.match(/^mctb-tfv_([^_]+)_(.+)$/);
  if (underscore) {
    return { workspaceId: underscore[1]!, phoneNumberId: underscore[2]! };
  }

  // Legacy colon format (invalid for Twilio submit; kept for webhook parsing).
  if (trimmed.startsWith("mctb-tfv:")) {
    const parts = trimmed.split(":");
    const workspaceId = parts[1];
    const phoneNumberId = parts[2];
    if (workspaceId && phoneNumberId) return { workspaceId, phoneNumberId };
  }

  return null;
}

export function isMctbTfvExternalReferenceId(
  workspaceId: string,
  phoneNumberId: string,
  externalReferenceId: string,
): boolean {
  if (externalReferenceId === phoneNumberId) return true;
  const parsed = parseMctbTfvExternalReferenceId(externalReferenceId);
  return parsed?.workspaceId === workspaceId && parsed.phoneNumberId === phoneNumberId;
}
