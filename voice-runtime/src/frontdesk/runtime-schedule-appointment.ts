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
import { clearBookingEmailWaiter } from "./booking-email-inline";
import { findBookingPrerequisiteGaps } from "./booking-prerequisites";
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
  toolFeedbackSuccess,
} from "../tool-feedback";
import { safeInterruptSession } from "../session-utils";
import { speakBookingLine } from "./booking-speech";
import { markBookingConfirmed, type FrontDeskUserData } from "./userdata";
import { injectBookingConfirmedChatContext } from "./booking-chat-context";
import { sendBookingSmsAsync } from "./booking-sms";
import { markAppointmentBooked, persistCallState } from "@/lib/voice/real-estate/state";
import { notifyRealEstateStaff } from "@/lib/voice/real-estate/notifications";
import { syncRealEstateLeadToCrm } from "@/lib/voice/real-estate/crm-sync";
import { markVoiceCallBooked } from "@/lib/voice/runtime-provider/livekit-call-telemetry";
import { prefillReceptionistFieldsForBooking } from "./booking-prefill";

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

/**
 * Runtime-owned Calendly write — shared by orchestrator BOOKING_COMMIT and the model-facing tool stub.
 */
export async function executeScheduleAppointmentForSession(
  session: AgentSession<FrontDeskUserData>,
  slotsMap: Map<string, AvailableSlot>,
  slot_id: string,
  inlineEmail?: string,
): Promise<string> {
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
          `Ask for their ${first.label} in one short question, then save with record_current_field. ` +
          "When saved, runtime will commit the booking with the same slot_id.",
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

    return await withLiveKitToolTelemetry(userData, "schedule_appointment", { slot_id }, async () => {
      try {
        await safeInterruptSession(session);

        const booked = await runAsyncWorkWithBridge(session, POST_EMAIL_BOOKING_FILLER, () =>
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

        await injectBookingConfirmedChatContext(session, local).catch(() => undefined);

        const spoken = await speakBookingLine(session, buildBookingSuccessLine(local));

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
          userData.booking = { ...userData.booking!, appointmentId };
          void syncFrontDeskBookingToCrm({
            workspaceId: userData.workspaceId,
            callId: userData.callId,
            appointmentId,
            callerE164: userData.callerE164,
            email: confirmedEmail,
            businessName: userData.businessName,
          }).catch(() => undefined);
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

        markBookingOperationFailed(userData, err instanceof Error ? err.message : String(err));
        await speakBookingLine(session, buildBookingFailureLine());
        return formatToolFeedbackForModel(
          toolFeedbackFromBookingWriteError(err, {
            tool: "schedule_appointment",
            slotId: slot_id,
            callerAlreadyHeardFailure: true,
          }),
        );
      }
    });
  } finally {
    finalizeScheduleAppointmentAttempt(userData);
    clearBookingEmailWaiter(userData);
  }
}
