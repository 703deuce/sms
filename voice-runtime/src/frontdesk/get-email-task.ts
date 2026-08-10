import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
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
        // Voice
        "You are on a live phone call — speak naturally. Expect spoken formats like " +
        "'john dot doe at gmail dot com'. " +
        // How to work
        "Commitment rule: if you say you will save or confirm the email, call the matching " +
        "tool in the same turn — never leave the caller waiting. Ask for one thing at a time. " +
        // System constraints
        "A confirmation text to their phone is sent automatically after booking — do not ask " +
        "for their phone number or offer to send texts or emails yourself. " +
        "Never say the appointment is booked or confirmed — only collect email. " +
        "After confirm_email_address, do not add any closing line. " +
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
    });
  }

  private buildConfirmTool() {
    return llm.tool({
      name: "confirm_email_address",
      description: "Call after the caller confirms their email is correct.",
      parameters: z.object({}),
      execute: async () => {
        if (!this.currentEmail) {
          throw new llm.ToolError("No email recorded yet.");
        }
        const email = this.currentEmail;
        this.complete({ emailAddress: email });
        return "Email confirmed. Do not mention booking — remain silent.";
      },
    });
  }

  async onEnter(): Promise<void> {
    await this.updateTools([this.buildUpdateTool()]);
    await this.session.generateReply({
      instructions: "Ask for the email address to put on the calendar booking. Keep it brief — one question only.",
    });
  }
}
