import { getPrisma } from "@/lib/db";
import { loadBusinessBrain } from "@/lib/agents/appointment-booking/business-brain";
import { loadVoiceAgentRuntimeConfigRecord } from "@/lib/voice/load-agent-config";
import { searchKnowledge } from "@/lib/voice/knowledge-processor";
import {
  isHoursTopic,
  isPricingTopic,
  isServiceAreaTopic,
  isServicesTopic,
} from "@/lib/voice/knowledge/business-answer-topics";

export type BusinessAnswerResult =
  | { ok: true; speak: string; data: Record<string, unknown> }
  | { ok: false; speak: string; code: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function topicMatches(text: string, topic: string): boolean {
  const hay = text.toLowerCase();
  const needles = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  if (!needles.length) return hay.includes(topic.toLowerCase());
  return needles.some((n) => hay.includes(n));
}

function synthesizeRagSnippets(
  hits: Array<{ name: string; snippet: string; provider?: string }>,
): string | null {
  if (!hits.length) return null;
  const parts = hits
    .slice(0, 3)
    .map((h) => h.snippet.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  return parts.join(" ");
}

function resolveStructuredPricing(
  pricing: Record<string, unknown>,
  knowledge: Record<string, unknown>,
): BusinessAnswerResult | null {
  const serviceCallFee =
    pricing.serviceCallFee || pricing.diagnosticFee || pricing.defaultServiceCall;
  const packages = asRecord(knowledge.packages || pricing.packages);
  const packageLines = Object.entries(packages)
    .filter(([, v]) => v)
    .map(([name, detail]) => `${name}: ${String(detail)}`);
  if (packageLines.length) {
    return {
      ok: true,
      speak: packageLines.join(". ") + ".",
      data: { topic: "pricing", packages: packageLines },
    };
  }
  if (serviceCallFee) {
    return {
      ok: true,
      speak: String(pricing.serviceCallScript || `Our service call fee is ${serviceCallFee}.`),
      data: { topic: "pricing", serviceCallFee },
    };
  }
  return null;
}

function readReceptionistWizardContext(advanced: Record<string, unknown>): {
  businessDescription: string;
  businessName: string;
} {
  const compiled = asRecord(advanced.receptionistCompiled);
  const wizard = asRecord(advanced.receptionistWizard);
  return {
    businessDescription: String(
      compiled.businessDescription || wizard.businessDescription || "",
    ).trim(),
    businessName: String(compiled.businessName || wizard.businessName || "").trim(),
  };
}

function extractHoursFromDescription(description: string): string | null {
  const hoursMatch = description.match(
    /(?:regular\s+)?hours?\s*(?:are\s+)?([^.]+(?:\d\s*(?:am|pm)|Monday|weekday)[^.]*)/i,
  );
  if (hoursMatch?.[1]) return hoursMatch[1].trim();

  const weekdayMatch = description.match(
    /(Monday[^.]*(?:\d\s*(?:am|pm)|through|to)[^.]*)/i,
  );
  if (weekdayMatch?.[1]) return weekdayMatch[1].trim();

  return null;
}

function extractPricingFromDescription(description: string): string | null {
  const matches = description.match(/\$[\d,]+[^.]*(?:\.|;|$)/gi);
  if (!matches?.length) return null;
  return matches.map((m) => m.trim().replace(/[.;]+$/, "")).join(". ") + ".";
}

function resolveFromGenericReceptionist(
  topicLower: string,
  topic: string,
  advanced: Record<string, unknown>,
): BusinessAnswerResult | null {
  const { businessDescription } = readReceptionistWizardContext(advanced);
  if (!businessDescription) return null;

  if (isHoursTopic(topicLower)) {
    const hours = extractHoursFromDescription(businessDescription);
    if (hours) {
      return {
        ok: true,
        speak: `Our hours are ${hours}.`,
        data: { topic: "hours", hours, source: "receptionist_wizard" },
      };
    }
  }

  if (isPricingTopic(topicLower)) {
    const pricing = extractPricingFromDescription(businessDescription);
    if (pricing) {
      return {
        ok: true,
        speak: pricing,
        data: { topic: "pricing", source: "receptionist_wizard" },
      };
    }
  }

  if (isServicesTopic(topicLower)) {
    const firstSentence = businessDescription.split(/[.!?]/)[0]?.trim();
    if (firstSentence) {
      return {
        ok: true,
        speak: `${firstSentence}.`,
        data: { topic: "services", source: "receptionist_wizard" },
      };
    }
  }

  if (topicMatches(businessDescription, topic)) {
    return {
      ok: true,
      speak: businessDescription,
      data: { topic, source: "receptionist_wizard" },
    };
  }

  return null;
}

async function linkedKnowledgeBaseIds(workspaceId: string, agentId: string): Promise<string[]> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: { draftConfig: true },
  });
  const cfg = asRecord(agent?.draftConfig);
  const fromConfig = Array.isArray(cfg.knowledgeBaseIds)
    ? cfg.knowledgeBaseIds.map(String).filter(Boolean)
    : [];
  if (fromConfig.length) return [...new Set(fromConfig)];

  const links = await prisma.voiceAgentKnowledgeBase.findMany({
    where: { workspaceId, agentId },
    select: { knowledgeBaseId: true },
  });
  return links.map((l: { knowledgeBaseId: string }) => l.knowledgeBaseId);
}

