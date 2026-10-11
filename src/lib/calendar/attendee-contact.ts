import "server-only";

import { getPrisma } from "@/lib/db";
import { externalAttendees } from "@/lib/calendar/eligibility";
import { lookupOutlookContactPhoneByEmail } from "@/lib/calendar/outlook-contact-phone";
import { upsertExternalContact } from "@/lib/integrations/connections";
import type { ProviderCalendarEvent } from "@/lib/calendar/providers";
import { extractIdentityFromEventFields } from "@/lib/voice-v3/calendar/appointment-discovery-identity";
import { eventLocationText } from "@/lib/appointment-reminders/calendar/reminder-phone-content";
import { extractReminderPhoneFromCalendarEvent } from "@/lib/appointment-reminders/calendar/reminder-phone-extraction";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

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

function resolveDisplayName(event: ProviderCalendarEvent, primaryName?: string | null): string | null {
  const trimmed = primaryName?.trim();
  if (trimmed) return trimmed;
  const identity = extractIdentityFromEventFields({
    subject: event.summary || "",
    description: event.description || "",
    location: eventLocationText(event),
    attendeeNames: (event.attendees || []).map((a) => a.name).filter(Boolean) as string[],
    attendeeEmails: (event.attendees || []).map((a) => a.email).filter(Boolean) as string[],
  });
  return identity.names[0] || null;
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
  options?: { graphCustomerPhonePropertyKeys?: string[] | null },
): Promise<ResolvedAttendeeContact> {
  const attendees = externalAttendees(event, connectionEmail);
  const primary = attendees.find((a) => a.email) || null;
  const inviteeEmail = primary?.email?.trim().toLowerCase() || null;
  const inviteeName = resolveDisplayName(event, primary?.name);

  const parsedPhone = extractReminderPhoneFromCalendarEvent(event, {
    graphCustomerPhonePropertyKeys: options?.graphCustomerPhonePropertyKeys,
  });
  const eventPhone =
    parsedPhone.status === "found" && parsedPhone.e164 ? parsedPhone.e164 : null;

  if (!inviteeEmail) {
    if (eventPhone) {
      let phoneE164: string | null = eventPhone;
      try {
        phoneE164 = normalizeE164(eventPhone);
      } catch {
        phoneE164 = null;
      }
      if (phoneE164) {
        const existing = await getPrisma().contact.findUnique({
          where: { workspaceId_phone: { workspaceId, phone: phoneE164 } },
          select: { id: true, phone: true, firstName: true, lastName: true },
        });
        if (existing) {
          const display =
            inviteeName ||
            [existing.firstName, existing.lastName].filter(Boolean).join(" ") ||
            null;
          return {
            contactId: existing.id,
            inviteeEmail: null,
            inviteeName: display,
            inviteePhone: phoneFromContact(existing.phone),
            smsCapable: true,
            emailOnly: false,
            matchedExistingContact: true,
            createdContact: false,
          };
        }
        const { firstName, lastName } = splitName(inviteeName);
        const linked = await upsertExternalContact({
          workspaceId,
          phone: phoneE164,
          firstName,
          lastName,
          source: "calendar_import",
          createIfMissing: true,
          overwrite: false,
        });
        if (linked?.contactId) {
          return {
            contactId: linked.contactId,
            inviteeEmail: null,
            inviteeName,
            inviteePhone: phoneE164,
            smsCapable: true,
            emailOnly: false,
            matchedExistingContact: !linked.created,
            createdContact: linked.created,
          };
        }
      }
    }
    return {
      contactId: null,
      inviteeEmail: null,
      inviteeName,
      inviteePhone: eventPhone,
      smsCapable: Boolean(eventPhone),
      emailOnly: !eventPhone,
      matchedExistingContact: false,
      createdContact: false,
    };
  }

  const { firstName, lastName } = splitName(inviteeName);
  const linked = await upsertExternalContact({
    workspaceId,
    email: inviteeEmail,
    phone: eventPhone,
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
      inviteePhone: eventPhone,
      smsCapable: Boolean(eventPhone),
      emailOnly: !eventPhone,
      matchedExistingContact: false,
      createdContact: false,
    };
  }

  const contact = await getPrisma().contact.findFirst({
    where: { id: linked.contactId, workspaceId },
    select: { id: true, phone: true, email: true },
  });

  const inviteePhone = phoneFromContact(contact?.phone) || eventPhone;
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
