import "server-only";

import { getPrisma, type DbRow } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  appointmentMergeVars,
  renderAppointmentTemplate,
} from "@/lib/appointments/appointments-service";
import {
  appendTimeline,
  loadAppointmentPlatformConfig,
  publicActionUrl,
  publicToken,
  resolveManageLinkFromMetadata,
} from "@/lib/appointments/settings";
import type { AppointmentMetadata, AppointmentTypeConfig } from "@/lib/appointments/types";
import { buildPolicySnapshot } from "@/lib/appointments/policy-snapshot";
import { assertSlotAvailableForBooking } from "@/lib/appointments/slot-validation";
import { withAtomicSlotBooking } from "@/lib/appointments/slot-booking";
import {
  markReminderSentInMeta,
  resetAppointmentReminders,
  suppressAppointmentReminders,
} from "@/lib/appointments/reminder-state";
import { bookAppointment, cancelAppointment } from "@/lib/voice/calendar/booking";
import { generateNativeSlots } from "@/lib/appointments/availability-engine";
import { resolveMeetingUrlForAppointment, extractMeetingUrlFromText } from "@/lib/meeting-assistant/meeting-url";

export async function getAvailability(
  workspaceId: string,
  input: Record<string, unknown>,
): Promise<{ slots: Array<{ startsAt: string; endsAt: string }> }> {
  const serviceName = String(input.serviceName || input.service || "Appointment");
  const serviceId = input.serviceId ? String(input.serviceId) : undefined;
  const daysAhead = Number(input.daysAhead || 14);
  const timezone = input.timezone ? String(input.timezone) : undefined;
  const staffId = input.staffId ? String(input.staffId) : undefined;
  const locationId = input.locationId ? String(input.locationId) : undefined;
  const durationMinutes = input.durationMinutes ? Number(input.durationMinutes) : undefined;
  const excludeAppointmentId = input.excludeAppointmentId
    ? String(input.excludeAppointmentId)
    : undefined;

  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const { resolveLocationTimezone, filterStaffIdsForLocation } = await import(
    "@/lib/appointments/service-booking/location-scheduling"
  );
  const effectiveTimezone = locationId
    ? resolveLocationTimezone(platform, locationId)
    : timezone;

  let effectiveStaffId = staffId;
  if (locationId && staffId) {
    const allowed = filterStaffIdsForLocation(platform, locationId, [staffId]);
    if (!allowed.includes(staffId)) effectiveStaffId = allowed[0];
  }

  let effectiveDuration = durationMinutes;
  if (serviceId && !effectiveDuration) {
    const types = await listAppointmentTypes(workspaceId);
    const typeRow = types.find((t: DbRow) => t.id === serviceId);
    const base = typeRow?.durationMinutes || 30;
    const { resolveEffectiveTypeDurationMinutes } = await import(
      "@/lib/appointments/service-booking/service-phases"
    );
    effectiveDuration = await resolveEffectiveTypeDurationMinutes(workspaceId, serviceId, base);
  }

  const result = await generateNativeSlots(workspaceId, {
    serviceName,
    daysAhead,
    timezone: effectiveTimezone,
    locationId,
    staffId: effectiveStaffId,
    durationMinutes: effectiveDuration,
    excludeAppointmentId,
  });
  let slots = result.slots;
  if (serviceId || serviceName) {
    const types = await listAppointmentTypes(workspaceId);
    const typeRow = serviceId
      ? types.find((t: DbRow) => t.id === serviceId)
      : types.find((t: DbRow) => t.name === serviceName);
    const cfg = (typeRow?.config || {}) as AppointmentTypeConfig;
    const { resolveResourceIdsForBookingType, filterSlotsByResourceAvailability } = await import(
      "@/lib/appointments/service-booking/resource-availability"
    );
    let resourceIds = await resolveResourceIdsForBookingType(workspaceId, cfg);
    if (locationId && resourceIds.length) {
      const { filterResourceIdsForLocation } = await import(
        "@/lib/appointments/service-booking/location-scheduling"
      );
      resourceIds = filterResourceIdsForLocation(platform, locationId, resourceIds);
    }
    if (resourceIds.length) {
      slots = await filterSlotsByResourceAvailability(
        workspaceId,
        resourceIds,
        slots,
        excludeAppointmentId,
      );
    }
  }
  return { slots };
}

