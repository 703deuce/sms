import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { isValidEmail, normalizeSpokenEmail } from "./email-utils";
import type { FrontDeskUserData } from "./userdata";

export function createEmailCollectionTools() {
  const updateEmailAddress = llm.tool({
    name: "update_email_address",
    description:
      "Record the email the caller SAID out loud. Call before confirm_email_address.",
    parameters: z.object({
      email: z.string().describe("The caller's email address as spoken"),
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
            `Email saved as ${normalized}. Repeat it back briefly and ask if that's right — ` +
            "then call confirm_email_address when they agree."
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
          const draft = session.userData.draftEmail?.trim();
          if (!draft) {
            throw new llm.ToolError("No email recorded yet — call update_email_address first.");
          }
          session.userData.confirmedEmail = draft;
          session.userData.draftEmail = undefined;
          return (
            `Email confirmed as ${draft}. ` +
            "If you have a slot_id ready, call schedule_appointment now — do not re-ask for email."
          );
        },
      );
    },
  });

  return { updateEmailAddress, confirmEmailAddress };
}
