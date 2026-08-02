/**
 * Natural-language → visual VoiceFlow draft.
 * Uses DeepSeek/OpenAI when configured; always falls back to keyword→template.
 */

import { extractJsonFromLlm, hasLlmConfigured, llmChatCompletion } from "@/lib/ai/llm";
import {
  getVoiceFlowTemplate,
  VOICE_FLOW_TEMPLATES,
  type VoiceFlowTemplateId,
} from "./templates";
import {
  parseVoiceFlowBundle,
  type VoiceFlowBundle,
  type VoiceFlowNode,
} from "./types";
import { validateVoiceFlowBundle } from "./validation";

export type GenerateFlowResult = {
  bundle: VoiceFlowBundle;
  templateId: VoiceFlowTemplateId;
  mode: "llm" | "heuristic";
  provider?: string;
  model?: string;
  summary: string;
  issues: ReturnType<typeof validateVoiceFlowBundle>;
};

const TEMPLATE_HINTS: Array<{
  id: VoiceFlowTemplateId;
  keywords: string[];
}> = [
  {
    id: "full_receptionist",
    keywords: [
      "receptionist",
      "front desk",
      "main line",
      "department",
      "transfer",
      "route",
      "billing",
      "sales",
    ],
  },
  {
    id: "lead_intake",
    keywords: ["lead", "intake", "qualify", "qualification", "new customer"],
  },
  {
    id: "appointment_request",
    keywords: ["appointment", "book", "schedule", "calendly", "booking"],
  },
  {
    id: "scheduling_link",
    keywords: ["scheduling link", "send link", "sms link"],
  },
  {
    id: "support_triage",
    keywords: ["support", "triage", "ticket", "help desk", "issue"],
  },
  {
    id: "faq_router",
    keywords: ["faq", "knowledge", "questions", "hours", "pricing"],
  },
  {
    id: "missed_call",
    keywords: ["missed", "ring first", "human first", "no answer", "fallback"],
  },
  {
    id: "after_hours",
    keywords: ["after hours", "closed", "after-hours", "outside hours"],
  },
  {
    id: "quote_request",
    keywords: ["quote", "estimate", "pricing request"],
  },
  {
    id: "answering_machine",
    keywords: ["voicemail", "answering machine", "take a message", "message only"],
  },
];

function pickTemplateId(prompt: string): VoiceFlowTemplateId {
  const lower = prompt.toLowerCase();
  let best: VoiceFlowTemplateId = "full_receptionist";
  let score = 0;
  for (const hint of TEMPLATE_HINTS) {
    let s = 0;
    for (const k of hint.keywords) {
      if (lower.includes(k)) s += k.split(/\s+/).length;
    }
    if (s > score) {
      score = s;
      best = hint.id;
    }
  }
  return best;
}

function applyGreeting(bundle: VoiceFlowBundle, greeting?: string) {
  if (!greeting?.trim()) return bundle;
  const next = structuredClone(bundle);
  const node = next.conversation.nodes.find((n) => n.data.blockType === "greeting");
  if (node) {
    node.data.config = { ...node.data.config, text: greeting.trim().slice(0, 280) };
  }
  return next;
}

function ensureToolFailureRule(bundle: VoiceFlowBundle): VoiceFlowBundle {
  const next = structuredClone(bundle);
  if (!next.globalRules.some((r) => r.trigger === "tool_failure")) {
    next.globalRules.push({
      id: `gr_toolfail_${Math.random().toString(36).slice(2, 8)}`,
      name: "Tool failure recovery",
      trigger: "tool_failure",
      enabled: true,
      destinationBlockType: "take_message",
      instructions:
        "If a CRM lookup, transfer, or other tool fails, apologize, stay on the line, and offer to take a message. Never hang up because a tool failed.",
    });
  }
  return next;
}