async function searchRagAnswer(
  workspaceId: string,
  kbIds: string[],
  topic: string,
): Promise<BusinessAnswerResult | null> {
  const ragHits: Array<{ name: string; snippet: string; provider?: string }> = [];
  for (const kbId of kbIds) {
    const hits = await searchKnowledge(workspaceId, kbId, topic);
    for (const hit of hits) {
      ragHits.push({
        name: hit.name,
        snippet: hit.snippet,
        provider: hit.provider,
      });
    }
  }
  const ragSpeak = synthesizeRagSnippets(ragHits);
  if (!ragSpeak) return null;
  return {
    ok: true,
    speak: ragSpeak,
    data: {
      topic,
      source: "rag",
      hitCount: ragHits.length,
      providers: [...new Set(ragHits.map((h) => h.provider).filter(Boolean))],
    },
  };
}

export async function resolveBusinessAnswer(input: {
  workspaceId: string;
  agentId: string;
  topic: string;
}): Promise<BusinessAnswerResult> {
  const topic = input.topic.trim();
  const topicLower = topic.toLowerCase();

  const config = await loadVoiceAgentRuntimeConfigRecord(input.workspaceId, input.agentId);
  const cfg = asRecord(config);
  const knowledge = asRecord(cfg.knowledgeBase || cfg.knowledge);
  const dynamicVars = asRecord(cfg.dynamicVariables);
  const advanced = asRecord(cfg.advanced);
  const wizard = asRecord(advanced.appointmentReceptionistWizard);
  const pricing = asRecord(knowledge.pricing || cfg.pricing);
  const kbIds = await linkedKnowledgeBaseIds(input.workspaceId, input.agentId);

  // --- Structured pricing ---
  if (isPricingTopic(topicLower)) {
    const priced = resolveStructuredPricing(pricing, knowledge);
    if (priced) return priced;
  }

  // --- Hours ---
  if (isHoursTopic(topicLower)) {
    const hours =
      knowledge.businessHours ||
      cfg.businessHours ||
      dynamicVars.business_hours ||
      wizard.businessHours;
    if (hours) {
      return {
        ok: true,
        speak: `Our hours are ${String(hours)}.`,
        data: { topic: "hours", hours },
      };
    }
    const receptionistHours = resolveFromGenericReceptionist(topicLower, topic, advanced);
    if (receptionistHours) return receptionistHours;
  }

  // --- Service area / coverage (RAG-first — before generic services blurb) ---
  if (isServiceAreaTopic(topicLower)) {
    const ragArea = await searchRagAnswer(input.workspaceId, kbIds, topic);
    if (ragArea) return ragArea;
    const receptionistArea = resolveFromGenericReceptionist(topicLower, topic, advanced);
    if (receptionistArea) return receptionistArea;
  }

  // --- Services / what we do ---
  if (isServicesTopic(topicLower)) {
    const services =
      knowledge.services ||
      cfg.services ||
      dynamicVars.services_description ||
      wizard.servicesDescription;
    if (services) {
      return {
        ok: true,
        speak: String(services),
        data: { topic: "services" },
      };
    }
    const receptionistServices = resolveFromGenericReceptionist(topicLower, topic, advanced);
    if (receptionistServices) return receptionistServices;
  }

  // --- Pricing from generic receptionist wizard (after structured pricing) ---
  if (isPricingTopic(topicLower)) {
    const receptionistPricing = resolveFromGenericReceptionist(topicLower, topic, advanced);
    if (receptionistPricing) return receptionistPricing;
  }

  // --- FAQ map in draftConfig ---
  const faq = asRecord(knowledge.faq);
  for (const [key, value] of Object.entries(faq)) {
    if (topicLower.includes(key.toLowerCase()) || topicMatches(String(value), topic)) {
      return {
        ok: true,
        speak: String(value),
        data: { topic: key, source: "faq" },
      };
    }
  }

  // --- Wizard knowledge items ---
  const wizardItems = Array.isArray(wizard.knowledgeItems) ? wizard.knowledgeItems : [];
  for (const raw of wizardItems) {
    const item = asRecord(raw);
    const label = String(item.label || "").trim();
    const summary = String(item.summary || "").trim();
    const status = String(item.status || "complete");
    if (!summary || status === "missing" || status === "rejected") continue;
    if (topicMatches(label, topic) || topicMatches(summary, topic)) {
      return {
        ok: true,
        speak: summary,
        data: { topic: label, source: "wizard" },
      };
    }
  }

  // --- Company brain facts ---
  const brain = await loadBusinessBrain(input.workspaceId, {
    agentId: input.agentId,
    draftConfig: config,
  });
  for (const fact of brain.knowledgeFacts || []) {
    if (topicMatches(fact.label, topic) || topicMatches(fact.summary, topic)) {
      return {
        ok: true,
        speak: fact.summary,
        data: { topic: fact.label, source: "company_brain" },
      };
    }
  }

  // --- Vector / local RAG search across linked knowledge bases ---
  const ragAnswer = await searchRagAnswer(input.workspaceId, kbIds, topic);
  if (ragAnswer) return ragAnswer;

  const receptionistFallback = resolveFromGenericReceptionist(topicLower, topic, advanced);
  if (receptionistFallback) return receptionistFallback;

  return {
    ok: false,
    speak:
      "I don't have specific information on that in my system. I can take a message or connect you with the team.",
    code: "NOT_FOUND",
  };
}
