import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { ReceptionistWizardState } from "./types";
import { interpolateGreeting } from "./defaults";

const ANSWER_WHEN_MAP: Record<
  ReceptionistWizardState["answerTiming"],
  string
> = {
  every_call: "every_call",
  after_hours: "after_hours",
  nobody_answers: "nobody_answers",
  overflow: "overflow",
};

export function wizardStateToDraftConfig(
  state: ReceptionistWizardState,
): VoiceAgentConfig {
  const greeting = interpolateGreeting(state);
  const caps = new Set(state.capabilities);

  const goals: string[] = [];
  if (caps.has("answer_questions")) goals.push("Answer caller questions from business knowledge.");
  if (caps.has("take_messages")) goals.push("Take messages when the team is unavailable.");
  if (caps.has("collect_info")) goals.push("Collect caller information during the conversation.");
  if (caps.has("book_appointments")) goals.push("Book appointments when requested.");
  if (caps.has("transfer_calls")) goals.push("Transfer calls when appropriate.");
  if (caps.has("send_text")) goals.push("Send SMS follow-ups when appropriate.");

  const requiredQuestions: string[] = [];
  if (state.collectFields.includes("name")) requiredQuestions.push("Full name");
  if (state.collectFields.includes("phone")) requiredQuestions.push("Phone number");
  if (state.collectFields.includes("reason")) requiredQuestions.push("Reason for calling");
  if (state.collectFields.includes("email")) requiredQuestions.push("Email");
  if (state.collectFields.includes("address")) requiredQuestions.push("Service address");

  const enabledBuiltinTools: string[] = [];
  if (caps.has("take_messages")) enabledBuiltinTools.push("take_message");
  if (caps.has("book_appointments")) enabledBuiltinTools.push("book_appointment");
  if (caps.has("transfer_calls")) enabledBuiltinTools.push("transfer_call");
  if (caps.has("send_text")) enabledBuiltinTools.push("send_sms");

  return {
    identity: {
      displayName: state.agentName.trim() || "Amy",
      directions: ["inbound"],
    },
    instructions: {
      role: `AI receptionist for ${state.businessName.trim() || "the business"}`,
      system: state.businessDescription.trim() || undefined,
      goals: goals.join("\n"),
      requiredQuestions,
      tone: "friendly",
      style: "professional",
      responseLength: "balanced",
    },
    callHandling: {
      startupGreeting: {
        enabled: true,
        text: greeting,
      },
    },
    voiceLanguage: {
      voiceId: state.voiceId,
      primaryLanguage: state.language,
      speed: 1,
    },
    inboundRules: {
      answerWhen: ANSWER_WHEN_MAP[state.answerTiming],
    },
    enabledBuiltinTools,
    advanced: {
      receptionistWizard: {
        capabilities: state.capabilities,
        collectFields: state.collectFields,
        answerTiming: state.answerTiming,
        businessDescription: state.businessDescription,
        businessName: state.businessName,
        agentName: state.agentName,
        voiceLabel: state.voiceLabel,
      },
    },
  };
}
