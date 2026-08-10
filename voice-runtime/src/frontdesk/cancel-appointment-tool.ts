import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import { buildAdapterContext } from "@/lib/integrations/framework/context";
import { cancelAppointment as cancelCalendlyEvent } from "@/lib/integrations/adapters/calendly-actions";
import type { FrontDeskUserData } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { formatBookedTimeLabel } from "./booking-recovery";

function externalEventUri(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const raw = externalId.startsWith("calendly:") ? externalId.slice("calendly:".length) : externalId;
  return raw.trim() || null;
}

/**
 * Cancel the caller's upcoming appointment (Calendly + DB).
 * Uses caller ANI to find active appointments when no id is given.
 */
export function buildFrontDeskCancelAppointmentTool() {
  return llm.tool({
    name: "cancel_appointment",
    description:
      "Cancel an upcoming appointment after the caller confirms. Looks up by caller phone if needed.",
    parameters: z.object({
      appointment_id: z
        .string()
        .optional()
        .describe("Internal appointment id if already identified"),
      confirmed: z.boolean().describe("True only when the caller explicitly confirms cancellation"),
    }),
    execute: async ({ appointment_id, confirmed }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(
        ud,
        "cancel_appointment",
        { appointment_id, confirmed },
        async () => {
          if (!confirmed) {
            return "Ask the caller to confirm before cancelling.";
          }

          const prisma = getPrisma();
          let appointment =
            appointment_id &&
            (await prisma.voiceAppointment.findFirst({
              where: {
                id: appointment_id,
                workspaceId: ud.workspaceId,
                status: { in: ["active", "confirmed"] },
              },
            }));

          if (!appointment && ud.callerE164) {
            const calls = await prisma.voiceCall.findMany({
              where: { workspaceId: ud.workspaceId, fromE164: ud.callerE164 },
              orderBy: { startedAt: "desc" },
              take: 10,
              select: { id: true },
            });
            const callIds = calls.map((c: { id: string }) => c.id);
            appointment =
              callIds.length &&
              (await prisma.voiceAppointment.findFirst({
                where: {
                  workspaceId: ud.workspaceId,
                  callId: { in: callIds },
                  status: { in: ["active", "confirmed"] },
                  startsAt: { gte: new Date() },
                },
                orderBy: { startsAt: "asc" },
              }));
          }

          if (!appointment) {
            throw new llm.ToolError(
              "I could not find an upcoming appointment on file for this number.",
            );
          }

          const eventUri = externalEventUri(appointment.externalId);
          if (eventUri) {
            const ctx = await buildAdapterContext(ud.workspaceId, "calendly");
            await cancelCalendlyEvent(ctx, { eventUri, reason: "Canceled by caller on phone" });
          }

          await prisma.voiceAppointment.update({
            where: { id: appointment.id },
            data: { status: "cancelled" },
          });

          const when = formatBookedTimeLabel(appointment.startsAt, ud.timezone);
          return `The appointment for ${when} has been cancelled.`;
        },
      );
    },
  });
}
