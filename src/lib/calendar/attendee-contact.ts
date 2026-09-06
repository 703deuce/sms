import "server-only";

import { getPrisma } from "@/lib/db";
import { externalAttendees } from "@/lib/calendar/eligibility";
import { upsertExternalContact } from "@/lib/integrations/connections";
import type { ProviderCalendarEvent } from "@/lib/calendar/providers";

export type ResolvedAttendeeContact = {
  contactId: string | null;
  inviteeEmail: string | null;
  inviteeName: string | null;
  inviteePhone: string | null;
  smsCapable: boolean;
  emailOnly: boolean;
  matchedExistingContact: boolean;
  createdContact: boolean;
};

function splitName(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function phoneFromContact(phone: string | null | undefined) {
  if (!phone) return null;
  if (phone.startsWith("email:")) return null;
  return phone;
}

export async function resolveContactForImportedEvent(
  workspaceId: string,
  event: ProviderCalendarEvent,
  connectionEmail?: string | null,
): Promise<ResolvedAttendeeContact> {
  const attendees = externalAttendees(event, connectionEmail);
  const primary = attendees.find((a) => a.email) || null;
  const inviteeEmail = primary?.email?.trim().toLowerCase() || null;
  const inviteeName = primary?.name || null;

  if (!inviteeEmail) {
    return {
      contactId: null,
      inviteeEmail: null,
      inviteeName,
      inviteePhone: null,
      smsCapable: false,
      emailOnly: false,
      matchedExistingContact: false,
      createdContact: false,
    };
  }

  const { firstName, lastName } = splitName(inviteeName);
  const linked = await upsertExternalContact({
    workspaceId,
    email: inviteeEmail,
    firstName,
    lastName,
    source: "calendar_import",
    createIfMissing: true,
    overwrite: false,
  });

  if (!linked?.contactId) {
    return {
      contactId: null,
      inviteeEmail,
      inviteeName,
      inviteePhone: null,
      smsCapable: false,
      emailOnly: true,
      matchedExistingContact: false,
      createdContact: false,
    };
  }

  const contact = await getPrisma().contact.findFirst({
    where: { id: linked.contactId, workspaceId },
    select: { id: true, phone: true, email: true },
  });

  const inviteePhone = phoneFromContact(contact?.phone);
  return {
    contactId: contact?.id || linked.contactId,
    inviteeEmail,
    inviteeName,
    inviteePhone,
    smsCapable: Boolean(inviteePhone),
    emailOnly: !inviteePhone,
    matchedExistingContact: !linked.created,
    createdContact: linked.created,
  };
}
