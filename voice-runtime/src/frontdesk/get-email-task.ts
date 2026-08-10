import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { safeInterruptSession } from "../session-utils";
import type { FrontDeskUserData } from "./userdata";

const EMAIL_RE =
  /^[A-Za-z0-9][A-Za-z0-9._%+-]*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export type GetEmailResult = {
  emailAddress: string;
};

function normalizeSpokenEmail(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/\s+at\s+/g, "@");
  value = value.replace(/\s+dot\s+/g, ".");
  value = value.replace(/\s+/g, "");
  return value;
}

export class GetEmailTask extends voice.AgentTask<GetEmailResult> {
  private currentEmail = "";

  constructor(private readonly sessionRef: AgentSession<FrontDeskUserData>) {
    super({
      instructions:
        // Outcome
        "You are collecting the caller's email address because Calendly requires one to book. " +
        // Voice — this is a phone agent, not chat or email.
        "You are on a LIVE PHONE CALL. Your output is spoken aloud via text-to-speech — never " +
        "chat, typing, or written instructions. The caller SPEAKS their email; you hear it via " +
        "speech-to-text. Expect spoken formats like 'john dot doe at gmail dot com'. " +
        "Ask them to SAY their email out loud. Never ask them to read, type, paste, text, " +
        "write, or email it to you. " +
        // How to work
        "Commitment rule: if you say you will save or confirm the email, call the matching " +
        "tool in the same turn — never leave the caller waiting. Ask for one thing at a time. " +
        // System constraints
        "A confirmation text to their phone is sent automatically after booking — do not ask " +
        "for their phone number or offer to send texts or emails yourself. " +
        "Never say the appointment is booked, confirmed, or that they are all set — only collect email. " +
        "After confirm_email_address succeeds, produce NO spoken reply — stay completely silent. " +
        "Call update_email_address with the normalized email, then confirm_email_address as " +
        "soon as they agree.",
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
            if (!EMAIL_RE.test(normalized)) {
              throw new llm.ToolError(`Invalid email address: ${email}`);
            }
            this.currentEmail = normalized;
            await this.updateTools([this.buildUpdateTool(), this.buildConfirmTool()]);
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
            // Stop any follow-up TTS from this sub-agent before handing off to booking.
            await safeInterruptSession(this.session);
            this.complete({ emailAddress: email });
            return "Email confirmed. Produce no further speech.";
          },
        );
      },
    });
  }

  async onEnter(): Promise<void> {
    await this.updateTools([this.buildUpdateTool()]);
    await this.session.generateReply({
      instructions:
        "Ask them to SAY their email address out loud for the calendar booking — e.g. " +
        "'What's the email I should put on the invite?' Never ask them to read, type, or text it. " +
        "One brief question only.",
    });
  }
}
