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
        "You are collecting the caller's email address for appointment confirmation. " +
        "You are on a live phone call — speak naturally. " +
        "Expect spoken formats like 'john dot doe at gmail dot com'. " +
        "Call update_email_address with the normalized email, then confirm_email_address after they say yes.",
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
          "Repeat it back if needed and ask the caller to confirm before calling confirm_email_address."
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
        this.complete({ emailAddress: this.currentEmail });
        return "Email confirmed.";
      },
    });
  }

  async onEnter(): Promise<void> {
    await this.updateTools([this.buildUpdateTool()]);
    await this.session.generateReply({
      instructions: "Ask the caller for the email address to send their appointment confirmation to.",
    });
  }
}