function heuristicGenerate(prompt: string): GenerateFlowResult {
  const templateId = pickTemplateId(prompt);
  const t = getVoiceFlowTemplate(templateId)!;
  let bundle = ensureToolFailureRule(structuredClone(t.bundle));

  const greetMatch = prompt.match(/greet(?:ing)?(?: me| callers?)?(?: with| as| like)?[:\s]+["']?([^"'\n.]+)["']?/i);
  if (greetMatch?.[1]) {
    bundle = applyGreeting(bundle, greetMatch[1]);
  } else if (/friendly|warm|welcoming/i.test(prompt)) {
    bundle = applyGreeting(
      bundle,
      "Thanks for calling — I'm the virtual assistant. How can I help you today?",
    );
  }

  // Light structural tweaks from NL cues.
  if (/crm|zoho|salesforce|pipedrive|look up|lookup/i.test(prompt)) {
    const hasCrm = bundle.conversation.nodes.some(
      (n) => n.data.blockType === "search_crm_contacts",
    );
    if (!hasCrm) {
      const greeting = bundle.conversation.nodes.find((n) => n.data.blockType === "greeting");
      const crm: VoiceFlowNode = {
        id: `vn_crm_${Math.random().toString(36).slice(2, 8)}`,
        type: "crm",
        position: { x: 320, y: 40 },
        data: {
          blockType: "search_crm_contacts",
          label: "CRM lookup",
          config: {},
        },
      };
      bundle.conversation.nodes.push(crm);
      if (greeting) {
        bundle.conversation.edges.push({
          id: `ve_crm_${Math.random().toString(36).slice(2, 8)}`,
          source: greeting.id,
          target: crm.id,
          sourceHandle: "default",
          targetHandle: null,
        });
      }
    }
  }

  const issues = validateVoiceFlowBundle(bundle);
  return {
    bundle,
    templateId,
    mode: "heuristic",
    summary: `Drafted from template "${t.name}" based on your description.`,
    issues,
  };
}

async function llmGenerate(prompt: string): Promise<GenerateFlowResult | null> {
  if (!hasLlmConfigured()) return null;

  const catalog = VOICE_FLOW_TEMPLATES.map(
    (t) => `- ${t.id}: ${t.name} — ${t.description}`,
  ).join("\n");

  const system = `You design Transovo voice AI call flows.
Return ONLY valid JSON with this shape:
{
  "templateId": one of the ids below,
  "greeting": optional string under 280 chars,
  "summary": short explanation,
  "enableCrm": boolean,
  "enableTransfer": boolean,
  "humanFirst": boolean,
  "globalRulesNotes": optional string
}
Prefer an existing templateId. Do not invent node schemas.
Templates:
${catalog}`;

  const llm = await llmChatCompletion(system, prompt, {
    temperature: 0.2,
    maxTokens: 800,
  });
  if (!llm) return null;

  const parsed = extractJsonFromLlm(llm.content) as {
    templateId?: string;
    greeting?: string;
    summary?: string;
    enableCrm?: boolean;
    enableTransfer?: boolean;
    humanFirst?: boolean;
  };

  const templateId = (
    VOICE_FLOW_TEMPLATES.some((t) => t.id === parsed.templateId)
      ? parsed.templateId
      : pickTemplateId(prompt)
  ) as VoiceFlowTemplateId;

  // humanFirst preference overrides template when clear.
  let chosen = templateId;
  if (parsed.humanFirst && templateId !== "missed_call") {
    chosen = "missed_call";
  }

  const t = getVoiceFlowTemplate(chosen)!;
  let bundle = ensureToolFailureRule(structuredClone(t.bundle));
  if (parsed.greeting) bundle = applyGreeting(bundle, parsed.greeting);

  if (parsed.enableCrm) {
    const hasCrm = bundle.conversation.nodes.some(
      (n) => n.data.blockType === "search_crm_contacts",
    );
    if (!hasCrm) {
      bundle.conversation.nodes.push({
        id: `vn_crm_${Math.random().toString(36).slice(2, 8)}`,
        type: "crm",
        position: { x: 400, y: 80 },
        data: {
          blockType: "search_crm_contacts",
          label: "CRM lookup",
          config: {},
        },
      });
    }
  }

  if (parsed.enableTransfer !== false) {
    if (!bundle.globalRules.some((r) => r.trigger === "want_person" && r.enabled)) {
      bundle.globalRules.push({
        id: `gr_person_${Math.random().toString(36).slice(2, 8)}`,
        name: "Want a real person",
        trigger: "want_person",
        enabled: true,
        destinationBlockType: "escalate_human",
        transferTargetName: "Agent Handoff",
        instructions:
          "If the caller asks for a person, use escalate_human to Agent Handoff. Never invent a phone number.",
      });
    }
  }

  // Re-parse for safety/normalization.
  bundle = parseVoiceFlowBundle(bundle);
  const issues = validateVoiceFlowBundle(bundle);

  return {
    bundle,
    templateId: chosen,
    mode: "llm",
    provider: llm.provider,
    model: llm.model,
    summary: parsed.summary || `AI drafted from template "${t.name}".`,
    issues,
  };
}

export async function generateVoiceFlowFromNaturalLanguage(
  prompt: string,
): Promise<GenerateFlowResult> {
  const text = String(prompt || "").trim();
  if (text.length < 8) {
    throw new Error("Describe the call flow in a bit more detail (at least a sentence).");
  }

  try {
    const llm = await llmGenerate(text);
    if (llm) return llm;
  } catch (err) {
    console.warn(
      "[flow/generate-from-nl] LLM failed, using heuristic",
      err instanceof Error ? err.message : err,
    );
  }
  return heuristicGenerate(text);
}
