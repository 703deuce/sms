/** Client-safe transfer helpers for the appointment receptionist wizard. */

/** Canonical escalate_human target used by flow global rules. */
export const WIZARD_HANDOFF_NAME = "Agent Handoff";

export function normalizeWizardTransferPhone(raw: string): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function wizardTransferDestinationName(name: string): string {
  const trimmed = String(name || "").trim();
  return trimmed || WIZARD_HANDOFF_NAME;
}
