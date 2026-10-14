import { logProviderRun } from "@/lib/providers/dataforseo";
import type { ReportKpis } from "@/lib/reporting/types";

export type SummaryTone =
  | "professional"
  | "simple"
  | "positive_honest"
  | "detailed";

export const SUMMARY_TONES: Array<{ id: SummaryTone; label: string }> = [
  { id: "professional", label: "Professional" },
  { id: "simple", label: "Simple" },
  { id: "positive_honest", label: "Positive but honest" },
  { id: "detailed", label: "Detailed" },
];

export type SummaryKpiSlice = {
  arp?: number | null;
  atrp?: number | null;
  top3Pct?: number | null;
  top10Pct?: number | null;
  notFoundPct?: number | null;
  visibilityScore?: number | null;
};

export type SummaryMetricsInput = {
  businessName: string;
  keyword?: string | null;
  reportLabel: string;
  kpis: SummaryKpiSlice | Partial<ReportKpis>;
  priorKpis?: SummaryKpiSlice | Partial<ReportKpis> | null;
  aiMentioned?: number | null;
  aiTotal?: number | null;
  priorAiMentioned?: number | null;
  priorAiTotal?: number | null;
};

function toneSystemPrompt(tone: SummaryTone): string {
  const base =
    "You write client-facing Google Maps visibility summaries for local SEO freelancers. " +
    "Use only the provided metrics. Do not invent rankings, strategy advice, or unverified claims. " +
    "Do not tell the client to change categories, buy backlinks, or generate a specific number of reviews. " +
    "Be clear about increases and decreases. No bullet lists unless Detailed tone.";
  switch (tone) {
    case "simple":
      return `${base} Use short plain sentences a business owner can understand in 20 seconds.`;
    case "positive_honest":
      return `${base} Emphasize progress where metrics improved, but state declines plainly.`;
    case "detailed":
      return `${base} 3–5 sentences covering coverage, average rank, and notable change.`;
    default:
      return `${base} Tone: calm professional. 2–3 sentences.`;
  }
}

/** Deterministic fallback when no LLM key is configured. */
export function buildDeterministicExecutiveSummary(
  input: SummaryMetricsInput,
  tone: SummaryTone = "professional"
): string {
  const top3 = input.kpis.top3Pct;
  const priorTop3 = input.priorKpis?.top3Pct;
  const arp = input.kpis.arp;
  const priorArp = input.priorKpis?.arp;
  const parts: string[] = [];

  const kw = input.keyword?.trim();
  const subject = kw
    ? `${input.businessName} for “${kw}”`
    : input.businessName;

  if (top3 != null && priorTop3 != null && Number.isFinite(top3) && Number.isFinite(priorTop3)) {
    const delta = top3 - priorTop3;
    if (delta > 0.5) {
      parts.push(
        `Google Maps visibility improved during this reporting period. Top-three coverage increased from ${priorTop3.toFixed(0)}% to ${top3.toFixed(0)}%.`
      );
    } else if (delta < -0.5) {
      parts.push(
        `Top-three coverage moved from ${priorTop3.toFixed(0)}% to ${top3.toFixed(0)}% during this period.`
      );
    } else {
      parts.push(
        `Top-three coverage held near ${top3.toFixed(0)}% during this reporting period.`
      );
    }
  } else if (top3 != null && Number.isFinite(top3)) {
    parts.push(
      `${subject} currently appears in the top three for ${top3.toFixed(0)}% of tracked grid points.`
    );
  }

  if (arp != null && priorArp != null && Number.isFinite(arp) && Number.isFinite(priorArp)) {
    const improved = arp < priorArp;
    parts.push(
      improved
        ? `Average grid rank improved from ${priorArp.toFixed(1)} to ${arp.toFixed(1)}.`
        : `Average grid rank moved from ${priorArp.toFixed(1)} to ${arp.toFixed(1)}.`
    );
  } else if (arp != null && Number.isFinite(arp)) {
    parts.push(`Average grid rank is currently ${arp.toFixed(1)}.`);
  }

  if (
    input.aiMentioned != null &&
    input.aiTotal != null &&
    input.aiTotal > 0
  ) {
    const prior =
      input.priorAiMentioned != null && input.priorAiTotal != null
        ? ` compared with ${input.priorAiMentioned} of ${input.priorAiTotal} previously`
        : "";
    parts.push(
      `The business appeared in ${input.aiMentioned} of ${input.aiTotal} tracked AI recommendation prompts${prior}.`
    );
  }

  if (!parts.length) {
    parts.push(
      `${input.reportLabel} for ${input.businessName} is ready. Review the Maps metrics below with your client.`
    );
  }

  if (tone === "simple") {
    return parts.slice(0, 2).join(" ");
  }
  if (tone === "detailed") {
    return parts.join(" ");
  }
  return parts.slice(0, 3).join(" ");
}

export async function generateExecutiveSummary(params: {
  input: SummaryMetricsInput;
  tone: SummaryTone;
  organizationId?: string;
}): Promise<{ summary: string; source: "ai" | "deterministic" }> {
  const deterministic = buildDeterministicExecutiveSummary(params.input, params.tone);
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { summary: deterministic, source: "deterministic" };
  }

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();
  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: toneSystemPrompt(params.tone) },
          {
            role: "user",
            content: JSON.stringify({
              ...params.input,
              guidance:
                "Write only from these numbers. If prior metrics are missing, describe current state only.",
            }),
          },
        ],
        temperature: 0.35,
        max_tokens: 320,
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() as string | undefined;

    await logProviderRun({
      organizationId: params.organizationId,
      provider: "deepseek",
      endpoint: "report-executive-summary",
      request: { tone: params.tone, business: params.input.businessName },
      response: { ok: Boolean(content) },
      statusCode: res.status,
      latencyMs: Date.now() - start,
    });

    if (content && content.length > 40) {
      return { summary: content, source: "ai" };
    }
  } catch {
    // fall through
  }
  return { summary: deterministic, source: "deterministic" };
}
