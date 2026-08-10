import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AvailableSlot } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import { GetEmailTask } from "./get-email-task";
import type { FrontDeskUserData } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";

function buildFrontDeskInstructions(businessLabel: string): string {
  return [
    // Outcome — what a great interaction looks like.
    `You are Front-Desk for ${businessLabel}, a helpful and efficient voice assistant. `,
    "A great interaction ends with the caller booked into an appointment slot that works ",
    "for them, reached through a warm, flowing conversation with as little ",
    "back-and-forth as possible. ",
    // The current date/time is not baked in (it would break the prompt cache);
    // pull it from get_current_time whenever you need to reason about dates.
    "You do not inherently know the current date or time — call get_current_time ",
    "whenever you need to reason about dates, such as interpreting a request like ",
    "'next Tuesday' or checking whether a date the caller mentions has already passed. ",
    // Voice & personality — keep it short and human.
    "Your output is synthesized directly to speech, so produce a natural verbatim ",
    "transcript, not polished text. Start responses with real reactions (oh, hmm, ah) ",
    'and fillers (um, uh, like) rather than "Absolutely" or "Certainly", with ',
    "mid-sentence fillers (like, you know, I mean) where they'd naturally fall. Mirror ",
    "the caller's formality: if they're casual, use informal phrasing (gotcha, alright, ",
    "gonna, kinda, lemme, yeah); if they're more formal, keep your speech cleaner. Vary ",
    "your openers across turns — if you opened the last turn with 'gotcha', pick ",
    "'alright' or 'okay' this turn; don't repeat the same opener back-to-back. ",
    // How to work — be proactive, follow through, keep momentum after each tool result.
    "Be proactive: when the caller greets you, use it to move things forward (e.g. ",
    "'Would you like to book a time?') rather than just greeting back. ",
    "Commitment rule: if you tell the caller you will check the calendar, look up times, ",
    "book, or do anything else — start that action with the matching tool call in the ",
    "same turn. Never announce a next step and then stop; the caller should never have ",
    "to ask whether you are still working on it. You may say a brief one-liner while ",
    "calling a tool, but do not speak a full reply and wait — pair words with the tool ",
    "call immediately. After each tool result, check whether you can now move the caller ",
    "toward a booking: if so, do it; if you're missing something, ask for just that. ",
    // Speaking about times — constraints that keep it natural over voice.
    "When talking about availability, call list_available_slots and offer a few clear ",
    "options at a time, then pause for a response and guide the caller to confirm. Say ",
    "times like 'Monday at 2' — avoid timezones, timestamps, and the words 'AM'/'PM'; ",
    "use natural phrases like 'in the morning' or 'in the evening', and don't mention ",
    "the year unless it differs from the current one. When listing several times in the ",
    "same window, group them ('in the evening at 4, 5, or 6') instead of repeating the ",
    "time-of-day qualifier on each slot. If a chosen time is no longer available, let ",
    "them know gently and offer the next options. ",
    // System constraints — production calendar, booking, and confirmation behavior.
    "Only offer times that list_available_slots returned — never invent, guess, or retry ",
    "with made-up slots. If list_available_slots fails or returns no slots, say you ",
    "cannot see the calendar right now and offer to try again. ",
    "Never claim a booking succeeded unless schedule_appointment confirms it. ",
    "After the caller picks a slot, call schedule_appointment with that slot_id — do not ",
    "re-ask for date or time. ",
    "A confirmation text is sent automatically to the caller's phone after booking — ",
    "never ask for their number or offer to send texts or emails manually. ",
    "Email collected during booking is for the calendar invite only; do not promise to ",
    "email them a confirmation unless schedule_appointment succeeded.",
  ].join("");
}