export async function listAppointmentTypes(
  workspaceId: string,
  opts?: { includeSecret?: boolean; includeUnlisted?: boolean },
) {
  const prisma = getPrisma();
  const rows = await prisma.voiceService.findMany({
    where: { workspaceId },
    orderBy: [{ config: "asc" }, { name: "asc" }],
  });
  const mapped = rows.map((row: DbRow) => ({
    id: row.id,
    name: row.name,
    durationMinutes: row.durationMinutes,
    bufferMinutes: row.bufferMinutes,
    calendarId: row.calendarId,
    config: (row.config || {}) as AppointmentTypeConfig,
    active: (row.config as AppointmentTypeConfig | null)?.enabled !== false,
  }));
  const sorted = mapped.sort(
    (a: DbRow, b: DbRow) => (a.config.displayOrder ?? 999) - (b.config.displayOrder ?? 999),
  );
  if (opts?.includeSecret && opts?.includeUnlisted) return sorted;
  return sorted.filter((t: DbRow) => {
    const vis = t.config.visibility || "public";
    if (vis === "secret" && !opts?.includeSecret) return false;
    if (vis === "unlisted" && !opts?.includeUnlisted && !opts?.includeSecret) return false;
    return true;
  });
}

export async function bulkUpdateAppointmentTypes(
  workspaceId: string,
  updates: Array<{ id: string; config?: Partial<AppointmentTypeConfig>; displayOrder?: number }>,
) {
  const prisma = getPrisma();
  const results = [];
  for (const update of updates) {
    const row = await prisma.voiceService.findFirst({ where: { id: update.id, workspaceId } });
    if (!row) continue;
    const config = {
      ...((row.config || {}) as AppointmentTypeConfig),
      ...(update.config || {}),
      ...(update.displayOrder != null ? { displayOrder: update.displayOrder } : {}),
    };
    results.push(
      await prisma.voiceService.update({
        where: { id: update.id },
        data: { config: config as object },
      }),
    );
  }
  return results;
}

export async function reorderAppointmentTypes(workspaceId: string, orderedIds: string[]) {
  const updates = orderedIds.map((id, index) => ({ id, displayOrder: index }));
  return bulkUpdateAppointmentTypes(workspaceId, updates);
}

export async function upsertAppointmentType(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    durationMinutes?: number;
    bufferMinutes?: number;
    calendarId?: string | null;
    config?: AppointmentTypeConfig;
  },
) {
  if (input.config?.payment) {
    const { validateAppointmentTypePayment } = await import("@/lib/merchant-payments/service");
    const paymentError = await validateAppointmentTypePayment(workspaceId, input.config.payment);
    if (paymentError) {
      throw new Error(paymentError);
    }
  }

  const prisma = getPrisma();
  const data = {
    name: input.name.trim(),
    durationMinutes: Number(input.durationMinutes) || 30,
    bufferMinutes: Number(input.bufferMinutes) || 0,
    calendarId: input.calendarId || null,
    config: (input.config || {}) as object,
  };
  if (input.id) {
    return prisma.voiceService.update({
      where: { id: input.id, workspaceId },
      data,
    });
  }
  return prisma.voiceService.create({
    data: { workspaceId, ...data },
  });
}

async function resolveOrCreateContact(
  workspaceId: string,
  input: { firstName?: string; lastName?: string; phone: string; email?: string; consentSource?: string },
) {
  const prisma = getPrisma();
  const phone = normalizeE164(input.phone);
  const existing = await prisma.contact.findFirst({
    where: { workspaceId, phone },
  });
  if (existing) {
    if (input.email && !existing.email) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: { email: input.email.trim() },
      });
    }
    return existing.id;
  }
  const created = await prisma.contact.create({
    data: {
      workspaceId,
      firstName: input.firstName?.trim() || "Guest",
      lastName: input.lastName?.trim() || "",
      phone,
      email: input.email?.trim() || null,
      status: "SUBSCRIBED",
      consentSource: input.consentSource || "appointment_booking",
      consentDate: new Date(),
    },
  });
  return created.id;
}

