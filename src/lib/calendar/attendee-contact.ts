import "server-only";

import { getPrisma } from "@/lib/db";
import { externalAttendees } from "@/lib/calendar/eligibility";
import { lookupOutlookContactPhoneByEmail } from "@/lib/calendar/outlook-contact-phone";
import { upsertExternalContact } from "@/lib/integrations/connections";
import type { ProviderCalendarEvent } from "@/lib/calendar/providers";
import { extractIdentityFromEventFields } from "@/lib/voice-v3/calendar/appointment-discovery-identity";
import { eventLocationText } from "@/lib/appointment-reminders/calendar/reminder-phone-content";

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

export async function enrichContactWithOutlookGraphPhone(
  contact: ResolvedAttendeeContact,
  microsoftAccessToken?: string | null,
): Promise<ResolvedAttendeeContact> {
  if (contact.inviteePhone || !contact.inviteeEmail || !microsoftAccessToken) {
    return contact;
  }
  const hit = await lookupOutlookContactPhoneByEmail(microsoftAccessToken, contact.inviteeEmail);
  if (!hit?.phone) return contact;
  const phone = hit.phone.startsWith("+") ? hit.phone : null;
  if (!phone) return contact;
  return {
    ...contact,
    inviteePhone: phone,
    inviteeName: contact.inviteeName || hit.displayName || contact.inviteeName,
    smsCapable: true,
    emailOnly: false,
  };
}

export async function resolveContactForImportedEvent(
  workspaceId: string,
  event: ProviderCalendarEvent,
  connectionEmail?: string | null,
): Promise<ResolvedAttendeeContact> {
  const attendees = externalAttendees(event, connectionEmail);
  const primary = attendees.find((a) => a.email) || null;
  const inviteeEmail = primary?.email?.trim().toLowerCase() || null;
  let inviteeName = primary?.name?.trim() || null;
  if (!inviteeName) {
    const identity = extractIdentityFromEventFields({
      subject: event.summary || "",
      description: event.description || "",
      location: eventLocationText(event),
      attendeeNames: (event.attendees || []).map((a) => a.name).filter(Boolean) as string[],
      attendeeEmails: (event.attendees || []).map((a) => a.email).filter(Boolean) as string[],
    });
    inviteeName = identity.names[0] || null;
  }

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
