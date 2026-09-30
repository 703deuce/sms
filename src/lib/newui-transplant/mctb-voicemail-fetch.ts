/** Build voicemail inbox API URL (server expects `phoneNumberId`, not `numberId`). */
export function mctbVoicemailInboxUrl(phoneNumberId?: string): string {
  const params = new URLSearchParams();
  if (phoneNumberId?.trim()) {
    params.set("phoneNumberId", phoneNumberId.trim());
  }
  const qs = params.toString();
  return qs ? `/api/phone/voicemail?${qs}` : "/api/phone/voicemail";
}

export async function ensureVoicemailNumberBox(phoneNumberId: string): Promise<void> {
  const res = await fetch("/api/phone/voicemail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "ensure_number_box", phoneNumberId }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || "Could not prepare voicemail");
  }
}

export async function markVoicemailMessageReviewed(messageId: string): Promise<void> {
  const res = await fetch("/api/phone/voicemail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "mark_resolved", messageId }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || "Could not update voicemail");
  }
}