export async function createPlatformAppointment(
  workspaceId: string,
  input: {
    serviceId?: string;
    serviceName: string;
    startsAt: string;
    firstName?: string;
    lastName?: string;
    phone: string;
    email?: string;
    notes?: string;
    bookingAnswers?: Record<string, string>;
    smsConsent?: boolean;
    termsAccepted?: boolean;
    termsVersion?: string;
    source?: "admin" | "public_booking" | "waitlist";
    status?: string;
    skipSms?: boolean;
    staffId?: string;
    staffName?: string;
    locationId?: string;
    locationName?: string;
    attendeeCount?: number;
    durationMinutes?: number;
    utm?: import("@/lib/appointments/scheduling-capabilities").UtmAttribution;
    singleUseToken?: string;
    emailOtpVerified?: boolean;
    extraRecipients?: Array<{ email?: string; phone?: string; name?: string }>;
    skipApproval?: boolean;
    resourceIds?: string[];
    addOnIds?: string[];
    addOnSelections?: Array<{ addOnId: string; quantity?: number }>;
    intakeResponses?: Array<{ formId: string; answers: Record<string, unknown> }>;
    customFieldValues?: Record<string, unknown>;
    multiServiceLines?: Array<{
      appointmentTypeId?: string;
      serviceName: string;
      staffId?: string;
      resourceIds?: string[];
      startsAt: string;
      endsAt: string;
      priceCents?: number;
      displayOrder?: number;
    }>;
    contactId?: string;
  },
) {
  const prisma = getPrisma();
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true, displayName: true, name: true },
  });

  if (input.source === "public_booking" && platform.termsVersion) {
    const { validateTermsAcceptance, buildTermsAcceptanceSnapshot } = await import(
      "@/lib/appointments/service-booking/terms-acceptance"
    );
    validateTermsAcceptance(
      { termsAccepted: input.termsAccepted, termsVersion: input.termsVersion },
      platform.termsVersion,
    );
  }

  let serviceName = input.serviceName;
  let svcCfg: AppointmentTypeConfig = {};
  let durationMinutes = input.durationMinutes || 30;
  if (input.serviceId) {
    const svc = await prisma.voiceService.findFirst({
      where: { id: input.serviceId, workspaceId },
    });
    if (!svc) throw new Error("Appointment type not found");
    serviceName = svc.name;
    svcCfg = (svc.config || {}) as AppointmentTypeConfig;
    if (!input.durationMinutes) durationMinutes = svc.durationMinutes || 30;
    const { resolveEffectiveTypeDurationMinutes } = await import(
      "@/lib/appointments/service-booking/service-phases"
    );
    durationMinutes = await resolveEffectiveTypeDurationMinutes(
      workspaceId,
      input.serviceId,
      durationMinutes,
    );
  } else {
    const svc = await prisma.voiceService.findFirst({
      where: { workspaceId, name: serviceName },
    });
    if (svc) {
      svcCfg = (svc.config || {}) as AppointmentTypeConfig;
      if (!input.durationMinutes) durationMinutes = svc.durationMinutes || 30;
    }
  }

  if (input.singleUseToken) {
    const { resolveSingleUseBookingLink, consumeSingleUseBookingLink } = await import(
      "@/lib/appointments/booking-links"
    );
    const resolved = await resolveSingleUseBookingLink(workspaceId, input.singleUseToken);
    if (!resolved) throw new Error("This booking link is invalid or expired");
    if (resolved.appointmentTypeId !== input.serviceId) {
      throw new Error("Booking link does not match this appointment type");
    }
    await consumeSingleUseBookingLink(workspaceId, input.singleUseToken);
  }

  if (svcCfg.bookingApproval?.required && !input.skipApproval && input.source === "public_booking") {
    if (!input.emailOtpVerified && svcCfg.bookingApproval.notifyStaff) {
      // OTP may still be required upstream
    }
  }

  const startsAtDate = new Date(input.startsAt);
  const endsAtDate = new Date(startsAtDate.getTime() + durationMinutes * 60_000);

  const { resolveResourceIdsForBookingType, persistAppointmentResources } = await import(
    "@/lib/appointments/service-booking/resource-availability"
  );
  const resolvedResourceIds = await resolveResourceIdsForBookingType(
    workspaceId,
    svcCfg,
    input.resourceIds,
  );
  if (resolvedResourceIds.length) {
    const { assertResourcesAvailable } = await import("@/lib/appointments/service-booking/resources");
    await assertResourcesAvailable(workspaceId, resolvedResourceIds, startsAtDate, endsAtDate);
  }

  if (!input.staffId || !input.staffName) {
    const { loadSchedulingContext, resolveStaffForBooking } = await import(
      "@/lib/appointments/scheduling-domain"
    );
    const schedulingCtx = await loadSchedulingContext(workspaceId, serviceName);
    const assigned = await resolveStaffForBooking(schedulingCtx, {
      preferredStaffId: input.staffId,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      durationMinutes,
    });
    if (assigned) {
      input = { ...input, staffId: assigned.id, staffName: assigned.name };
    }
  }

  const isStaffQuickCreate = input.source === "admin" && input.skipSms === true;

  let contactId: string;
  if (input.contactId) {
    const existing = await prisma.contact.findFirst({
      where: { id: input.contactId, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new Error("Contact not found");
    contactId = input.contactId;
  } else {
    contactId = await resolveOrCreateContact(workspaceId, {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      consentSource: input.smsConsent ? "appointment_booking_sms" : "appointment_booking",
    });
  }

  const confirmToken = publicToken();
  const cancelToken = publicToken();
  const rescheduleToken = publicToken();

  const result = await withAtomicSlotBooking(
    workspaceId,
    { serviceName, startsAt: input.startsAt },
    async () => {
      return bookAppointment(workspaceId, {
        serviceName,
        startsAt: input.startsAt,
        phone: input.phone,
        email: input.email,
        contactId,
        firstName: input.firstName,
        lastName: input.lastName,
        name: [input.firstName, input.lastName].filter(Boolean).join(" ").trim() || undefined,
        timezone: platform.timezone,
        skipSms: true,
        source: input.source || "admin",
        notes: input.notes,
      });
    },
  );

  const appointmentId = String(result.appointmentId || "");
  if (!appointmentId) throw new Error("Booking failed");

  const startsAt = new Date(String(result.startsAt || input.startsAt));
  let resolvedMeetingUrl =
    extractMeetingUrlFromText(input.locationName) ||
    extractMeetingUrlFromText(input.notes) ||
    undefined;

  const locationKind = input.locationName?.toLowerCase().includes("zoom")
    ? "zoom"
    : input.locationName?.toLowerCase().includes("meet")
      ? "google_meet"
      : input.locationName?.toLowerCase().includes("teams") ||
          svcCfg.location?.toLowerCase().includes("teams")
        ? "microsoft_teams"
        : input.locationName?.toLowerCase().includes("webex")
          ? "webex"
          : undefined;

  if (!isStaffQuickCreate && locationKind === "microsoft_teams") {
    try {
      const msConn = await prisma.voiceCalendarConnection.findFirst({
        where: { workspaceId, provider: "microsoft", status: "connected" },
      });
      if (msConn) {
        const { createTeamsMeetingForAppointment, attachTeamsUrlToAppointment } = await import(
          "@/lib/calendar/teams-meeting"
        );
        const teams = await createTeamsMeetingForAppointment({
          connectionId: msConn.id,
          config: (msConn.config || {}) as import("@/lib/calendar/providers").CalendarConfig,
          subject: `${serviceName} — ${[input.firstName, input.lastName].filter(Boolean).join(" ") || "Guest"}`,
          startsAt,
          endsAt: endsAtDate,
          timezone: platform.timezone,
          attendees: input.email ? [{ email: input.email, name: input.firstName }] : [],
        });
        if (teams?.joinUrl) {
          resolvedMeetingUrl = teams.joinUrl;
          await attachTeamsUrlToAppointment(workspaceId, appointmentId, teams.joinUrl);
        }
      }
    } catch (err) {
      console.warn("[appointments] Teams meeting creation failed", err);
    }
  }

  const needsApproval =
    svcCfg.bookingApproval?.required && input.source === "public_booking" && !input.skipApproval;
  const initialStatus = needsApproval
    ? "awaiting_confirmation"
    : input.status || "awaiting_confirmation";

  let termsAcceptanceSnapshot: import("@/lib/appointments/service-booking/types").TermsAcceptanceSnapshot | undefined;
  if (input.termsAccepted && platform.termsVersion) {
    const { buildTermsAcceptanceSnapshot } = await import(
      "@/lib/appointments/service-booking/terms-acceptance"
    );
    termsAcceptanceSnapshot = buildTermsAcceptanceSnapshot({
      termsVersion: platform.termsVersion,
      termsText: platform.termsText || platform.termsVersion,
      termsUrl: platform.termsUrl,
    });
  }

  const metadata = appendTimeline(
    resetAppointmentReminders({
      source: input.source || "admin",
      inviteeName: `${input.firstName || ""} ${input.lastName || ""}`.trim(),
      inviteeEmail: input.email,
      inviteePhone: input.phone,
      smsConsent: Boolean(input.smsConsent),
      smsConsentAt: input.smsConsent ? new Date().toISOString() : undefined,
      smsConsentVersion: input.smsConsent ? platform.consentVersion || "v1" : undefined,
      smsConsentText: input.smsConsent ? platform.consentText : undefined,
      termsAcceptance: termsAcceptanceSnapshot,
      confirmToken,
      cancelToken,
      rescheduleToken,
      notes: input.notes,
      bookingAnswers: input.bookingAnswers,
      staffId: input.staffId,
      locationId: input.locationId,
      location: input.locationName,
      locationKind,
      attendeeCount: input.attendeeCount,
      meetingUrl: resolvedMeetingUrl,
      utm: input.utm,
      extraRecipients: input.extraRecipients,
      emailOtpVerified: input.emailOtpVerified,
      pendingApproval: needsApproval,
      resourceIds: resolvedResourceIds.length ? resolvedResourceIds : undefined,
      addOnIds: input.addOnIds?.length ? input.addOnIds : undefined,
      confirmUrl: publicActionUrl("confirm", confirmToken),
      cancelUrl: publicActionUrl("cancel", cancelToken),
      rescheduleUrl: publicActionUrl("reschedule", rescheduleToken),
      reminderGeneration: 1,
      policySnapshot: buildPolicySnapshot(svcCfg),
    }),
    { type: "created", label: "Appointment created" },
  );

  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: initialStatus,
      staffName: input.staffName || undefined,
      endsAt: endsAtDate,
      metadata: metadata as object,
    },
  });

  try {
    await persistAppointmentResources(workspaceId, {
      appointmentId,
      appointmentTypeId: input.serviceId,
      serviceName,
      staffId: input.staffId,
      resourceIds: resolvedResourceIds,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      priceCents: svcCfg.payment?.priceCents,
    });
    if (resolvedResourceIds.length) {
      const labels = await (
        await import("@/lib/appointments/service-booking/resource-availability")
      ).loadAppointmentResourceLabels(workspaceId, resolvedResourceIds);
      await prisma.voiceAppointment.update({
        where: { id: appointmentId },
        data: {
          metadata: {
            ...(metadata as object),
            resourceLabels: labels,
          } as object,
        },
      });
    }
  } catch (err) {
    console.warn("[appointments] resource persistence failed", err);
  }

  if (input.multiServiceLines?.length) {
    try {
      const { createMultiServiceAppointment } = await import(
        "@/lib/appointments/service-booking/multi-service"
      );
      await createMultiServiceAppointment(workspaceId, appointmentId, input.multiServiceLines);
    } catch (err) {
      console.warn("[appointments] multi-service lines failed", err);
    }
  }

  if (input.intakeResponses?.length) {
    try {
      const { saveIntakeResponse } = await import("@/lib/appointments/service-booking/intake-forms");
      for (const response of input.intakeResponses) {
        await saveIntakeResponse(workspaceId, {
          formId: response.formId,
          contactId,
          appointmentId,
          answers: response.answers,
        });
      }
    } catch (err) {
      console.warn("[appointments] intake response persistence failed", err);
    }
  }

  if (input.customFieldValues && Object.keys(input.customFieldValues).length) {
    try {
      const { setContactCustomFieldValues } = await import(
        "@/lib/appointments/service-booking/phase2/custom-fields"
      );
      await setContactCustomFieldValues(workspaceId, contactId, input.customFieldValues);
    } catch (err) {
      console.warn("[appointments] custom field persistence failed", err);
    }
  }

  try {
    const { ensureManageAppointmentToken, manageAppointmentUrl } = await import(
      "@/lib/appointments/service-booking/manage-appointment"
    );
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
    const { rawToken } = await ensureManageAppointmentToken(workspaceId, appointmentId);
    const manageUrl = manageAppointmentUrl(baseUrl, rawToken);
    await prisma.voiceAppointment.update({
      where: { id: appointmentId },
      data: {
        metadata: {
          ...metadata,
          manageAppointmentUrl: manageUrl,
          manageAppointmentTokenIssuedAt: new Date().toISOString(),
        } as object,
      },
    });
  } catch (err) {
    console.warn("[appointments] manage appointment token issuance failed", err);
  }

  if (needsApproval && !isStaffQuickCreate) {
    const { requestBookingApproval } = await import("@/lib/appointments/booking-approval");
    await requestBookingApproval(workspaceId, appointmentId);
  }

  if (!isStaffQuickCreate) {
    try {
      const { autoProvisionTransovoVideoForAppointment } = await import(
        "@/lib/transovo-video/workflow-triggers"
      );
      await autoProvisionTransovoVideoForAppointment(workspaceId, appointmentId);
    } catch (err) {
      console.warn("[appointments] transovo video auto-provision failed", err);
    }
  }

  const appointmentRow = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  const latestMeta = (appointmentRow?.metadata || metadata) as AppointmentMetadata;
  const meetingLink = latestMeta.meetingUrl || latestMeta.joinUrl || null;

  if (!input.skipSms && platform.reminders.confirmation.enabled) {
    const { shouldSkipPlatformRemindersForAppointment } = await import(
      "@/lib/appointment-workflows/platform-guard"
    );
    const skipPlatformConfirmation = await shouldSkipPlatformRemindersForAppointment(
      workspaceId,
      input.serviceId,
      serviceName,
    );

    if (!skipPlatformConfirmation) {
      const confirmationStep = platform.reminders.confirmation;
      const body = renderAppointmentTemplate(
        confirmationStep.template,
        appointmentMergeVars({
          firstName: input.firstName,
          businessName: workspace?.displayName || workspace?.name,
          service: serviceName,
          startsAt,
          timezone: platform.timezone,
          confirmLink: publicActionUrl("confirm", confirmToken),
          cancelLink: publicActionUrl("cancel", cancelToken),
          rescheduleLink: publicActionUrl("reschedule", rescheduleToken),
          manageLink: resolveManageLinkFromMetadata(latestMeta, rescheduleToken),
          meetingLink,
        }),
      );
      try {
        if (confirmationStep.channel === "email") {
          const email = input.email?.trim();
          if (!email) throw new Error("Customer email required for email confirmation");
          const { sendTransactionalEmail } = await import("@/lib/email/brevo");
          const emailResult = await sendTransactionalEmail({
            to: email,
            subject: `Appointment confirmed — ${workspace?.displayName || workspace?.name || "Transovo"}`,
            htmlContent: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
            textContent: body,
          });
          if (emailResult.status === "failed") {
            throw new Error(emailResult.error || "Email delivery failed");
          }
        } else if (confirmationStep.channel === "voice") {
          const { executeAppointmentVoiceReminder } = await import(
            "@/lib/appointment-voice-reminders/service"
          );
          await executeAppointmentVoiceReminder({
            workspaceId,
            appointmentId,
            toE164: input.phone,
            inlineTemplate: confirmationStep.template
              ? { humanScript: confirmationStep.template, voicemailScript: confirmationStep.template }
              : undefined,
          });
        } else if (input.smsConsent) {
          const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
          await sendAppointmentSms({ workspaceId, to: input.phone, body });
        }

        await prisma.voiceAppointment.update({
          where: { id: appointmentId },
          data: {
            metadata: markReminderSentInMeta(
              appendTimeline(metadata, {
                type: "confirmation_sent",
                label: "Booking confirmation sent",
              }) as AppointmentMetadata,
              "confirmation_sent",
            ) as object,
          },
        });
      } catch (err) {
        console.warn("[appointments] confirmation delivery failed", err);
      }
    }
  }

  if (!isStaffQuickCreate) {
    try {
      const { onAppointmentBooked } = await import("@/lib/appointment-workflows/triggers");
      await onAppointmentBooked(workspaceId, appointmentId, contactId);
    } catch (err) {
      console.warn("[appointments] workflow trigger failed on book", err);
    }

    try {
      const { autoEnableNotetakerForAppointment } = await import("@/lib/meeting-assistant/workflow-triggers");
      await autoEnableNotetakerForAppointment(workspaceId, appointmentId);
    } catch (err) {
      console.warn("[appointments] notetaker auto-enable failed", err);
    }
  }

  return {
    ...result,
    contactId,
    meetingLink,
    joinUrl: meetingLink,
    locationKind: latestMeta.locationKind || null,
    isTransovoVideo: latestMeta.locationKind === "transovo_video" || Boolean(latestMeta.videoMeetingId),
    pendingApproval: needsApproval,
    redirectUrl: svcCfg.redirectAfterBooking?.enabled
      ? buildRedirectAfterBooking(svcCfg.redirectAfterBooking, {
          appointmentId,
          utm: input.utm,
        })
      : undefined,
    confirmationResources: svcCfg.confirmationPage,
  };
}

