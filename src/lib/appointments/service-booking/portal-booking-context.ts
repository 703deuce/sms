import "server-only";

import { resolveClientPortalSession } from "./client-portal";
import { resolveHouseholdForContact } from "./household";

export async function resolveAuthorizedBookForContact(input: {
  portalToken?: string | null;
  bookForContactId?: string | null;
  workspaceId: string;
}): Promise<string | null> {
  const bookForContactId = input.bookForContactId?.trim();
  if (!bookForContactId) return null;

  const portalToken = input.portalToken?.trim();
  if (!portalToken) {
    throw new Error("Sign in to your account to book for a family member.");
  }

  const session = await resolveClientPortalSession(portalToken);
  if (!session || session.session.workspaceId !== input.workspaceId) {
    throw new Error("Your account session has expired. Sign in again from the portal.");
  }

  if (bookForContactId === session.session.contactId) {
    return bookForContactId;
  }

  const household = await resolveHouseholdForContact(input.workspaceId, session.session.contactId);
  const allowed = household?.members.some(
    (m: { contactId: string }) => m.contactId === bookForContactId,
  );
  if (!allowed) {
    throw new Error("You are not authorized to book for this person.");
  }

  return bookForContactId;
}
