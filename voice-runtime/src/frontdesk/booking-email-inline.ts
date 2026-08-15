import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { isValidEmail, normalizeSpokenEmail } from "./email-utils";
import type { EmailCollectionResult } from "./email-collection-task";
import { EMAIL_COLLECTION_PROMPT } from "./email-collection-task";
import { speakBookingLine } from "./booking-speech";
import { markBookingOperationState } from "./booking-operation";
import { POST_EMAIL_BOOKING_FILLER } from "../booking-completion-messages";
import { speakBeforeTaskHandoff } from "../task-async-work-bridge";
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
      "Save the caller's confirmed email for the calendar invite. " +
      "Call after repeating the email back and the caller confirms it is correct.",
    parameters: z.object({
      email: z.string().describe("Confirmed email address"),
    }),
    execute: async ({ email }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      const normalized = normalizeSpokenEmail(email);
      if (!isValidEmail(normalized)) {
        throw new llm.ToolError(`Invalid email: ${email}`);
      }
      ud.confirmedEmail = normalized;
      ud.draftEmail = undefined;

      if (ud.bookingEmailWaiter) {
        await speakBeforeTaskHandoff(session, POST_EMAIL_BOOKING_FILLER);
        resolveBookingEmailWaiter(ud, { email: normalized, declined: false });
        return "Email saved. Calendar booking is in progress — do not speak or add filler.";
      }

      const slotId = ud.pendingSlotId || ud.bookingOperation?.slotId;
      return (
        "Email saved for this call. " +
        (slotId
          ? `Call schedule_appointment again with slot_id ${slotId} to complete the booking.`
          : "Call schedule_appointment with the chosen slot_id to complete the booking.")
      );
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
        throw new llm.ToolError("No active booking email collection.");
      }
      ud.draftEmail = undefined;
      resolveBookingEmailWaiter(ud, { email: "", declined: true });
      return `Caller declined email (${reason}).`;
    },
  });
}