function buildRedirectAfterBooking(
  config: import("@/lib/appointments/scheduling-capabilities").BookingRedirectConfig,
  ctx: { appointmentId: string; utm?: import("@/lib/appointments/scheduling-capabilities").UtmAttribution },
): string | undefined {
  if (!config.url) return undefined;
  if (!config.includeQueryParams) return config.url;
  const params = new URLSearchParams({ appointmentId: ctx.appointmentId });
  if (ctx.utm?.source) params.set("utm_source", ctx.utm.source);
  if (ctx.utm?.medium) params.set("utm_medium", ctx.utm.medium);
  if (ctx.utm?.campaign) params.set("utm_campaign", ctx.utm.campaign);
  return `${config.url}${config.url.includes("?") ? "&" : "?"}${params.toString()}`;
}

export async function updatePlatformAppointmentStatus(
  workspaceId: string,
  appointmentId: string,
  status: string,
  timeline?: { type: string; label: string; detail?: string },
  initiatedBy: "customer" | "staff" | "system" | "api" | "workflow" = "staff",
  options?: { confirmationSource?: import("./types").ConfirmationSource },
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");
  let meta = (row.metadata || {}) as AppointmentMetadata;
  meta = { ...meta, lastChangeInitiatedBy: initiatedBy };
  if (timeline) meta = appendTimeline(meta, timeline) as AppointmentMetadata;
  const normalized = status.toLowerCase();
  if (normalized === "confirmed" && options?.confirmationSource) {
    meta = { ...meta, confirmationSource: options.confirmationSource };
  }
  if (["canceled", "cancelled", "completed", "no_show"].includes(normalized)) {
    meta = suppressAppointmentReminders(meta);
    if (normalized !== "canceled" && normalized !== "cancelled") {
      meta = appendTimeline(meta, {
        type: "reminders_suppressed",
        label: "Reminders cleared for closed appointment",
      }) as AppointmentMetadata;
    }
  }
  const updated = await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { status, metadata: meta as object },
  });

  try {
    const { onAppointmentStatusChanged } = await import("@/lib/appointment-workflows/triggers");
    await onAppointmentStatusChanged(workspaceId, appointmentId, status);
  } catch (err) {
    console.warn("[appointments] workflow trigger failed on status change", err);
  }

  return updated;
}

