import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { buildModifyAppointmentTaskInstructions } from "@/lib/agents/appointment-booking/intelligence/amy-livekit-prompt";
import type { AmyUserData } from "../metadata";
import { requireCallContext, stashCallContext } from "../call-context";
import {
  BookAppointmentTask,
  type BookAppointmentResult,
} from "./book-appointment-task";
import {
  cancelCallerAppointment,
  findCallerAppointments,
  rescheduleHeldAppointment,
} from "../scheduling-bridge";
import {
  agentTaskSuperOptions,
  nestedTaskOptionsFromSession,
  summarizeChatContextForNestedTask,
  type NestedTaskContextOptions,
} from "./task-context";
import { buildGetBusinessAnswerTool } from "./knowledge-tool";

export type ModifyAppointmentResult = {
  action: "reschedule" | "cancel";
  appointmentId: string;
  newBooking?: BookAppointmentResult;
};

type AppointmentOption = {
  id: string;
  label: string;
};

export class ModifyAppointmentTask extends voice.AgentTask<ModifyAppointmentResult | null> {
  private appointments: AppointmentOption[] = [];

  constructor(
    private readonly modifyAction: "reschedule" | "cancel",
    private readonly sessionRef: AgentSession<AmyUserData>,
    taskContext?: NestedTaskContextOptions,
  ) {
    super(
      agentTaskSuperOptions(
        {
          instructions: buildModifyAppointmentTaskInstructions(modifyAction),
          tools: [],
        },
        taskContext ?? nestedTaskOptionsFromSession(sessionRef),
      ),
    );
  }

  async onEnter(): Promise<void> {
    await this.updateTools([buildGetBusinessAnswerTool(this.sessionRef)]);

    let ctx = requireCallContext(this.sessionRef);
    const found = await findCallerAppointments(ctx);
    ctx = found.ctx;
    stashCallContext(this.sessionRef, ctx);

    const data = (found.result.data || {}) as Record<string, unknown>;
    const rawAppointments = Array.isArray(data.appointments) ? data.appointments : [];
    this.appointments = rawAppointments
      .map((row) => {
        const appt = row as Record<string, unknown>;
        const id = String(appt.appointment_id || appt.id || "").trim();
        const label = String(appt.spoken_label || appt.label || appt.starts_at || id).trim();
        if (!id) return null;
        return { id, label };
      })
      .filter((row): row is AppointmentOption => Boolean(row));

    if (!this.appointments.length) {
      await this.session.generateReply({
        instructions:
          found.result.speak ||
          "Tell the caller you could not find an appointment on file and offer to book a new one.",
      });
      this.complete(null);
      return;
    }

    await this.publishAppointments();
    await this.attachSelectionTool();
    await this.session.generateReply({
      instructions:
        `Prompt the caller to choose an appointment to ${this.modifyAction}. ` +
        "Confirm before proceeding.",
    });
  }

  private async publishAppointments(): Promise<void> {
    const lines = this.appointments.map((appt) => `${appt.id} – ${appt.label}`);
    const chatCtx = this.chatCtx.copy();
    chatCtx.addMessage({
      role: "system",
      content: `The caller has these appointments on file:\n${lines.join("\n")}`,
    });
    await this.updateChatCtx(chatCtx);
  }

  private async attachSelectionTool(): Promise<void> {
    const ids = this.appointments.map((appt) => appt.id) as [string, ...string[]];

    const selectAppointment = llm.tool({
      name: "confirm_appointment_selection",
      description: `Confirm which appointment to ${this.modifyAction}.`,
      parameters: z.object({
        appointment_id: z.enum(ids),
        confirmed: z.boolean().describe("True when the caller explicitly confirms"),
      }),
      execute: async ({ appointment_id, confirmed }) => {
        if (!confirmed) {
          return "Ask the caller to confirm before proceeding.";
        }

        let ctx = requireCallContext(this.sessionRef);

        if (this.modifyAction === "cancel") {
          const cancelled = await cancelCallerAppointment(ctx, appointment_id, true);
          ctx = cancelled.ctx;
          stashCallContext(this.sessionRef, ctx);
          if (!cancelled.result.ok) {
            throw new llm.ToolError(cancelled.result.speak || "I could not cancel that appointment.");
          }
          this.complete({ action: "cancel", appointmentId: appointment_id });
          return cancelled.result.speak || "The appointment was cancelled.";
        }

        const summarizedCtx = await summarizeChatContextForNestedTask(this.sessionRef, {
          keepLastTurns: 0,
        });
        const taskContext: NestedTaskContextOptions = {
          ...nestedTaskOptionsFromSession(this.sessionRef),
          chatCtx: summarizedCtx,
        };
        const newBooking = await new BookAppointmentTask(this.sessionRef, taskContext).run();
        ctx = requireCallContext(this.sessionRef);
        const slotId = ctx.session.heldSlot || ctx.session.selectedSlot;
        if (!slotId) {
          throw new llm.ToolError("I still need a new appointment time.");
        }
        const rescheduled = await rescheduleHeldAppointment(ctx, appointment_id, slotId, true);
        ctx = rescheduled.ctx;
        stashCallContext(this.sessionRef, ctx);
        if (!rescheduled.result.ok) {
          throw new llm.ToolError(rescheduled.result.speak || "I could not reschedule that appointment.");
        }
        this.complete({
          action: "reschedule",
          appointmentId: appointment_id,
          newBooking,
        });
        return rescheduled.result.speak || "The appointment was rescheduled.";
      },
    });

    await this.updateTools([buildGetBusinessAnswerTool(this.sessionRef), selectAppointment]);
  }
}
