import { llm, voice } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import { z } from "zod";
import { domainDetectCallerIntent, domainEndCall, domainRequestHuman } from "@/lib/voice/domain-actions";
import { buildAmyLiveKitRootInstructions } from "@/lib/agents/appointment-booking/intelligence/amy-livekit-prompt";
import type { AmyUserData } from "./metadata";
import { requireCallContext, stashCallContext } from "./call-context";
import { alignCallContext } from "./scheduling-bridge";
import { runCollectCallerFieldsTaskGroup } from "./tasks/collect-field-task";
import { BookAppointmentTask } from "./tasks/book-appointment-task";
import { ModifyAppointmentTask } from "./tasks/modify-appointment-task";

export function createAmyReceptionistAgent() {
  const instructions = buildAmyLiveKitRootInstructions("our team");

  const scheduleAppointment = llm.tool({
    name: "schedule_appointment",
    description:
      "Schedule a new appointment. Do not ask for details in advance — the runtime collects them.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<AmyUserData>;
      await runCollectCallerFieldsTaskGroup(session);
      const result = await new BookAppointmentTask(session).run();
      if (result.bookingId) {
        return `The appointment is booked${result.slotLabel ? ` for ${result.slotLabel}` : ""}. Ask if they need anything else.`;
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
      const result = await new ModifyAppointmentTask(action, session).run();
      if (!result) {
        return "I could not find an appointment to change. Offer to book a new one.";
      }
      if (result.action === "cancel") {
        return "The appointment was cancelled. Ask if they need anything else.";
      }
      return "The appointment was rescheduled. Ask if they need anything else.";
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
    tools: llm.toToolContext([scheduleAppointment, modifyAppointment, transferToHuman, endCall]),
    onEnter: async (agentCtx) => {
      const business =
        agentCtx.session.userData.callContext?.businessName?.trim() || "our team";
      if (business !== "our team") {
        await agentCtx.agent.updateInstructions(buildAmyLiveKitRootInstructions(business));
      }
      await agentCtx.session.generateReply({
        instructions:
          `Greet the caller in one short sentence as Amy with ${business}. ` +
          "If they already said what they need, help with that; otherwise ask how you can help.",
        toolChoice: "none",
        allowInterruptions: false,
      });
    },
  });
}
