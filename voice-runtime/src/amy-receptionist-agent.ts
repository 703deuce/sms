import { llm, voice } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import { z } from "zod";
import { domainDetectCallerIntent, domainEndCall, domainGetBusinessAnswer, domainRequestHuman } from "@/lib/voice/domain-actions";
import {
  buildAmyLiveKitRootInstructions,
  buildAmyRootGreetingInstructions,
} from "@/lib/agents/appointment-booking/intelligence/amy-livekit-prompt";
import { getBookingReceipt, hasBookingReceipt } from "@/lib/voice/workflow-runtime/completion-guards";
import type { AmyUserData } from "./metadata";
import { requireCallContext, stashCallContext } from "./call-context";
import { alignCallContext } from "./scheduling-bridge";
import { runCollectCallerFieldsTaskGroup } from "./tasks/collect-field-task";
import { BookAppointmentTask } from "./tasks/book-appointment-task";
import { ModifyAppointmentTask } from "./tasks/modify-appointment-task";
import { nestedTaskOptionsFromSession } from "./tasks/task-context";
import {
  BOOKING_COMPLETE_TOOL_RESULT,
  buildBookingSuccessLine,
} from "./booking-completion-messages";

function alreadyBookedAmyMessage(session: AgentSession<AmyUserData>): string | null {
  const ctx = session.userData.callContext;
  if (!hasBookingReceipt(ctx.session)) return null;
  const receipt = getBookingReceipt(ctx.session);
  const when = receipt?.start ? ` for ${receipt.start}` : "";
  return (
    `already_completed: The appointment is already confirmed${when}. ` +
    "Tell the caller they're all set — do not book again."
  );
}

/** LEGACY / TEST ONLY — not routed from production inbound SIP. */

export function createAmyReceptionistAgent(businessName: string) {
  const instructions = buildAmyLiveKitRootInstructions(businessName);

  const scheduleAppointment = llm.tool({
    name: "schedule_appointment",
    description:
      "Schedule a new appointment. Do not ask for details in advance — the runtime collects them.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<AmyUserData>;
      const runCtx = opts.ctx;

      const alreadyBooked = alreadyBookedAmyMessage(session);
      if (alreadyBooked) return alreadyBooked;

      if (runCtx.speechHandle.interrupted) {
        return "Booking was interrupted. Ask if they'd still like to schedule.";
      }

      await runCollectCallerFieldsTaskGroup(session);

      if (runCtx.speechHandle.interrupted) {
        return "Booking was interrupted during field collection.";
      }

      runCtx.disallowInterruptions();
      await runCtx.update("Perfect — one moment while I get that scheduled for you.");

      const taskContext = nestedTaskOptionsFromSession(session);
      const result = await new BookAppointmentTask(session, taskContext).run();

      const bookedAgain = alreadyBookedAmyMessage(session);
      if (bookedAgain) return bookedAgain;

      if (result.bookingId) {
        const when = result.slotLabel || "your selected time";
        await runCtx.update(buildBookingSuccessLine(when));
        return BOOKING_COMPLETE_TOOL_RESULT;
      }
      return "I could not complete the booking. Offer to try another time or take a message.";
    },
  });

  const modifyAppointment = llm.tool({
    name: "modify_appointment",
    description: "Reschedule or cancel an existing appointment.",
    parameters: z.object({
      action: z.enum(["reschedule", "cancel"]).describe("Whether to reschedule or cancel"),
    }),
    execute: async ({ action }, opts) => {
      const session = opts.ctx.session as AgentSession<AmyUserData>;
      const runCtx = opts.ctx;
      let ctx = requireCallContext(session);
      alignCallContext(ctx, "find");
      await domainDetectCallerIntent({
        ctx,
        utterance: action === "cancel" ? "cancel my appointment" : "reschedule my appointment",
      });
      ctx.session.runtime.session_runtime = {
        ...(ctx.session.runtime.session_runtime || {}),
        callerIntent: action === "cancel" ? "cancel" : "reschedule",
      };
      stashCallContext(session, ctx);

      await runCollectCallerFieldsTaskGroup(session);

      if (runCtx.speechHandle.interrupted) {
        return "The modification was interrupted. Ask if they'd still like to continue.";
      }

      runCtx.disallowInterruptions();

      const taskContext = nestedTaskOptionsFromSession(session);
      const result = await new ModifyAppointmentTask(action, session, taskContext).run();
      if (!result) {
        return "I could not find an appointment to change. Offer to book a new one.";
      }
      if (result.action === "cancel") {
        return "The appointment was cancelled. Ask if they need anything else.";
      }
      return "The appointment was rescheduled. Ask if they need anything else.";
    },
  });

  const getBusinessAnswer = llm.tool({
    name: "get_business_answer",
    description:
      "Look up business hours, pricing, policies, or FAQs when the caller asks a general question.",
    parameters: z.object({
      topic: z.string().describe("What the caller wants to know"),
    }),
    execute: async ({ topic }, opts) => {
      const session = opts.ctx.session as AgentSession<AmyUserData>;
      let ctx = requireCallContext(session);
      const result = await domainGetBusinessAnswer({ ctx, topic });
      stashCallContext(session, ctx);
      if (!result.ok) {
        throw new llm.ToolError(result.speak);
      }
      return result.speak;
    },
  });

  const transferToHuman = llm.tool({
    name: "transfer_to_human",
    description:
      "Transfer to a human after the caller confirms they want to speak with someone.",
    parameters: z.object({
      reason: z.string().optional(),
    }),
    execute: async ({ reason }, opts) => {
      const session = opts.ctx.session as AgentSession<AmyUserData>;
      let ctx = requireCallContext(session);
      alignCallContext(ctx, "collect");
      const result = await domainRequestHuman({ ctx, reason });
      stashCallContext(session, ctx);
      if (!result.ok) {
        throw new llm.ToolError(result.speak);
      }
      return result.speak;
    },
  });

  const endCall = llm.tool({
    name: "end_call",
    description: "End the call when the conversation is complete.",
    parameters: z.object({
      reason: z.string().optional(),
    }),
    execute: async ({ reason }, opts) => {
      const session = opts.ctx.session as AgentSession<AmyUserData>;
      let ctx = requireCallContext(session);
      const result = await domainEndCall({ ctx, reason });
      stashCallContext(session, ctx);
      if (!result.ok) {
        throw new llm.ToolError(result.speak);
      }
      session.shutdown({ reason: reason || "caller_done" });
      return result.speak;
    },
  });

  return voice.Agent.create<AmyUserData>({
    instructions,
    tools: llm.toToolContext([
      scheduleAppointment,
      modifyAppointment,
      getBusinessAnswer,
      transferToHuman,
      endCall,
    ]),
    onEnter: async (agentCtx) => {
      const business =
        agentCtx.session.userData.callContext?.businessName?.trim() || businessName || "our team";
      await agentCtx.session.generateReply({
        instructions: buildAmyRootGreetingInstructions(business),
        toolChoice: "none",
        allowInterruptions: false,
      });
    },
  });
}
