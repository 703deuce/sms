/**
 * Legacy module hook — canonical rules live in src/lib/voice/prompt/base-voice-rules.ts
 * and are composed by compileVoiceAgentPrompt().
 */
import {
  TRANSOVO_BASE_VOICE_RULES,
  buildIdentitySection,
} from "@/lib/voice/prompt/base-voice-rules";
import { KNOWLEDGE_HIERARCHY_RULES } from "@/lib/voice/prompt/knowledge-classification";

export const CALLER_AMY_CONSTITUTION = `${buildIdentitySection({
  agentName: "Amy",
  businessName: "{{business_name}}",
  profile: "appointment_receptionist",
})}

${KNOWLEDGE_HIERARCHY_RULES}

${TRANSOVO_BASE_VOICE_RULES}`;

export function compileCallerConstitution(businessName: string): string {
  return CALLER_AMY_CONSTITUTION.replaceAll("{{business_name}}", businessName || "the business");
}
