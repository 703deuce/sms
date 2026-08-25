/**
 * Sync booking policy patches onto VoiceService rows so runtime gates match.
 */

import { getPrisma } from "@/lib/db";
import type { BookingPolicy } from "@/lib/agents/appointment-booking/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatNotice(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

/**
 * Mirror Appointment Booking Agent policy onto workspace VoiceService configs.
 * Matches the gates read by loadServiceBookingConfig / bookAppointment.
 */
export async function syncBookingPolicyToVoiceServices(input: {
  workspaceId: string;
  policy: Partial<BookingPolicy>;
  serviceNames?: string[];
}): Promise<{ updated: number }> {
  const prisma = getPrisma();
  const services = await prisma.voiceService.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...(input.serviceNames?.length
        ? { name: { in: input.serviceNames } }
        : {}),
    },
    take: 50,
  });

  let updated = 0;
  for (const service of services) {
    const prev = asRecord(service.config);
    const next: Record<string, unknown> = { ...prev };

    if (input.policy.minimumNoticeMinutes != null) {
      next.minimumBookingNoticeMinutes = input.policy.minimumNoticeMinutes;
      next.minNotice = formatNotice(input.policy.minimumNoticeMinutes);
    }
    if (input.policy.maximumAdvanceDays != null) {
      next.maximumBookingDaysAhead = input.policy.maximumAdvanceDays;
      next.maxDaysAhead = `${input.policy.maximumAdvanceDays} days`;
    }
    if (input.policy.sameDayCutoff !== undefined) {
      next.sameDayCutoff = input.policy.sameDayCutoff;
    }
    if (input.policy.appointmentDurationMinutes != null) {
      // duration is a column; also mirror into config for readers that check JSON
      next.durationMinutes = input.policy.appointmentDurationMinutes;
    }
    if (input.policy.requireServiceAddress != null) {
      const required = Array.isArray(prev.requiredFields)
        ? prev.requiredFields.map(String)
        : ["full_name", "phone", "service"];
      const hasAddress = required.some((f) => /address/i.test(f));
      if (input.policy.requireServiceAddress && !hasAddress) {
        required.push("service_address");
      }
      next.requiredFields = input.policy.requireServiceAddress
        ? required
        : required.filter((f) => !/address/i.test(f));
    }
    if (input.policy.canBook === false) {
      next.bookingPermission = "collect_info_only";
      next.enabled = false;
    } else if (input.policy.canBook === true) {
      next.bookingPermission = "book_directly";
      next.enabled = true;
    }

    await prisma.voiceService.update({
      where: { id: service.id },
      data: {
        ...(input.policy.appointmentDurationMinutes != null
          ? { durationMinutes: input.policy.appointmentDurationMinutes }
          : {}),
        config: next,
      },
    });
    updated += 1;
  }

  return { updated };
}
