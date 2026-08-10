import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { buildBookAppointmentTaskInstructions } from "@/lib/agents/appointment-booking/intelligence/amy-livekit-prompt";
import type { AmyUserData } from "../metadata";
import { requireCallContext, stashCallContext } from "../call-context";
import type { ModelSlotRef } from "@/lib/voice/domain-actions/tool-results";
import {
  commitBooking,
  holdAppointmentSlot,
  loadAvailableSlots,
} from "../scheduling-bridge";

import {
  agentTaskSuperOptions,
  nestedTaskOptionsFromSession,
  type NestedTaskContextOptions,
} from "./task-context";

export type BookAppointmentResult = {
  bookingId?: string | null;
  slotLabel?: string | null;
};

export class BookAppointmentTask extends voice.AgentTask<BookAppointmentResult> {
  private slots: ModelSlotRef[] = [];
  private selectedSlotId: string | null = null;

  constructor(
    private readonly sessionRef: AgentSession<AmyUserData>,
    taskContext?: NestedTaskContextOptions,
  ) {
    super(
      agentTaskSuperOptions(
        {
          instructions: buildBookAppointmentTaskInstructions(),
          tools: [],
        },
        taskContext ?? nestedTaskOptionsFromSession(sessionRef),
      ),
    );
  }

  async onEnter(): Promise<void> {
    let ctx = requireCallContext(this.sessionRef);
    const loaded = await loadAvailableSlots(ctx);
    ctx = loaded.ctx;
    stashCallContext(this.sessionRef, ctx);

    if (!loaded.result.ok || loaded.slots.length === 0) {
      await this.session.generateReply({
        instructions:
          loaded.result.speak ||
          "Tell the caller you could not find openings and ask if another day might work.",
      });
      this.complete({});
      return;
    }

    this.slots = loaded.slots;
    await this.publishAvailableSlots();
    await this.attachSlotSelectionTool();

    if (this.slots.length > 1) {
      await this.session.generateReply({
        instructions:
          "Inform the caller of the available appointment times and ask which they prefer. " +
          "Offer a few options naturally — avoid listing every slot.",
      });
    } else {
      await this.session.generateReply({
        instructions:
          "Inform the caller of the available time and confirm if they would like that appointment.",
      });
    }
  }

  private async publishAvailableSlots(): Promise<void> {
    const lines = this.slots.map(
      (slot) => `${slot.slotId} – ${slot.spokenLabel}`,
    );
    const chatCtx = this.chatCtx.copy();
    chatCtx.addMessage({
      role: "system",
      content: `These appointment times are available:\n${lines.join("\n")}`,
    });
    await this.updateChatCtx(chatCtx);
  }

  private async attachSlotSelectionTool(): Promise<void> {
    const slotIds = this.slots.map((slot) => slot.slotId) as [string, ...string[]];
    const slotById = new Map(this.slots.map((slot) => [slot.slotId, slot]));

    const chooseTime = llm.tool({
      name: "confirm_appointment_time",
      description: "Record the appointment time the caller chose.",
      parameters: z.object({
        slot_id: z.enum(slotIds).describe("Slot id from the offered appointment times"),
      }),
      execute: async ({ slot_id }) => {
        let ctx = requireCallContext(this.sessionRef);
        this.selectedSlotId = slot_id;
        const held = await holdAppointmentSlot(ctx, slot_id);
        ctx = held.ctx;
        stashCallContext(this.sessionRef, ctx);
        if (!held.result.ok) {
          throw new llm.ToolError(held.result.speak || "That time is not available.");
        }

        const label = slotById.get(slot_id)?.spokenLabel || slot_id;
        await this.attachBookingConfirmationTool();
        await this.session.generateReply({
          instructions: `Confirm they want ${label} before booking.`,
        });
        return `Held ${label} for confirmation.`;
      },
    });

    await this.updateTools([chooseTime]);
  }

  private async attachBookingConfirmationTool(): Promise<void> {
    const confirmBooking = llm.tool({
      name: "confirm_booking",
      description: "Commit the booking after an explicit yes from the caller.",
      parameters: z.object({
        confirmed: z.boolean().describe("True only when the caller explicitly confirms"),
      }),
      execute: async ({ confirmed }) => {
        let ctx = requireCallContext(this.sessionRef);
        const booked = await commitBooking(ctx, confirmed);
        ctx = booked.ctx;
        stashCallContext(this.sessionRef, ctx);

        if (!confirmed) {
          this.complete({});
          return "Booking not confirmed.";
        }
        if (!booked.result.ok) {
          throw new llm.ToolError(booked.result.speak || "I could not complete the booking.");
        }

        const bookingId =
          ctx.session.bookingId ||
          (typeof booked.result.data?.booking === "object" &&
          booked.result.data?.booking &&
          typeof (booked.result.data.booking as { bookingId?: string }).bookingId === "string"
            ? (booked.result.data.booking as { bookingId: string }).bookingId
            : null);

        const slotLabel =
          this.slots.find((slot) => slot.slotId === this.selectedSlotId)?.spokenLabel || null;

        this.complete({ bookingId, slotLabel });
        return booked.result.speak || "The appointment is booked.";
      },
    });

    await this.updateTools([confirmBooking]);
  }
}
