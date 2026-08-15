import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { EmailCollectionResult } from "./email-collection-task";
import { EMAIL_COLLECTION_PROMPT } from "./email-collection-task";
import { speakBookingLine } from "./booking-speech";
import { markBookingOperationState } from "./booking-operation";
import { POST_EMAIL_BOOKING_FILLER } from "../booking-completion-messages";
import { speakBeforeTaskHandoff } from "../task-async-work-bridge";
import {
  formatToolFeedbackForModel,
  toolFeedbackRecoverable,
  toolFeedbackSuccess,
} from "@/lib/voice/tool-feedback";
import {
  formatBookingEmailSavedFeedback,
  persistConfirmedBookingEmail,
} from "./booking-email-state";
import type { FrontDeskUserData } from "./userdata";

export class BookingEmailTimeoutError extends Error {
  constructor() {
    super("booking_email_timeout");
    this.name = "BookingEmailTimeoutError";
  }
}

type BookingEmailWaiter = {
  resolve: (result: EmailCollectionResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function clearBookingEmailWaiter(ud: FrontDeskUserData): void {
  const waiter = ud.bookingEmailWaiter;
  if (!waiter) return;
  clearTimeout(waiter.timer);
  ud.bookingEmailWaiter = undefined;
}

function createBookingEmailWaiter(
  ud: FrontDeskUserData,
  timeoutMs: number,
): Promise<EmailCollectionResult> {
  clearBookingEmailWaiter(ud);
  return new Promise<EmailCollectionResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      clearBookingEmailWaiter(ud);
      reject(new BookingEmailTimeoutError());
    }, timeoutMs);
    ud.bookingEmailWaiter = {
      timer,
      resolve: (result) => {
        clearBookingEmailWaiter(ud);
        resolve(result);
      },
      reject: (err) => {
        clearBookingEmailWaiter(ud);
        reject(err);
      },
    };
  });
}

function resolveBookingEmailWaiter(
  ud: FrontDeskUserData,
  result: EmailCollectionResult,
): void {
  const waiter = ud.bookingEmailWaiter;
  if (!waiter) return;
  waiter.resolve(result);
}

/**
 * Inline email gate for schedule_appointment — avoids AgentTask handoff inside
 * OpenAI Realtime function tools (SDK: inline tasks must complete before tool returns).
 */
export async function collectEmailInlineForBooking(
  session: AgentSession<FrontDeskUserData>,
  options?: { skipPrompt?: boolean; timeoutMs?: number },
): Promise<EmailCollectionResult> {
  const ud = session.userData;
  markBookingOperationState(ud, "collecting_email");

  if (!options?.skipPrompt) {
    await speakBookingLine(session, EMAIL_COLLECTION_PROMPT);
  }

  const emailPromise = createBookingEmailWaiter(ud, options?.timeoutMs ?? 120_000);

  try {
    return await emailPromise;
  } catch (err) {
    if (err instanceof BookingEmailTimeoutError) {
      return { email: "", declined: true };
    }
    throw err;
  }
}

export function buildRecordBookingEmailTool() {
  return llm.tool({
    name: "record_booking_email",
    description:
      "Save confirmed email for the calendar invite. Prefer record_receptionist_field with field_id email " +
      "during normal booking intake — do not call both tools for the same email. " +
      "Use this when schedule_appointment reports missing email or the inline email waiter is active.",
    parameters: z.object({
      email: z.string().describe("Confirmed email address"),
    }),
    execute: async ({ email }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      const persisted = persistConfirmedBookingEmail(ud, email);

      if (ud.bookingEmailWaiter && persisted.ok) {
        await speakBeforeTaskHandoff(session, POST_EMAIL_BOOKING_FILLER);
        resolveBookingEmailWaiter(ud, { email: persisted.email, declined: false });
        return "Email saved. Calendar booking is in progress — do not speak or add filler.";
      }

      return formatBookingEmailSavedFeedback(ud, "record_booking_email", persisted);
    },
  });
}

export function buildDeclineBookingEmailTool() {
  return llm.tool({
    name: "decline_booking_email",
    description: "Caller refuses to provide email during an active booking.",
    parameters: z.object({
      reason: z.string().describe("Why they declined"),
    }),
    execute: async ({ reason }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      if (!ud.bookingEmailWaiter) {
        return formatToolFeedbackForModel(
          toolFeedbackRecoverable({
            tool: "decline_booking_email",
            recovery_class: "MISSING_INFORMATION",
            reason: "email_declined",
            field_id: "email",
            next_action: "take_message",
            guidance:
              "Caller declined email. Explain the calendar needs email for invites, or offer take_message.",
          }),
        );
      }
      ud.draftEmail = undefined;
      resolveBookingEmailWaiter(ud, { email: "", declined: true });
      return formatToolFeedbackForModel(
        toolFeedbackSuccess(`Caller declined email (${reason}). Offer take_message or callback.`, {
          tool: "decline_booking_email",
          next_action: "take_message",
        }),
      );
    },
  });
}
