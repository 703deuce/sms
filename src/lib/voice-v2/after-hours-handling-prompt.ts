import "server-only";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { VoiceV2PublishedAfterHoursHandlingConfig } from "./after-hours-handling-types";
import { resolveAfterHoursHandlingFromAgentAdvanced } from "./after-hours-handling-config";

/**
 * Layer B — after-hours operational modes (single Amy, existing runtime capabilities).
 * Urgency actions remain deterministic in code; this text tells the model how to behave.
 */
export function buildVoiceV2AfterHoursLayerBInstructions(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): string | null {
  const published =
    resolveAfterHoursHandlingFromAgentAdvanced(
      (config?.advanced || {}) as Record<string, unknown>,
    ) || null;
  if (!published) return null;

  const lines: string[] = [
    "AFTER-HOURS OPERATIONAL MODES (one assistant — use configured tools and runtime state):",
    "- Normal lead: answer from Business knowledge or enabled tools, collect intake, book/request/link when permitted.",
    "- Existing customer: honor customer_status / existing-customer rules; transfer or callback per configuration.",
    "- Urgent / critical: urgency is decided by configured business rules on structured fields — not by your guess from tone alone. When runtime marks URGENT/CRITICAL, follow the configured action immediately (transfer plan, waterfall, or callback).",
    "- Uncertain: if you cannot establish an answer from Business knowledge, voice_v2_search_knowledge results, or confirmed structured state, do not invent pricing, policy, technical advice, availability, or promises. Say you do not have that information and use the configured fallback (message, callback, transfer, or booking link).",
    "- Human requested: when the caller clearly asks for a person, agent, representative, or someone live, stop persuading them to continue with AI. If voice_v2_transfer_call is available, call it immediately with caller_requested_human true and the configured transfer plan. If transfer is unavailable or fails, offer callback or message capture — do not loop on AI assistance.",
  ];

  if (published.transferEnabled) {
    lines.push(
      `- Human transfer: enabled. Use voice_v2_transfer_call with configured plan only — never invent phone numbers.`,
    );
  } else {
    lines.push(
      "- Human transfer: not enabled — offer callback or message when they ask for a person.",
    );
  }

  if (published.callbackRequestsEnabled) {
    lines.push("- Callback requests: use voice_v2_create_callback_request when appropriate.");
  }

  if (published.urgencyEnabled && published.urgencyRules.length) {
    lines.push(
      "Configured urgency rules (runtime evaluates these on saved field values — examples: active flooding, gas smell, sewage backup, no heat, electrical hazard, lockout):",
    );
    for (const rule of published.urgencyRules.slice(0, 12)) {
      lines.push(
        `  - ${rule.label || rule.fieldKey}: ${rule.severity} → ${rule.action}`,
      );
    }
    if (published.urgencyRules.length > 12) {
      lines.push(`  - (${published.urgencyRules.length - 12} more rules in configuration)`);
    }
  }

  if (published.salesSolicitationEnabled) {
    lines.push(
      `- Vendor/sales solicitations: ${published.salesSolicitationAction} — do not treat as customer service leads.`,
    );
  }

  lines.push(
    "Business hours and holidays are knowledge for answers only — they do not control whether this call reached you. Calls arrive because the business/carrier forwarded them.",
  );
  lines.push(
    "SMS: only narrow transactional uses (booking link with consent, business notifications). No general marketing texts to callers.",
  );

  return lines.join("\n");
}

export function afterHoursConfigFromAdvanced(
  advanced?: Record<string, unknown> | null,
): VoiceV2PublishedAfterHoursHandlingConfig | null {
  return resolveAfterHoursHandlingFromAgentAdvanced(advanced || {});
}
