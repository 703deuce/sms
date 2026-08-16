import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AvailableSlot } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import {
  alreadyBookedToolMessage,
  formatBookedTimeLabel,
  lookupAppointmentIdForCallWithRetry,
  scheduleAppointmentResilient,
} from "./booking-recovery";
import { resolveConfirmedEmail } from "./email-collection-tools";
import {
  buildDeclineBookingEmailTool,
  buildRecordBookingEmailTool,
  clearBookingEmailWaiter,
} from "./booking-email-inline";
import { findBookingPrerequisiteGaps } from "./booking-prerequisites";
import { applyReceptionistFieldBackfill } from "@/lib/voice/receptionist/field-backfill";
import {
  beginBookingOperation,
  canStartScheduleAppointment,
  finalizeScheduleAppointmentAttempt,
  markBookingOperationConfirmed,
  markBookingOperationFailed,
  markBookingOperationState,
  resetBookingOperationForRetry,
} from "./booking-operation";
import { calendarToolGuardFeedback } from "./booking-operation-guard";
import { buildFrontDeskEndCallToolset } from "./end-frontdesk-call";
import { buildFrontDeskRescheduleAppointmentTool } from "./reschedule-appointment-tool";
import { syncFrontDeskBookingToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import {
  buildBookingFailureLine,
  buildBookingSuccessLine,
  POST_EMAIL_BOOKING_FILLER,
} from "../booking-completion-messages";
import { runAsyncWorkWithBridge } from "../task-async-work-bridge";
import {
  formatToolFeedbackForModel,
  toolFeedbackBookingCompleteSpeakNow,
  toolFeedbackBookingCompleteSpoken,
  toolFeedbackBookingInProgress,
  toolFeedbackFromBookingWriteError,
  toolFeedbackInvalidSlot,
  toolFeedbackMissingEmail,
  toolFeedbackMissingField,
  toolFeedbackFromError,
  toolFeedbackSuccess,
} from "../tool-feedback";
import { safeInterruptSession } from "../session-utils";
import { buildFrontDeskBusinessAnswerTool } from "./knowledge-tool";
import { buildFrontDeskCancelAppointmentTool } from "./cancel-appointment-tool";
import { buildFrontDeskTransferTool } from "./transfer-tool";
import { buildFrontDeskCheckBookingStatusTool } from "./check-booking-status-tool";
import { speakBookingLine } from "./booking-speech";
import { markBookingConfirmed, type FrontDeskUserData } from "./userdata";
import { injectBookingConfirmedChatContext } from "./booking-chat-context";
import { sendBookingSmsAsync } from "./booking-sms";
import { markAppointmentBooked, persistCallState } from "@/lib/voice/real-estate/state";
import { notifyRealEstateStaff } from "@/lib/voice/real-estate/notifications";
import { syncRealEstateLeadToCrm } from "@/lib/voice/real-estate/crm-sync";
import { markVoiceCallBooked } from "@/lib/voice/runtime-provider/livekit-call-telemetry";
import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";

function prefillReceptionistFieldsForBooking(
  session: AgentSession<FrontDeskUserData>,
): void {
  const userData = session.userData;
  const manifest = userData.receptionistCompiled?.fieldManifest;
  if (!manifest?.length) return;
  if (!userData.receptionistFields) userData.receptionistFields = {};
  userData.receptionistFields = applyReceptionistFieldBackfill({
    chatCtx: session.chatCtx,
    manifest,
    receptionistFields: userData.receptionistFields,
    authoritativeFieldIds: userData.authoritativeFieldIds,
  });
  if (!userData.receptionistFields.phone?.trim() && userData.callerE164?.trim()) {
    const ani = tryNormalizeE164(userData.callerE164.trim());
    if (ani) userData.receptionistFields.phone = ani;
  }
}

async function onRealEstateBookingConfirmed(userData: FrontDeskUserData): Promise<void> {
  if (!userData.callState) return;
  userData.callState = markAppointmentBooked(userData.callState);
  await persistCallState({
    workspaceId: userData.workspaceId,
    callId: userData.callId,
    callState: userData.callState,
  }).catch(() => undefined);
  void syncRealEstateLeadToCrm({
    workspaceId: userData.workspaceId,
    callId: userData.callId,
    callState: userData.callState,
    callerE164: userData.callerE164,
    businessName: userData.businessName,
    trigger: "intake_complete",
  }).catch(() => undefined);
  void notifyRealEstateStaff({
    workspaceId: userData.workspaceId,
    callId: userData.callId,
    callState: userData.callState,
    businessName: userData.businessName,
    event: "appointment_booked",
    callerE164: userData.callerE164,
    notifications: userData.realEstateCompiled?.notifications,
  }).catch(() => undefined);
}

export type FrontDeskBookingTools = {
  slotsMap: Map<string, AvailableSlot>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolDefs: any[];
};

export function buildFrontDeskBookingTools(input: {
  timezone: string;
  includeBooking?: boolean;
}): FrontDeskBookingTools {
  const includeBooking = input.includeBooking !== false;
  const slotsMap = new Map<string, AvailableSlot>();

  const getCurrentTime = llm.tool({
    name: "get_current_time",
    description:
      "Get the current date and time. Call whenever you need to reason about dates.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      return withLiveKitToolTelemetry(session.userData, "get_current_time", {}, async () => {
        const now = session.userData.cal.now();
        const formatted = now.toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: session.userData.timezone,
        });
        return formatToolFeedbackForModel(
          toolFeedbackSuccess(`The current date and time is ${formatted}.`, {
            tool: "get_current_time",
            next_action: "continue_conversation",
            guidance:
              "Use this clock for relative dates. Continue the caller's request — one thought at a time.",
          }),
        );
      });
    },
  });

  const listAvailableSlots = llm.tool({
    name: "list_available_slots",
    description:
      "Return available appointment slots as plain text. Call when checking the calendar.",
    parameters: z.object({
      range: z
        .enum(["+2week", "+1month", "+3month", "default"])
        .describe("How far ahead to search"),
    }),
    execute: async ({ range }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const blocked = calendarToolGuardFeedback(session.userData, "list_available_slots");
      if (blocked) return formatToolFeedbackForModel(blocked);

      return withLiveKitToolTelemetry(session.userData, "list_available_slots", { range }, async () => {
        const cal = session.userData.cal;
        const rangeDays = range === "+1month" || range === "+3month" ? 14 : 14;
        try {
          const slots = await cal.listAvailableSlots({ daysAhead: rangeDays });
          slotsMap.clear();
          for (const slot of slots) {
            slotsMap.set(slot.slotId, slot);
          }
          const lines = cal.formatSlotsForModel(slots);
          const slotText = lines || "No slots available at the moment.";
          return formatToolFeedbackForModel(
            toolFeedbackSuccess(slotText, {
              tool: "list_available_slots",
              next_action: lines ? "offer_slots_and_confirm" : "continue_conversation",
              context: { slot_count: slots.length },
              guidance: lines
                ? "Offer up to two or three times from the list. When the caller picks one, call schedule_appointment with that slot_id. Ask only one question — which time works?"
                : "No openings right now. Tell the caller briefly, then offer to check again later or take a message.",
            }),
          );
        } catch (err) {
          return formatToolFeedbackForModel(
            toolFeedbackFromError(err, {
              tool: "list_available_slots",
              runtimeHandledRetry: true,
            }),
          );
        }
      });
    },
  });

  const scheduleAppointment = llm.tool({
    name: "schedule_appointment",
    description:
      "Book the appointment at slot_id after the caller picks a time. " +
      "Returns TOOL_FEEDBACK recoverable_failure when email or other fields are missing — collect and retry.",
    parameters: z.object({
      slot_id: z.string().describe("Slot id from list_available_slots"),
      email: z
        .string()
        .optional()
        .describe("Caller email if already collected in conversation"),
    }),
    execute: async ({ slot_id, email: inlineEmail }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const userData = session.userData;

      const calendarBlocked = calendarToolGuardFeedback(userData, "schedule_appointment");
      if (calendarBlocked) return formatToolFeedbackForModel(calendarBlocked);

      const alreadyBooked = alreadyBookedToolMessage(userData);
      if (alreadyBooked) {
        return formatToolFeedbackForModel(
          toolFeedbackSuccess(alreadyBooked, {
            tool: "schedule_appointment",
            recovery_class: "DUPLICATE_OPERATION",
            reason: "already_completed",
            next_action: "end_call",
            caller_already_heard_success: true,
          }),
        );
      }

      if (!canStartScheduleAppointment(userData)) {
        return formatToolFeedbackForModel(toolFeedbackBookingInProgress("schedule_appointment"));
      }

      resetBookingOperationForRetry(userData);

      const slot = slotsMap.get(slot_id);
      if (!slot) {
        return formatToolFeedbackForModel(toolFeedbackInvalidSlot("schedule_appointment", slot_id));
      }

      userData.pendingSlotId = slot_id;

      prefillReceptionistFieldsForBooking(session);

      const prerequisiteGaps = findBookingPrerequisiteGaps(userData, inlineEmail);
      if (prerequisiteGaps.length > 0) {
        const first = prerequisiteGaps[0];
        if (first.kind === "email") {
          return formatToolFeedbackForModel(
            toolFeedbackMissingEmail({ tool: "schedule_appointment", slotId: slot_id }),
          );
        }
        return formatToolFeedbackForModel(
          toolFeedbackMissingField({
            tool: "schedule_appointment",
            slotId: slot_id,
            fieldId: first.fieldId,
            fieldLabel: first.label,
            hint:
              `Ask for their ${first.label} in one short question, or call collect_booking_requirements to collect all missing fields. ` +
              "When they answer, call record_receptionist_field or schedule_appointment again with the same slot_id. " +
              "Do NOT call collect_caller_fields during booking — it blocks the calendar write.",
          }),
        );
      }

      const resolvedEmail = resolveConfirmedEmail(userData, inlineEmail);
      if (resolvedEmail) {
        userData.confirmedEmail = resolvedEmail;
      }

      beginBookingOperation(userData, slot_id);
      userData.bookingInProgress = true;

      try {
        await safeInterruptSession(session);

        const confirmedEmail = userData.confirmedEmail!;
        markBookingOperationState(userData, "writing_calendar");

        return await withLiveKitToolTelemetry(
          userData,
          "schedule_appointment",
          { slot_id },
          async () => {
            try {
              // Drop any model reply that started while email handoff / bridge was playing.
              await safeInterruptSession(session);

              const booked = await runAsyncWorkWithBridge(
                session,
                POST_EMAIL_BOOKING_FILLER,
                () =>
                  scheduleAppointmentResilient({
                    session,
                    slot,
                    attendeeEmail: confirmedEmail,
                  }),
              );
              const local = formatBookedTimeLabel(booked.slot.startTime, userData.timezone);
              markBookingConfirmed(userData, {
                slotId: slot_id,
                providerEventId: booked.eventUri,
                bookedTimeLabel: local,
              });
              markBookingOperationConfirmed(userData);
              void onRealEstateBookingConfirmed(userData);

              void markVoiceCallBooked({
                workspaceId: userData.workspaceId,
                callId: userData.callId,
                externalId: booked.eventUri,
              }).catch(() => undefined);

              await injectBookingConfirmedChatContext(session, local).catch((err) => {
                console.warn(
                  JSON.stringify({
                    source: "frontdesk-booking-tools",
                    event: "booking_chat_context_inject_failed",
                    callId: userData.callId,
                    error: err instanceof Error ? err.message : String(err),
                  }),
                );
              });

              const spoken = await speakBookingLine(session, buildBookingSuccessLine(local));
              console.log(
                JSON.stringify({
                  source: "frontdesk-booking-tools",
                  event: "booking_confirmation_spoken",
                  callId: userData.callId,
                  spoken,
                  eventUri: booked.eventUri,
                }),
              );

              const smsEnabled =
                userData.receptionistCompiled?.bookingPolicy?.sendSmsConfirmation !== false;
              if (smsEnabled) {
                sendBookingSmsAsync(session, booked.slot.startTime);
              }

              void lookupAppointmentIdForCallWithRetry({
                workspaceId: userData.workspaceId,
                callId: userData.callId,
                eventUri: booked.eventUri,
              }).then((appointmentId) => {
                if (!appointmentId) return;
                userData.booking = {
                  ...userData.booking!,
                  appointmentId,
                };
                void syncFrontDeskBookingToCrm({
                  workspaceId: userData.workspaceId,
                  callId: userData.callId,
                  appointmentId,
                  callerE164: userData.callerE164,
                  email: confirmedEmail,
                  businessName: userData.businessName,
                }).catch((err) => {
                  console.warn(
                    JSON.stringify({
                      source: "frontdesk-booking-tools",
                      event: "crm_sync_failed",
                      callId: userData.callId,
                      error: err instanceof Error ? err.message : String(err),
                    }),
                  );
                });
              });

              if (spoken) {
                return formatToolFeedbackForModel(toolFeedbackBookingCompleteSpoken());
              }
              return formatToolFeedbackForModel(toolFeedbackBookingCompleteSpeakNow(local));
            } catch (err) {
              if (err instanceof SlotUnavailableError) {
                userData.slotUnavailableCount += 1;
                markBookingOperationFailed(userData, "slot_unavailable");
                await speakBookingLine(
                  session,
                  buildBookingFailureLine(
                    "That time slot isn't available anymore — I can check what else is open.",
                  ),
                );
                return formatToolFeedbackForModel(
                  toolFeedbackFromBookingWriteError(err, {
                    tool: "schedule_appointment",
                    slotId: slot_id,
                    callerAlreadyHeardFailure: true,
                  }),
                );
              }
              const recovered = alreadyBookedToolMessage(userData);
              if (recovered) {
                return formatToolFeedbackForModel(
                  toolFeedbackSuccess(recovered, {
                    tool: "schedule_appointment",
                    recovery_class: "DUPLICATE_OPERATION",
                    next_action: "end_call",
                    caller_already_heard_success: true,
                  }),
                );
              }

              console.warn(
                JSON.stringify({
                  source: "frontdesk-booking-tools",
                  event: "schedule_appointment_failed",
                  callId: userData.callId,
                  error: err instanceof Error ? err.message : String(err),
                }),
              );
              markBookingOperationFailed(
                userData,
                err instanceof Error ? err.message : String(err),
              );
              await speakBookingLine(session, buildBookingFailureLine());
              return formatToolFeedbackForModel(
                toolFeedbackFromBookingWriteError(err, {
                  tool: "schedule_appointment",
                  slotId: slot_id,
                  callerAlreadyHeardFailure: true,
                }),
              );
            }
          },
        );
      } finally {
        finalizeScheduleAppointmentAttempt(userData);
        clearBookingEmailWaiter(userData);
      }
    },
  });

  const recordBookingEmail = buildRecordBookingEmailTool();
  const declineBookingEmail = buildDeclineBookingEmailTool();

  const endCallTools = buildFrontDeskEndCallToolset(
    "End when the caller is done after booking or if they say goodbye.",
  );

  return {
    slotsMap,
    toolDefs: [
      getCurrentTime,
      recordBookingEmail,
      declineBookingEmail,
      ...(includeBooking
        ? [
            listAvailableSlots,
            scheduleAppointment,
            buildFrontDeskCancelAppointmentTool(),
            buildFrontDeskRescheduleAppointmentTool(slotsMap),
            buildFrontDeskCheckBookingStatusTool(),
          ]
        : []),
      buildFrontDeskBusinessAnswerTool(),
      buildFrontDeskTransferTool(),
      ...endCallTools.tools,
    ],
  };
}
