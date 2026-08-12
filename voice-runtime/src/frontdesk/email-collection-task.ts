import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { isValidEmail, normalizeSpokenEmail } from "./email-utils";
import type { FrontDeskUserData } from "./userdata";
import { agentTaskSuperOptions, nestedTaskOptionsFromSession } from "../tasks/task-context";
import { POST_EMAIL_BOOKING_FILLER } from "../booking-completion-messages";
import { speakBeforeTaskHandoff } from "../task-async-work-bridge";
import { deliverScriptedSpeech } from "../outbound/scripted-speech";
import {
  markFirstReplyRequested,
  markTaskExitFinished,
  markTaskExitStarted,
  markTaskOnEnterStarted,
} from "../task-transition-instrumentation";

export type EmailCollectionResult = {
  email: string;
  declined: boolean;
};

/**
 * Bounded AgentTask for Calendly booking email — replaces flat update/confirm tools.
 */
export class EmailCollectionTask extends voice.AgentTask<EmailCollectionResult> {
  constructor(
    private readonly sessionRef: AgentSession<FrontDeskUserData>,
    taskContext?: ReturnType<typeof nestedTaskOptionsFromSession>,
  ) {
    super(
      agentTaskSuperOptions(
        {
          instructions:
            "Collect the caller's email for their calendar invite. " +
            "Ask them to say it out loud, repeat it back, and confirm. " +
            "Use record_email when they confirm, or decline_email if they refuse.",
          tools: [
            llm.tool({
              name: "record_email",
              description: "Save the confirmed email address.",
              parameters: z.object({
                email: z.string().describe("Confirmed email address"),
              }),
              execute: async ({ email }) => {
                const normalized = normalizeSpokenEmail(email);
                if (!isValidEmail(normalized)) {
                  throw new llm.ToolError(`Invalid email: ${email}`);
                }
                this.sessionRef.userData.confirmedEmail = normalized;
                this.sessionRef.userData.draftEmail = undefined;
                markTaskExitStarted({
                  callId: this.sessionRef.userData.callId,
                  taskId: "email_collection",
                  taskType: "EmailCollectionTask",
                });
                await speakBeforeTaskHandoff(this.sessionRef, POST_EMAIL_BOOKING_FILLER);
                this.complete({ email: normalized, declined: false });
                markTaskExitFinished({
                  callId: this.sessionRef.userData.callId,
                  taskId: "email_collection",
                  taskType: "EmailCollectionTask",
                });
                return (
                  "Email saved. Calendar booking is in progress — do not speak or add filler."
                );
              },
            }),
            llm.tool({
              name: "decline_email",
              description: "Caller refuses to provide email.",
              parameters: z.object({
                reason: z.string().describe("Why they declined"),
              }),
              execute: async ({ reason }) => {
                this.sessionRef.userData.draftEmail = undefined;
                this.complete({ email: "", declined: true });
                return `Caller declined email (${reason}).`;
              },
            }),
          ],
        },
        taskContext ?? nestedTaskOptionsFromSession(sessionRef),
      ),
    );
  }

  async onEnter(): Promise<void> {
    const ud = this.sessionRef.userData;
    markTaskOnEnterStarted({
      callId: ud.callId,
      taskId: "email_collection",
      taskType: "EmailCollectionTask",
    });
    ud.activeTaskInstrumentation = {
      taskId: "email_collection",
      taskType: "EmailCollectionTask",
    };
    markFirstReplyRequested({
      callId: ud.callId,
      taskId: "email_collection",
      taskType: "EmailCollectionTask",
    });

    await deliverScriptedSpeech(this.sessionRef, EMAIL_COLLECTION_PROMPT, {
      allowInterruptions: true,
      addToChatCtx: true,
    });
  }
}

const EMAIL_COLLECTION_PROMPT =
  "What's the best email for your calendar invite? Please say it out loud.";

export async function runEmailCollectionTask(
  session: AgentSession<FrontDeskUserData>,
): Promise<EmailCollectionResult> {
  const task = new EmailCollectionTask(session);
  return await task.run();
}