export function createFrontDeskBookingAgent(input: {
  businessName: string;
  timezone: string;
}) {
  const slotsMap = new Map<string, AvailableSlot>();
  const label = input.businessName.trim() || "our office";

  const getCurrentTime = llm.tool({
    name: "get_current_time",
    description:
      "Get the current date and time. Call whenever you need to reason about dates — " +
      "to interpret relative requests like 'next Tuesday', or to check whether a date " +
      "the caller mentions has already passed.",
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
        return `The current date and time is ${formatted}.`;
      });
    },
  });

  const listAvailableSlots = llm.tool({
    name: "list_available_slots",
    description:
      "Return available appointment slots as plain text. Call this whenever you are checking the calendar or looking for openings — especially if you just told the caller you would. Infer the range from conversation.",
    parameters: z.object({
      range: z
        .enum(["+2week", "+1month", "+3month", "default"])
        .describe("How far ahead to search"),
    }),
    execute: async ({ range }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      return withLiveKitToolTelemetry(session.userData, "list_available_slots", { range }, async () => {
        const cal = session.userData.cal;
        const rangeDays =
          range === "+1month" ? 14 : range === "+3month" ? 14 : 14;
        try {
          const slots = await cal.listAvailableSlots({ daysAhead: rangeDays });
          slotsMap.clear();
          for (const slot of slots) {
            slotsMap.set(slot.slotId, slot);
          }
          const lines = cal.formatSlotsForModel(slots);
          return lines || "No slots available at the moment.";
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new llm.ToolError(
            `Could not load calendar availability: ${message}. Do not invent times — tell the caller the calendar is temporarily unavailable.`,
          );
        }
      });
    },
  });

  const scheduleAppointment = llm.tool({
    name: "schedule_appointment",
    description: "Schedule an appointment at the slot_id from list_available_slots.",
    parameters: z.object({
      slot_id: z.string().describe("Slot id from list_available_slots"),
    }),
    execute: async ({ slot_id }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      return withLiveKitToolTelemetry(
        session.userData,
        "schedule_appointment",
        { slot_id },
        async () => {
          const slot = slotsMap.get(slot_id);
          if (!slot) {
            throw new llm.ToolError(`Slot ${slot_id} was not found`);
          }

          const emailResult = await new GetEmailTask(session).run();

          // Email sub-agent may have started closing speech; clear it before Calendly.
          await session.interrupt({ force: true }).catch(() => undefined);

          try {
            opts.ctx.disallowInterruptions();
          } catch (err) {
            console.warn(
              JSON.stringify({
                source: "frontdesk-booking-agent",
                event: "disallow_interruptions_skipped",
                callId: session.userData.callId,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          }

          try {
            const booked = await session.userData.cal.scheduleAppointment({
              slot,
              attendeeEmail: emailResult.emailAddress,
            });
            const local = booked.slot.startTime.toLocaleString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: session.userData.timezone,
            });

            void import("@/lib/voice/booking-confirmation-sms")
              .then(({ sendVoiceBookingConfirmationSms }) =>
                sendVoiceBookingConfirmationSms({
                  workspaceId: session.userData.workspaceId,
                  agentId: session.userData.agentId,
                  callId: session.userData.callId,
                  startsAt: booked.slot.startTime,
                  businessName: session.userData.businessName,
                  timezone: session.userData.timezone,
                }),
              )
              .then((sms) => {
                console.log(
                  JSON.stringify({
                    source: "frontdesk-booking-agent",
                    event: "booking_confirmation_sms",
                    callId: session.userData.callId,
                    sent: sms.sent,
                    reason: sms.reason || null,
                  }),
                );
              })
              .catch((err) => {
                console.warn(
                  JSON.stringify({
                    source: "frontdesk-booking-agent",
                    event: "booking_confirmation_sms_failed",
                    callId: session.userData.callId,
                    error: err instanceof Error ? err.message : String(err),
                  }),
                );
              });

            return (
              `The appointment was successfully scheduled for ${local}. ` +
              "A confirmation text is being sent to their phone."
            );
          } catch (err) {
            if (err instanceof SlotUnavailableError) {
              session.userData.slotUnavailableCount += 1;
              throw new llm.ToolError("This slot isn't available anymore");
            }
            throw err;
          }
        },
      );
    },
  });

  return voice.Agent.create<FrontDeskUserData>({
    instructions: buildFrontDeskInstructions(label),
    tools: llm.toToolContext([getCurrentTime, listAvailableSlots, scheduleAppointment]),
    onEnter: async (agentCtx) => {
      const session = agentCtx.session as AgentSession<FrontDeskUserData>;
      const hour = session.userData.cal.now().getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      await session.generateReply({
        instructions:
          `Say hello and welcome the caller — it's currently ${timeOfDay} their time. ` +
          `You're the front desk for ${label} and you're here to help them schedule a visit. ` +
          "Invite them to book an appointment and ask what time works. Keep it warm and brief.",
        toolChoice: "none",
        allowInterruptions: false,
      });
    },
  });
}
