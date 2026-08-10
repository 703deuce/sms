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
import {
  buildQualificationTaskInstructions,
  fieldIdsToSkipAsking,
  resolveOutboundCallMission,
  type OutboundCallMission,
} from "@/lib/voice/outbound/compile-outbound-call-context";
import type { LeadQualificationResult, QualificationBusinessOutcome } from "@/lib/voice/outbound/types";
import { persistLeadQualificationResult } from "@/lib/voice/outbound/outbound-call-service";
import { buildBusinessAnswerTool } from "../shared/business-answer-tool";
import type { OutboundLeadUserData } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import {
  beginOutboundCallClosing,
  endCallToolMessage,
  endOutboundCall,
  isOutboundCallClosing,
} from "./end-outbound-call";
import { deliverOutboundOpening } from "./deliver-outbound-opening";

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
  private readonly mission: OutboundCallMission;

  constructor(
    private readonly sessionRef: AgentSession<OutboundLeadUserData>,
    options?: { chatCtx?: ChatContext },
  ) {
    const mission = resolveOutboundCallMission({
      qualification: sessionRef.userData.qualification,
      lead: sessionRef.userData.job.lead,
    });
    super({
      chatCtx: options?.chatCtx,
      preserveFunctionCallHistory: true,
      instructions: buildQualificationTaskInstructions(mission),
      tools: [],
    });
    this.mission = mission;
  }

  private missingFieldsForPrompt(collected: Record<string, string>): string[] {
    const skip = fieldIdsToSkipAsking(this.mission);
    return missingRequiredFields(this.mission.qualification, collected).filter((id) => !skip.has(id));
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
            if (isOutboundCallClosing(ud)) {
              return "Call is ending. Do not collect more fields or speak — call end_call if you have not already.";
            }
            ud.collectedFields = mergeQualificationFields(ud.collectedFields, fields);
            if (still_interested === false) {
              ud.interested = false;
            }
            const missing = this.missingFieldsForPrompt(ud.collectedFields);
            if (!missing.length && ud.interested) {
              return "All required fields captured. Say one brief transition, then call set_qualification_outcome with complete.";
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
        if (ud.qualificationComplete) {
          return (
            "Outcome already saved. If the call is not over yet, say one brief goodbye and call end_call exactly once. " +
            "Otherwise remain completely silent."
          );
        }
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
        beginOutboundCallClosing(ud);

        await persistLeadQualificationResult({
          callId: ud.callId,
          workspaceId: ud.workspaceId,
          result,
          telephonyOutcome: "ANSWERED",
        });

        if (mapped === "WRONG_NUMBER" || mapped === "NOT_INTERESTED") {
          return "Outcome saved. Apologize once briefly, then call end_call exactly once. Do not summarize the call.";
        }
        return (
          "Outcome saved. Say one brief goodbye similar to: " +
          `"${this.mission.closeLine}" ` +
          "Then call end_call exactly once. Do not repeat goodbye, recap fields, or summarize the conversation."
        );
      },
    });
  }

  private buildEndCallTool() {
    return llm.tool({
      name: "end_call",
      description: "End the call after qualification is complete or the caller is done.",
      parameters: z.object({
        reason: z.string().optional(),
      }),
      execute: async ({ reason }) => {
        const result = await endOutboundCall(this.sessionRef, {
          source: "end_call_tool",
          reason: reason || undefined,
        });
        return endCallToolMessage(result);
      },
    });
  }

  async onEnter(): Promise<void> {
    await this.updateTools([
      this.buildRecordFieldsTool(),
      this.buildOutcomeTool(),
      buildBusinessAnswerTool(this.sessionRef),
      this.buildEndCallTool(),
    ]);

    await deliverOutboundOpening(this.sessionRef);
  }
}
