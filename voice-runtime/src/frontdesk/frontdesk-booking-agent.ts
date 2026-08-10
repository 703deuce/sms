import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AvailableSlot } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import { GetEmailTask } from "./get-email-task";
import type { FrontDeskUserData } from "./userdata";

const FRONTDESK_INSTRUCTIONS = [
  "You are Front-Desk, a helpful and efficient voice assistant for booking appointments.",
  "A great interaction ends with the caller booked into a time that works for them, with as little back-and-forth as possible.",
  "You do not inherently know the current date or time — call get_current_time whenever you need to reason about dates.",
  "Your output is synthesized directly to speech, so produce a natural verbatim transcript, not polished text.",
  "Start responses with real reactions and fillers rather than 'Absolutely' or 'Certainly'.",
  "Mirror the caller's formality and vary your openers across turns.",
  "Be proactive: when the caller greets you, move toward booking rather than only greeting back.",
  "Before a tool call that takes a moment, give a brief spoken acknowledgment so there is no dead air.",
  "When talking about availability, call list_available_slots and offer a few clear options at a time.",
  "Say times like 'Monday at 2' — avoid timezones, timestamps, and the words AM/PM.",
  "Use natural phrases like 'in the morning' or 'in the evening'.",
  "Never claim a booking succeeded unless schedule_appointment confirms it.",
].join("\n");

export function createFrontDeskBookingAgent(input: {
  businessName: string;
  timezone: string;
}) {
  const slotsMap = new Map<string, AvailableSlot>();
  const label = input.businessName.trim() || "our office";

  const getCurrentTime = llm.tool({
    name: "get_current_time",
    description:
      "Get the current date and time. Call when interpreting relative dates like tomorrow or next Tuesday.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
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
    },
  });

  const listAvailableSlots = llm.tool({
    name: "list_available_slots",
    description:
      "Return available appointment slots as plain text. Infer the range from conversation — do not ask the caller to pick a range keyword.",
    parameters: z.object({
      range: z
        .enum(["+2week", "+1month", "+3month", "default"])
        .describe("How far ahead to search"),
    }),
    execute: async ({ range }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const cal = session.userData.cal;
      const current = cal.now();
      const rangeDays =
        range === "+1month" ? 30 : range === "+3month" ? 90 : 14;
      const end = new Date(current.getTime() + rangeDays * 86_400_000);
      const slots = await cal.listAvailableSlots({
        startTime: current,
        endTime: end,
      });
      slotsMap.clear();
      for (const slot of slots) {
        slotsMap.set(slot.slotId, slot);
      }
      const lines = cal.formatSlotsForModel(slots);
      return lines || "No slots available at the moment.";
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
      const slot = slotsMap.get(slot_id);
      if (!slot) {
        throw new llm.ToolError(`Slot ${slot_id} was not found`);
      }

      const emailResult = await new GetEmailTask(session).run();
      if (opts.ctx.speechHandle.interrupted) {
        return null;
      }

      opts.ctx.disallowInterruptions();

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
        return `The appointment was successfully scheduled for ${local}.`;
      } catch (err) {
        if (err instanceof SlotUnavailableError) {
          session.userData.slotUnavailableCount += 1;
          throw new llm.ToolError("This slot isn't available anymore");
        }
        throw err;
      }
    },
  });

  return voice.Agent.create<FrontDeskUserData>({
    instructions: FRONTDESK_INSTRUCTIONS.replace(
      "Front-Desk",
      `Front-Desk for ${label}`,
    ),
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
