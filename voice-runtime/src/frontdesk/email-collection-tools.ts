import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { isValidEmail, normalizeSpokenEmail } from "./email-utils";
import type { FrontDeskUserData } from "./userdata";

/**
 * Email tools on the main frontdesk agent (no AgentTask / agent_handoff).
 */
export function buildFrontDeskEmailTools() {
  const updateEmailAddress = llm.tool({
    name: "update_email_address",
    description:
      "Record the email address the caller said out loud. Call before confirm_email_address.",
    parameters: z.object({
      email: z.string().describe("The caller's email address"),
    }),
    execute: async ({ email }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      return withLiveKitToolTelemetry(
        session.userData,
        "update_email_address",
        { email },
        async () => {
          const normalized = normalizeSpokenEmail(email);
          if (!isValidEmail(normalized)) {
            throw new llm.ToolError(`Invalid email address: ${email}`);
          }
          session.userData.draftEmail = normalized;
          return (
            `Email updated to ${normalized}. ` +
            "Repeat it back briefly and ask if that's right — then call confirm_email_address when they agree."
          );
        },
      );
    },
  });

  const confirmEmailAddress = llm.tool({
    name: "confirm_email_address",
    description: "Call after the caller confirms their email is correct.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      return withLiveKitToolTelemetry(
        session.userData,
        "confirm_email_address",
        {},
        async () => {
          const confirmed = session.userData.draftEmail?.trim();
          if (!confirmed || !isValidEmail(confirmed)) {
            throw new llm.ToolError("No valid email recorded yet — call update_email_address first.");
          }
          session.userData.confirmedEmail = confirmed;
          session.userData.draftEmail = undefined;
          return (
            "Email confirmed. Call schedule_appointment with the same slot_id to finish booking."
          );
        },
      );
    },
  });

  const declineEmailCapture = llm.tool({
    name: "decline_email_capture",
    description: "Call when the caller explicitly refuses to provide an email address.",
    parameters: z.object({
      reason: z.string().describe("Brief reason the caller declined"),
    }),
    execute: async ({ reason }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      return withLiveKitToolTelemetry(
        session.userData,
        "decline_email_capture",
        { reason },
        async () => {
          session.userData.draftEmail = undefined;
          return (
            `The caller declined to provide an email (${reason}). ` +
            "Explain that email is required for the calendar invite and offer to call back later."
          );
        },
      );
    },
  });

  return [updateEmailAddress, confirmEmailAddress, declineEmailCapture];
}

export function resolveConfirmedEmail(
  userData: FrontDeskUserData,
  inlineEmail?: string,
): string | null {
  const fromParam = inlineEmail?.trim();
  if (fromParam) {
    const normalized = normalizeSpokenEmail(fromParam);
    if (isValidEmail(normalized)) return normalized;
  }
  const confirmed = userData.confirmedEmail?.trim();
  if (confirmed && isValidEmail(confirmed)) return confirmed;
  return null;
}

export const NEEDS_EMAIL_TOOL_RESULT =
  "NEEDS_EMAIL: Ask the caller to SAY their email out loud, then call update_email_address " +
  "and confirm_email_address, then call schedule_appointment again with the same slot_id.";
