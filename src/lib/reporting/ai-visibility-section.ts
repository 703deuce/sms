import { createServiceClient } from "@/lib/db/client";
import { isSuccessfulAiRunStatus } from "@/lib/ai-visibility/engine-status";
import type { ReportAiVisibilitySection } from "@/lib/reporting/types";

const METHODOLOGY =
  "We ask the listed prompts on each checked AI platform and record whether your business was mentioned, which competitors appeared, and how often. Scores are mention coverage across engines — not a proprietary mystery rating.";

/**
 * Load latest (+ prior) AI Visibility run into a report-ready section.
 * Returns hasData:false when the business has no successful runs yet.
 */
export async function loadAiVisibilityReportSection(
  businessId: string
): Promise<ReportAiVisibilitySection> {
  const empty: ReportAiVisibilitySection = {
    hasData: false,
    runAt: null,
    previousRunAt: null,
    visibilityScore: null,
    previousVisibilityScore: null,
    targetMentioned: null,
    previousTargetMentioned: null,
    promptsChecked: 0,
    enginesChecked: 0,
    engines: [],
    prompts: [],
    competitors: [],
    summary: null,
    methodology: METHODOLOGY,
  };

  const supabase = createServiceClient();
  const { data: runs } = await supabase
    .from("ai_visibility_runs")
    .select(
      "id, status, visibility_score, target_mentioned, competitor_count, prompts_checked, engines_checked, ai_summary, created_at, finished_at"
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(20);

  const complete = (runs ?? []).filter((r) =>
    isSuccessfulAiRunStatus(String(r.status ?? ""))
  );
  const latest = complete[0] ?? null;
  if (!latest) return empty;

  const previous = complete[1] ?? null;

  const { data: engineRows } = await supabase
    .from("ai_visibility_engine_results")
    .select("engine, status, target_mentioned, mentions_json, prompt_id")
    .eq("run_id", latest.id as string)
    .order("checked_at", { ascending: true });

  const engines = (engineRows ?? []).map((er) => ({
    engine: String(er.engine ?? "unknown"),
    mentioned: Boolean(er.target_mentioned),
    status: String(er.status ?? "unknown"),
  }));

  const mentionCounts = new Map<string, number>();
  for (const er of engineRows ?? []) {
    const mentions = (er.mentions_json as Array<{ name?: string }> | null) ?? [];
    for (const m of mentions) {
      const name = m.name?.trim();
      if (!name) continue;
      mentionCounts.set(name, (mentionCounts.get(name) ?? 0) + 1);
    }
  }
  const competitors = [...mentionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, mentions]) => ({ name, mentions }));

  const promptIds = [
    ...new Set(
      (engineRows ?? [])
        .map((er) => er.prompt_id as string | null)
        .filter((id): id is string => !!id)
    ),
  ];
  let prompts: ReportAiVisibilitySection["prompts"] = [];
  if (promptIds.length > 0) {
    const { data: promptRows } = await supabase
      .from("ai_visibility_prompts")
      .select("id, prompt_text")
      .in("id", promptIds);
    const textById = new Map(
      (promptRows ?? []).map((p) => [p.id as string, String(p.prompt_text ?? "")])
    );
    const mentionedByPrompt = new Map<string, boolean>();
    for (const er of engineRows ?? []) {
      const pid = er.prompt_id as string | null;
      if (!pid) continue;
      if (er.target_mentioned) mentionedByPrompt.set(pid, true);
      else if (!mentionedByPrompt.has(pid)) mentionedByPrompt.set(pid, false);
    }
    prompts = promptIds
      .map((id) => ({
        text: textById.get(id) || "Prompt",
        mentioned: mentionedByPrompt.get(id) ?? null,
      }))
      .filter((p) => p.text.trim().length > 0)
      .slice(0, 12);
  }

  return {
    hasData: true,
    runAt: (latest.finished_at as string | null) ?? (latest.created_at as string),
    previousRunAt: previous
      ? ((previous.finished_at as string | null) ?? (previous.created_at as string))
      : null,
    visibilityScore: (latest.visibility_score as number | null) ?? null,
    previousVisibilityScore: (previous?.visibility_score as number | null) ?? null,
    targetMentioned: (latest.target_mentioned as boolean | null) ?? null,
    previousTargetMentioned: (previous?.target_mentioned as boolean | null) ?? null,
    promptsChecked: (latest.prompts_checked as number) ?? prompts.length,
    enginesChecked: (latest.engines_checked as number) ?? engines.length,
    engines,
    prompts,
    competitors,
    summary: (latest.ai_summary as string | null) ?? null,
    methodology: METHODOLOGY,
  };
}