export async function cancelPlatformAppointment(
  workspaceId: string,
  appointmentId: string,
  initiatedBy: "customer" | "staff" | "system" | "api" | "workflow" = "staff",
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");
  await cancelAppointment(workspaceId, appointmentId);
  const meta = appendTimeline(
    suppressAppointmentReminders({
      ...(row.metadata || {}) as AppointmentMetadata,
      lastChangeInitiatedBy: initiatedBy,
    }),
    { type: "canceled", label: "Appointment canceled — pending reminders cleared" },
  ) as AppointmentMetadata;

  try {
    const { notifyWaitlistOnSlotAvailable, autoFillWaitlistSlot } = await import(
      "@/lib/appointments/waitlist"
    );
    if (row.serviceName && row.startsAt > new Date()) {
      await notifyWaitlistOnSlotAvailable({
        workspaceId,
        serviceName: row.serviceName,
        startsAt: row.startsAt,
      });
      await autoFillWaitlistSlot({
        workspaceId,
        serviceName: row.serviceName,
        startsAt: row.startsAt,
        autoBook: true,
      });
    }
  } catch (err) {
    console.warn("[appointments] waitlist notify failed", err);
  }
  const canceled = await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: "canceled",
      metadata: appendTimeline(meta, {
        type: "reminders_suppressed",
        label: "Reminders canceled",
      }) as object,
    },
  });

  try {
    const { onAppointmentCanceled } = await import("@/lib/appointment-workflows/triggers");
    await onAppointmentCanceled(workspaceId, appointmentId);
  } catch (err) {
    console.warn("[appointments] workflow trigger failed on cancel", err);
  }

  try {
    const { cancelVideoMeetingForAppointment } = await import("@/lib/transovo-video/service");
    await cancelVideoMeetingForAppointment(workspaceId, appointmentId);
  } catch (err) {
    console.warn("[appointments] video meeting cancel failed", err);
  }

  const metaBefore = (row.metadata || {}) as AppointmentMetadata;
  if (
    metaBefore.paymentStatus === "succeeded" &&
    !metaBefore.refundStatus &&
    (metaBefore.merchantPaymentId || metaBefore.providerPaymentId)
  ) {
    try {
      const { refundMerchantAppointmentPayment } = await import("@/lib/merchant-payments/service");
      await refundMerchantAppointmentPayment({
        workspaceId,
        appointmentId,
        reason: "appointment_canceled",
      });
    } catch (err) {
      console.warn("[appointments] auto-refund on cancel failed", err);
    }
  }

  try {
    const { restorePackageCreditsForAppointment } = await import(
      "@/lib/appointments/service-booking/package-lifecycle"
    );
    await restorePackageCreditsForAppointment(workspaceId, appointmentId, "cancel");
  } catch (err) {
    console.warn("[appointments] package credit restore on cancel failed", err);
  }

  try {
    const { findMeetingForAppointment, disableNotetakerForSession } = await import(
      "@/lib/meeting-assistant/service"
    );
    const session = await findMeetingForAppointment(workspaceId, appointmentId);
    if (session && session.enabled) {
      await disableNotetakerForSession(workspaceId, session.id);
    }
  } catch (err) {
    console.warn("[appointments] notetaker cancel failed", err);
  }

  return canceled;
}

