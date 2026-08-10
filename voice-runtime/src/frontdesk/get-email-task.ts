import type { ChatContext } from "@livekit/agents";
import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { isValidEmail, normalizeSpokenEmail } from "./email-utils";
import type { FrontDeskUserData } from "./userdata";

export type GetEmailResult = {
  emailAddress: string;
};

/**
 * Focused email-collection sub-task — mirrors LiveKit frontdesk GetEmailTask pattern.
 *
 * Must run inside schedule_appointment (inline AgentTask). Pass the parent agent's
 * chatCtx so tool-call history merges without orphaning the parent schedule_appointment call.
 */
export class GetEmailTask extends voice.AgentTask<GetEmailResult> {
  private currentEmail = "";

  constructor(
    private readonly sessionRef: AgentSession<FrontDeskUserData>,
    options?: { chatCtx?: ChatContext },
  ) {
    super({
      chatCtx: options?.chatCtx,
      preserveFunctionCallHistory: true,
      instructions:
        "You are collecting the caller's email address because Calendly requires one to book. " +
        "You are on a LIVE PHONE CALL — output is spoken aloud. The caller SPEAKS their email; " +
        "expect formats like 'john dot doe at gmail dot com'. Ask them to SAY their email out loud. " +
        "Never ask them to type, paste, text, or read instructions. " +
        "Call update_email_address with the normalized email, then confirm_email_address when they agree. " +
        "Never say the appointment is booked — only collect and confirm email. " +
        "After confirm_email_address succeeds, produce NO spoken reply.",
      tools: [],
    });
  }

  private buildUpdateTool() {
    return llm.tool({
      name: "update_email_address",
      description: "Record the email address the caller provided.",
      parameters: z.object({
        email: z.string().describe("The caller's email address"),
      }),
      execute: async ({ email }) => {
        return withLiveKitToolTelemetry(
          this.sessionRef.userData,
          "update_email_address",
          { email },
          async () => {
            const normalized = normalizeSpokenEmail(email);
            if (!isValidEmail(normalized)) {
              throw new llm.ToolError(`Invalid email address: ${email}`);
            }
            this.currentEmail = normalized;
            await this.updateTools([
              this.buildUpdateTool(),
              this.buildConfirmTool(),
              this.buildDeclineTool(),
            ]);
            return (
              `Email updated to ${normalized}. ` +
              "Repeat it back briefly and ask if that's right — then call confirm_email_address when they agree."
            );
          },
        );
      },
    });
  }

  private buildConfirmTool() {
    return llm.tool({
      name: "confirm_email_address",
      description: "Call after the caller confirms their email is correct.",
      parameters: z.object({}),
      execute: async () => {
        return withLiveKitToolTelemetry(
          this.sessionRef.userData,
          "confirm_email_address",
          {},
          async () => {
            if (!this.currentEmail) {
              throw new llm.ToolError("No email recorded yet.");
            }
            const email = this.currentEmail;
            this.sessionRef.userData.confirmedEmail = email;
            this.sessionRef.userData.draftEmail = undefined;
            if (!this.done) {
              this.complete({ emailAddress: email });
            }
            return "Email confirmed. Produce no further speech.";
          },
        );
      },
    });
  }

  private buildDeclineTool() {
    return llm.tool({
      name: "decline_email_capture",
      description:
        "Call when the caller explicitly refuses to provide an email address.",
      parameters: z.object({
        reason: z.string().describe("Brief reason the caller declined"),
      }),
      execute: async ({ reason }) => {
        return withLiveKitToolTelemetry(
          this.sessionRef.userData,
          "decline_email_capture",
          { reason },
          async () => {
            if (!this.done) {
              this.complete(new llm.ToolError(`couldn't get the email address: ${reason}`));
            }
            return "Email capture declined.";
          },
        );
      },
    });
  }

  async onEnter(): Promise<void> {
    const existing = this.sessionRef.userData.confirmedEmail?.trim();
    if (existing) {
      if (!this.done) {
        this.complete({ emailAddress: existing });
      }
      return;
    }

    await this.updateTools([this.buildUpdateTool(), this.buildDeclineTool()]);
    await this.session.generateReply({
      instructions:
        "Ask them to SAY their email address out loud for the calendar booking — e.g. " +
        "'What's the email I should put on the invite?' One brief question only.",
    });
  }
}
