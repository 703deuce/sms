import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  loadMctbSetupPhoneOptions,
  loadWorkspaceAccessiblePhoneNumbers,
} from "@/lib/numbers/workspace-accessible-numbers";

function sameE164(a: string, b: string): boolean {
  try {
    return normalizeE164(a) === normalizeE164(b);
  } catch {
    return a.replace(/\D/g, "") === b.replace(/\D/g, "");
  }
}

/** True when phoneNumberId is a valid MCTB setup option for this workspace. */
export async function isMctbSetupPhoneAccessible(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
): Promise<boolean> {
  if (!phoneNumberId?.trim()) return false;
  const canonical = await resolveCanonicalMctbSetupPhoneId(workspaceId, phoneNumberId);
  return Boolean(canonical);
}

/**
 * Map stale linked/duplicate ids to the workspace-owned row for the same E.164.
 * Ensures the dropdown switcher always provisions the real workspace DID.
 */
export async function resolveCanonicalMctbSetupPhoneId(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
): Promise<string | null> {
  if (!phoneNumberId?.trim()) return null;

  const options = await loadMctbSetupPhoneOptions(workspaceId);
  const direct = options.find((p) => p.id === phoneNumberId);
  if (direct) return direct.id;

  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findUnique({
    where: { id: phoneNumberId },
    select: { e164: true },
  });
  if (!row?.e164) return null;

  const owned = options.find(
    (p) => p.source === "owned" && sameE164(p.e164, row.e164),
  );
  if (owned) return owned.id;

  const anyMatch = options.find((p) => sameE164(p.e164, row.e164));
  return anyMatch?.id ?? null;
}

/** Drop stale ids; resolve duplicate E.164 rows to the canonical workspace DID. */
export async function sanitizeMctbSetupPhoneNumberId(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
): Promise<string | null> {
  return resolveCanonicalMctbSetupPhoneId(workspaceId, phoneNumberId);
}

/** @deprecated use loadMctbSetupPhoneOptions for MCTB setup UI */
export async function loadMctbSetupPhonesForValidation(workspaceId: string) {
  return loadWorkspaceAccessiblePhoneNumbers(workspaceId);
}
