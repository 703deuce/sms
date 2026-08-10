import { llm, voice, type ChatContext } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import {
  evaluateQualificationOutcome,
  buildQualificationSummary,
  mergeQualificationFields,
  missingRequiredFields,
  nextActionForOutcome,
} from "@/lib/voice/outbound/qualification-evaluator";
import type { LeadQualificationResult, QualificationBusinessOutcome } from "@/lib/voice/outbound/types";
import { persistLeadQualificationResult } from "@/lib/voice/outbound/outbound-call-service";
import { buildBusinessAnswerTool } from "../shared/business-answer-tool";
import type { OutboundLeadUserData } from "./userdata";
import { buildOutboundIntroLine } from "./outbound-messages";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";

export type QualifyLeadResult = LeadQualificationResult;

const OUTCOME_VALUES = [
  "complete",
  "wrong_number",
  "not_interested",
  "callback_requested",
] as const;

function mapToolOutcome(
  value: (typeof OUTCOME_VALUES)[number],
): QualificationBusinessOutcome | "complete" {
  switch (value) {
    case "wrong_number":
      return "WRONG_NUMBER";
    case "not_interested":
      return "NOT_INTERESTED";
    case "callback_requested":
      return "CALLBACK_REQUESTED";
    default:
      return "complete";
  }
}

export class QualifyLeadTask extends voice.AgentTask<QualifyLeadResult> {
  constructor(
    private readonly sessionRef: AgentSession<OutboundLeadUserData>,
    options?: { chatCtx?: ChatContext },
  ) {
    super({
      chatCtx: options?.chatCtx,
      preserveFunctionCallHistory: true,
      instructions: [
        "You are qualifying a warm lead on a LIVE OUTBOUND phone call. ",
        "The caller already requested information — you are following up, not cold calling. ",
        "Speak naturally in short sentences. Do not read a rigid survey. ",
        "When the caller provides information, call record_qualification_fields with every field you understood — ",
        "they may answer several questions in one sentence. ",
        "Never re-ask for fields already captured unless they correct something. ",
        "If they correct a value, call record_qualification_fields again with the updated field only. ",
        "Use get_business_answer for simple business questions, then return to qualification. ",
        "Do NOT book appointments or promise specific follow-up times. ",
        "When intake is complete or the caller is done, call set_qualification_outcome with complete, ",
        "wrong_number, not_interested, or callback_requested as appropriate.",
      ].join(""),
      tools: [],
    });
  }

  private buildRecordFieldsTool() {
    return llm.tool({
      name: "record_qualification_fields",
      description:
        "Save one or more qualification fields the caller provided. Pass all fields understood from their last utterance.",
      parameters: z.object({
        fields: z
          .record(z.string(), z.string())
          .describe("Map of field_id to value, e.g. name, target_location, price_range_or_budget"),
        still_interested: z
          .boolean()
          .optional()
          .describe("False only if caller clearly said they are not interested"),
      }),
      execute: async ({ fields, still_interested }) => {
        const ud = this.sessionRef.userData;
        return withLiveKitToolTelemetry(ud, "record_qualification_fields", { fieldIds: Object.keys(fields) }, async () => {
            ud.collectedFields = mergeQualificationFields(ud.collectedFields, fields);
            if (still_interested === false) {
              ud.interested = false;
            }
            const missing = missingRequiredFields(ud.qualification, ud.collectedFields);
            if (!missing.length && ud.interested) {
              return "All required fields captured. Wrap up naturally and call set_qualification_outcome with complete.";
            }
            if (missing.length) {
              return `Saved. Still need: ${missing.join(", ")}. Ask naturally for the next missing item only.`;
            }
            return "Saved.";
          },
        );
      },
    });
  }

  private buildOutcomeTool() {
    return llm.tool({
      name: "set_qualification_outcome",
      description: "Finalize the call outcome when qualification is done or cannot continue.",
      parameters: z.object({
        outcome: z.enum(OUTCOME_VALUES),
        callback_notes: z.string().optional(),
      }),
      execute: async ({ outcome, callback_notes }) => {
        const ud = this.sessionRef.userData;
        const mapped = mapToolOutcome(outcome);
        if (mapped !== "complete") {
          ud.explicitOutcome = mapped;
        }
        if (callback_notes?.trim()) {
          ud.collectedFields = mergeQualificationFields(ud.collectedFields, {
            callback_notes: callback_notes.trim(),
          });
        }

        const businessOutcome = evaluateQualificationOutcome({
          definition: ud.qualification,
          collectedFields: ud.collectedFields,
          explicitOutcome: ud.explicitOutcome,
          interested: ud.interested,
        });

        const result: LeadQualificationResult = {
          leadId: ud.job.lead.leadId || null,
          contactId: ud.job.lead.contactId || null,
          outcome: businessOutcome,
          telephonyOutcome: "ANSWERED",
          collectedFields: { ...ud.collectedFields },
          summary: buildQualificationSummary({
            collectedFields: ud.collectedFields,
            businessName: ud.businessName,
            outcome: businessOutcome,
          }),
          nextAction: nextActionForOutcome(businessOutcome),
          completedAt: new Date().toISOString(),
        };

        ud.qualificationComplete = true;
        ud.result = result;

        await persistLeadQualificationResult({
          callId: ud.callId,
          workspaceId: ud.workspaceId,
          result,
          telephonyOutcome: "ANSWERED",
        });

        if (!this.done) {
          this.complete(result);
        }

        if (mapped === "WRONG_NUMBER" || mapped === "NOT_INTERESTED") {
          return "Outcome saved. Apologize briefly and end the call.";
        }
        return "Outcome saved. Give a brief closing line, then the call may end.";
      },
    });
  }

  async onEnter(): Promise<void> {
    const ud = this.sessionRef.userData;
    await this.updateTools([
      this.buildRecordFieldsTool(),
      this.buildOutcomeTool(),
      buildBusinessAnswerTool(this.sessionRef),
    ]);

    const intro = buildOutboundIntroLine(ud.qualification, ud.job.lead.leadName);
    await this.session.generateReply({
      instructions:
        `Say exactly this outbound opener (adapt name pronunciation only): "${intro}" ` +
        "Then listen — if they confirm identity, ask one open question about what they're looking for. " +
        "Do not ask how you can help them; you called them.",
      toolChoice: "none",
      allowInterruptions: true,
    });
  }
}
