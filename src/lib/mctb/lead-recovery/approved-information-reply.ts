import "server-only";

import type { MctbApprovedBusinessInformation } from "@/lib/mctb/approved-business-information";
import { loadMctbApprovedBusinessInformation } from "@/lib/mctb/approved-business-information";
import { mctbSemanticStructuredJson } from "@/lib/mctb/semantic-llm";
import type {
  LeadRecoveryIntent,
  LeadRecoveryWorkspaceConfig,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";

export type ApprovedInformationReplyResult = {
  reply: string;
  grounded: boolean;
  source: "deterministic" | "llm" | "fallback";
};

const APPROVED_INFO_SYSTEM = `You answer SMS for a business using ONLY the provided approved_business_information JSON.
Rules:
- If the customer's question cannot be answered from that data, set grounded=false and reply with a brief safe fallback (do not guess).
- Never invent services, hours, locations, prices, or policies.
- Never use general world knowledge for business-specific questions.
- Keep replies concise (under 320 characters), plain text, no markdown.
Return JSON: { "grounded": boolean, "reply": string }`;

function faqFallbackMessage(config: LeadRecoveryWorkspaceConfig): string {
  switch (config.faqPolicy?.fallback) {
    case "handoff":
      return "I'll have someone from our team follow up with that detail shortly.";
    case "notify":
      return "Thanks — I'll pass that to our team and they'll get back to you.";
    default:
      return "I don't have that detail in our records — what were you calling about?";
  }
}

function intentMatchesFaqTopics(
  intent: LeadRecoveryIntent,
  config: LeadRecoveryWorkspaceConfig,
): boolean {
  const topics = config.faqPolicy?.topics || [];
  const map: Partial<Record<LeadRecoveryIntent, string>> = {
    BUSINESS_HOURS: "HOURS",
    BUSINESS_FAQ: "FAQ",
    SERVICE_AREA_CHECK: "SERVICE_AREA",
    BUSINESS_LOCATION: "LOCATIONS",
  };
  const topic = map[intent];
  if (!topic) return false;
  return topics.includes(topic as (typeof topics)[number]);
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function deterministicApprovedReply(input: {
  customerMessage: string;
  intent: LeadRecoveryIntent;
  approved: MctbApprovedBusinessInformation;
}): ApprovedInformationReplyResult | null {
  const msg = normalize(input.customerMessage);

  if (
    input.intent === "BUSINESS_HOURS" &&
    input.approved.business_hours &&
    /(hour|open|close|closing|time)/.test(msg)
  ) {
    return {
      reply: `Our hours: ${input.approved.business_hours}`,
      grounded: true,
      source: "deterministic",
    };
  }

  if (
    (input.intent === "BUSINESS_FAQ" || input.intent === "SERVICE_AREA_CHECK") &&
    input.approved.services.length
  ) {
    const matched = input.approved.services.find((s) => {
      const tokens = normalize(s).split(/\s+/).filter((t) => t.length > 3);
      return tokens.some((t) => msg.includes(t));
    });
    if (matched) {
      return {
        reply: `Yes — we offer ${matched}.`,
        grounded: true,
        source: "deterministic",
      };
    }
  }

  for (const fact of input.approved.knowledge_facts) {
    const label = normalize(fact.label);
    const labelTokens = label.split(/\s+/).filter((t) => t.length > 3);
    if (labelTokens.some((t) => msg.includes(t))) {
      return {
        reply: fact.summary.length > 300 ? `${fact.summary.slice(0, 297)}...` : fact.summary,
        grounded: true,
        source: "deterministic",
      };
    }
  }

  if (input.intent === "SERVICE_AREA_CHECK") {
    const areaFact = input.approved.knowledge_facts.find((f) =>
      /service area|coverage|area/i.test(f.label),
    );
    if (areaFact) {
      return { reply: areaFact.summary, grounded: true, source: "deterministic" };
    }
  }

  return null;
}

export async function generateApprovedInformationSmsReply(input: {
  workspaceId: string;
  customerMessage: string;
  structuredIntent: StructuredLeadIntent;
  config: LeadRecoveryWorkspaceConfig;
  approved?: MctbApprovedBusinessInformation;
}): Promise<ApprovedInformationReplyResult> {
  const intent = input.structuredIntent.primary_intent;
  if (!intentMatchesFaqTopics(intent, input.config)) {
    return {
      reply: faqFallbackMessage(input.config),
      grounded: false,
      source: "fallback",
    };
  }

  const approved =
    input.approved ?? (await loadMctbApprovedBusinessInformation(input.workspaceId));

  const { loadMctbLeadRecoveryKnowledgeBundle } = await import(
    "@/lib/mctb/lead-recovery/knowledge-prompt"
  );
  const knowledgeBundle = await loadMctbLeadRecoveryKnowledgeBundle(input.workspaceId);
  const runtimeBlock = knowledgeBundle.runtime_prompt_block;

  if (!runtimeBlock.trim()) {
    return {
      reply: faqFallbackMessage(input.config),
      grounded: false,
      source: "fallback",
    };
  }

  const deterministic = deterministicApprovedReply({
    customerMessage: input.customerMessage,
    intent,
    approved,
  });
  if (deterministic) return deterministic;

  if (process.env.MCTB_LR_FAQ_SKIP_LLM === "1") {
    return {
      reply: faqFallbackMessage(input.config),
      grounded: false,
      source: "fallback",
    };
  }

  const llm = await mctbSemanticStructuredJson<{ grounded: boolean; reply: string }>({
    system: APPROVED_INFO_SYSTEM,
    user: JSON.stringify({
      approved_business_information: runtimeBlock,
      customer_message: input.customerMessage,
      primary_intent: intent,
    }),
    temperature: 0.1,
    maxTokens: 220,
  });

  if (llm?.data?.grounded === true && llm.data.reply?.trim()) {
    return {
      reply: llm.data.reply.trim(),
      grounded: true,
      source: "llm",
    };
  }

  return {
    reply: faqFallbackMessage(input.config),
    grounded: false,
    source: "fallback",
  };
}

/** @internal test hook — pure deterministic + fallback without DB/LLM */
export function resolveApprovedInformationReplyForTest(input: {
  customerMessage: string;
  intent: LeadRecoveryIntent;
  config: LeadRecoveryWorkspaceConfig;
  approved: MctbApprovedBusinessInformation;
}): ApprovedInformationReplyResult {
  if (!intentMatchesFaqTopics(input.intent, input.config)) {
    return {
      reply: faqFallbackMessage(input.config),
      grounded: false,
      source: "fallback",
    };
  }
  const deterministic = deterministicApprovedReply({
    customerMessage: input.customerMessage,
    intent: input.intent,
    approved: input.approved,
  });
  if (deterministic) return deterministic;
  return {
    reply: faqFallbackMessage(input.config),
    grounded: false,
    source: "fallback",
  };
}