export async function findAppointmentByPublicToken(token: string) {
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      OR: [
        { metadata: { path: ["confirmToken"], equals: token } },
        { metadata: { path: ["cancelToken"], equals: token } },
        { metadata: { path: ["rescheduleToken"], equals: token } },
      ],
    },
    take: 1,
  });
  return rows[0] || null;
}

export async function reschedulePlatformAppointment(
  workspaceId: string,
  appointmentId: string,
  startsAt: string,
  initiatedBy: "customer" | "staff" | "system" | "api" | "workflow" = "staff",
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");
  if (!row.serviceName) throw new Error("Appointment has no service type");

  await withAtomicSlotBooking(
    workspaceId,
    { serviceName: row.serviceName, startsAt, excludeAppointmentId: appointmentId },
    async () => {
      await assertSlotAvailableForBooking(workspaceId, {
        serviceName: row.serviceName!,
        startsAt,
        excludeAppointmentId: appointmentId,
      });
    },
  );

  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: row.serviceName },
  });
  const durationMinutes = service?.durationMinutes || 30;
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const baseMeta = resetAppointmentReminders({
    ...(row.metadata || {}) as AppointmentMetadata,
    lastChangeInitiatedBy: initiatedBy,
  });
  const metadata = appendTimeline(baseMeta, {
    type: "rescheduled",
    label: "Appointment rescheduled — reminders reset",
    detail: start.toISOString(),
  });

  const rescheduled = await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      startsAt: start,
      endsAt: end,
      status: "awaiting_confirmation",
      metadata: metadata as object,
    },
  });

  try {
    const { syncExternalCalendarOnReschedule } = await import("@/lib/calendar/external-sync");
    await syncExternalCalendarOnReschedule(workspaceId, row, {
      startsAt: start,
      endsAt: end,
      summary: row.serviceName || undefined,
    });
  } catch (err) {
    console.warn("[appointments] external calendar reschedule sync failed", err);
  }

  try {
    const { onAppointmentRescheduled } = await import("@/lib/appointment-workflows/triggers");
    await onAppointmentRescheduled(workspaceId, appointmentId);
  } catch (err) {
    console.warn("[appointments] workflow trigger failed on reschedule", err);
  }

  try {
    const { syncAppointmentMeetingSession } = await import("@/lib/meeting-assistant/service");
    await syncAppointmentMeetingSession({ workspaceId, appointmentId });
  } catch (err) {
    console.warn("[appointments] notetaker reschedule sync failed", err);
  }

  try {
    const { syncVideoMeetingSchedule } = await import("@/lib/transovo-video/service");
    await syncVideoMeetingSchedule({
      workspaceId,
      appointmentId,
      scheduledStartAt: start,
      scheduledEndAt: end,
    });
  } catch (err) {
    console.warn("[appointments] video meeting reschedule sync failed", err);
  }

  return rescheduled;
}

