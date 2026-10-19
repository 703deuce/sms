import "server-only";

import { getPrisma } from "@/lib/server/db";
import type { LiveSessionRuntime } from "@/lib/server/receptionist/runtime/session-store";
import { toolErr, toolOk, type ToolResult } from "@/lib/server/voice-v3/tool-result";
import { searchBusinessKnowledge } from "@/lib/server/voice-v3/knowledge/search";
import * as scheduling from "@/lib/server/voice-v3/scheduling/service";

export async function executeNativeVoiceV3Tool(input: {
  session: LiveSessionRuntime;
  toolName: string;
  args: Record<string, unknown>;
  functionCallId: string;
}): Promise<ToolResult> {
  const { session, toolName, args } = input;
  const editor = session.bundle.editor;
  const allowed = new Set(session.bundle.runtime.toolNames);
  if (!allowed.has(toolName)) {
    return toolErr("TOOL_DISABLED", `Tool ${toolName} is not enabled on the published configuration.`);
  }

  const prisma = getPrisma();
  if (!session.processedToolCalls) session.processedToolCalls = new Set();
  if (session.processedToolCalls.has(input.functionCallId)) {
    const prior = await prisma.voiceToolExecution.findFirst({
      where: { callId: session.callId },
      orderBy: { completedAt: "desc" },
    });
    if (prior?.output && typeof prior.output === "object") {
      return prior.output as ToolResult;
    }
  }
  session.processedToolCalls.add(input.functionCallId);

  if (!session.scheduling) session.scheduling = {};

  try {
    let result: ToolResult;

    switch (toolName) {
      case "update_intake": {
        const fields = (args.fields || args) as Record<string, unknown>;
        session.intake = { ...session.intake, ...fields };
        await prisma.voiceCall.update({
          where: { id: session.callId },
          data: { dynamicVariables: session.intake as object },
        });
        result = toolOk("success", { intake: session.intake });
        break;
      }
      case "set_scheduling_preference": {
        session.scheduling.preference = {
          serviceId: (args.service_id as string) || null,
          timezone: (args.timezone as string) || editor.identity.language || "America/Chicago",
        };
        result = toolOk("success", { preference: session.scheduling.preference });
        break;
      }
      case "find_availability": {
        const tz =
          session.scheduling.preference?.timezone ||
          (args.timezone as string) ||
          "America/Chicago";
        const found = await scheduling.findAvailability({
          workspaceId: session.workspaceId,
          editor,
          timezone: tz,
          serviceId: (args.service_id as string) || session.scheduling.preference?.serviceId,
          state: session.scheduling,
        });
        if (!found.ok) {
          result = toolErr(found.code, found.message);
        } else {
          result = toolOk("success", {
            slots: found.slots,
            lines_for_model: found.linesForModel,
          });
        }
        break;
      }
      case "book_appointment": {
        const booked = await scheduling.bookAppointment({
          workspaceId: session.workspaceId,
          editor,
          slotId: String(args.slot_id || args.selected_slot_id || ""),
          attendeeName: String(args.attendee_name || args.name || "Caller"),
          attendeeEmail: args.attendee_email ? String(args.attendee_email) : undefined,
          state: session.scheduling,
        });
        if (!booked.ok) {
          result = toolErr(booked.code, booked.message);
        } else {
          await prisma.voiceCall.update({
            where: { id: session.callId },
            data: { appointmentBooked: true, outcome: "booked" },
          });
          result = toolOk("success", booked);
        }
        break;
      }
      case "find_appointment": {
        const tz =
          session.scheduling.preference?.timezone ||
          (args.timezone as string) ||
          editor.identity.language ||
          "America/Chicago";
        const intake = session.intake || {};
        const found = await scheduling.findAppointment({
          workspaceId: session.workspaceId,
          editor,
          timezone: tz,
          identity: {
            name: String(args.name || intake.name || "").trim() || undefined,
            phone: String(args.phone || intake.phone || "").trim() || undefined,
            email: String(args.email || intake.email || "").trim() || undefined,
            service: String(args.service || "").trim() || undefined,
            inboundAni: String(intake.inbound_caller_e164 || intake.caller_e164 || "").trim() || undefined,
          },
          state: session.scheduling,
          appointmentSelectionId: args.appointment_selection_id as string | null | undefined,
          confirmSelection: Boolean(args.confirm_selection),
        });
        if (!found.ok) {
          result = toolErr(found.code, found.message);
        } else {
          result = toolOk("success", found);
        }
        break;
      }
      case "reschedule_appointment": {
        const moved = await scheduling.rescheduleAppointment({
          workspaceId: session.workspaceId,
          editor,
          slotId: String(args.slot_id || args.selected_slot_id || ""),
          state: session.scheduling,
        });
        if (!moved.ok) {
          result = toolErr(moved.code, moved.message);
        } else {
          await prisma.voiceCall.update({
            where: { id: session.callId },
            data: { outcome: "rescheduled" },
          });
          result = toolOk("success", moved);
        }
        break;
      }
      case "cancel_appointment": {
        const cancelled = await scheduling.cancelAppointment({
          workspaceId: session.workspaceId,
          editor,
          state: session.scheduling,
          confirmed: Boolean(args.confirmed),
        });
        if (!cancelled.ok) {
          result = toolErr(cancelled.code, cancelled.message);
        } else {
          await prisma.voiceCall.update({
            where: { id: session.callId },
            data: { outcome: "cancelled" },
          });
          result = toolOk("success", cancelled);
        }
        break;
      }
      case "send_booking_link": {
        const link = editor.appointments.bookingLink?.trim();
        if (!link) {
          result = toolErr("no_booking_link", "No booking link configured.");
        } else {
          result = toolOk("success", { booking_link: link });
        }
        break;
      }
      case "transfer_call": {
        const dest = editor.transfers.find((t) => t.enabled && t.number?.trim());
        if (!dest) {
          result = toolErr("no_transfer_target", "No transfer destination configured.");
        } else {
          await prisma.voiceCall.update({
            where: { id: session.callId },
            data: { transferred: true, outcome: "transferred" },
          });
          result = toolOk("success", {
            transfer_to_e164: dest.number,
            transfer_label: dest.name,
            cold: editor.transferStyle !== "warm",
          });
        }
        break;
      }
      case "request_callback": {
        await prisma.voiceCall.update({
          where: { id: session.callId },
          data: { outcome: "callback_requested" },
        });
        result = toolOk("success", { callback: true });
        break;
      }
      case "report_unwanted_solicitor": {
        await prisma.voiceCall.update({
          where: { id: session.callId },
          data: { outcome: "solicitor_blocked" },
        });
        result = toolOk("success", { reported: true });
        break;
      }
      case "business_answer": {
        const query = String(args.query || args.question || "");
        const { matches } = await searchBusinessKnowledge({
          workspaceId: session.workspaceId,
          query,
        });
        if (!matches.length) {
          result = toolOk("no_match", { matches: [] });
        } else {
          result = toolOk("success", { matches });
        }
        break;
      }
      case "end_call":
        result = toolOk("success", { ended: true });
        break;
      default:
        result = toolErr("unknown_tool", `Unknown tool: ${toolName}`);
    }

    await prisma.voiceToolExecution.create({
      data: {
        workspaceId: session.workspaceId,
        callId: session.callId,
        status: result.ok ? "success" : "failed",
        input: { toolName, arguments: args, functionCallId: input.functionCallId },
        output: result as object,
        errorMessage: result.ok ? null : result.message,
        latencyMs: 0,
        completedAt: new Date(),
      },
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.voiceToolExecution.create({
      data: {
        workspaceId: session.workspaceId,
        callId: session.callId,
        status: "failed",
        input: { toolName, arguments: args, functionCallId: input.functionCallId },
        errorMessage: message,
        latencyMs: 0,
        completedAt: new Date(),
      },
    });
    return toolErr("TOOL_EXECUTION_FAILED", message, undefined, true);
  }
}
