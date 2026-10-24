import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";
import { markVoiceCallBooked } from "@/lib/voice/runtime-provider/livekit-call-telemetry";
import { syncFrontDeskBookingToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";
import type { ConfirmedBooking } from "./booking-types";

export type VoiceV3BookingProvider = ConfirmedBooking["provider"] | "google";

function externalIdForProvider(provider: VoiceV3BookingProvider, providerEventId: string): string {
  const id = providerEventId.trim();
  if (!id) return "";
  if (id.includes(":")) return id;
  return `${provider}:${id}`;
}

export interface PersistVoiceV3BookingInput {
  workspaceId: string;
  callId: string;
  confirmed: ConfirmedBooking & { provider?: VoiceV3BookingProvider };
  serviceName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  contactId?: string | null;
}

/**
 * Provider-neutral durable record after BOOKING_CONFIRMED.
 * Does not perform provider calendar commits — only Postgres product persistence.
 */
export async function persistVoiceV3BookingAfterConfirmation(
  input: PersistVoiceV3BookingInput,
): Promise<{ appointmentId: string; created: boolean } | null> {
  const { workspaceId, callId, confirmed, serviceName } = input;
  const provider = (confirmed.provider ?? "microsoft") as VoiceV3BookingProvider;
  const externalId = externalIdForProvider(provider, confirmed.providerEventId);
  if (!externalId) {
    console.warn("VOICE_V3_BOOKING_PERSIST_SKIPPED", {
      callId,
      reason: "missing_provider_event_id",
      bookingAttemptId: confirmed.bookingAttemptId,
    });
    return null;
  }

  const prisma = getPrisma();

  const byAttempt = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      callId,
      metadata: {
        path: ["voiceV3", "bookingAttemptId"],
        equals: confirmed.bookingAttemptId,
      },
    },
    select: { id: true },
  });
  if (byAttempt) {
    await markVoiceCallBooked({
      workspaceId,
      callId,
      appointmentId: byAttempt.id,
      contactId: input.contactId ?? undefined,
    });
    return { appointmentId: byAttempt.id, created: false };
  }

  const existing = await prisma.voiceAppointment.findFirst({
    where: { workspaceId, externalId },
    select: { id: true, callId: true },
  });

  const metadata: Prisma.InputJsonObject = {
    provider,
    providerEventId: confirmed.providerEventId,
    providerCalendarId: confirmed.providerCalendarId,
    voiceV3: {
      bookingAttemptId: confirmed.bookingAttemptId,
      offerSetId: confirmed.offerSetId,
      slotId: confirmed.slotId,
      schedulingGeneration: confirmed.schedulingGeneration,
      serviceId: confirmed.serviceId,
      confirmedAt: confirmed.confirmedAt,
    },
    inviteeName: confirmed.customerName,
    inviteeEmail: input.customerEmail?.trim() || undefined,
    inviteePhone: input.customerPhone?.trim() || undefined,
  };

  const startsAt = new Date(confirmed.startUtc);
  const endsAt = new Date(confirmed.endUtc);

  const row = existing
    ? await prisma.voiceAppointment.update({
        where: { id: existing.id },
        data: {
          callId: existing.callId ?? callId,
          contactId: input.contactId ?? undefined,
          serviceName: serviceName || undefined,
          startsAt,
          endsAt,
          timezone: confirmed.timezone,
          status: "confirmed",
          externalId,
          metadata,
        },
      })
    : await prisma.voiceAppointment.create({
        data: {
          workspaceId,
          callId,
          contactId: input.contactId ?? null,
          serviceName: serviceName || "Appointment",
          startsAt,
          endsAt,
          timezone: confirmed.timezone,
          status: "confirmed",
          externalId,
          metadata,
        },
      });

  await markVoiceCallBooked({
    workspaceId,
    callId,
    appointmentId: row.id,
    contactId: input.contactId ?? undefined,
  });

  void syncFrontDeskBookingToCrm({
    workspaceId,
    callId,
    appointmentId: row.id,
    callerE164: input.customerPhone,
    email: input.customerEmail,
  }).catch((err) => {
    console.warn("VOICE_V3_BOOKING_CRM_SYNC_FAILED", {
      callId,
      appointmentId: row.id,
      message: err instanceof Error ? err.message : String(err),
    });
  });

  console.log("VOICE_V3_BOOKING_PERSISTED", {
    call_id: callId,
    appointment_id: row.id,
    external_id: externalId,
    provider,
    booking_attempt_id: confirmed.bookingAttemptId,
    created: !existing,
  });

  return { appointmentId: row.id, created: !existing };
}
