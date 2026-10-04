import type { MctbTeamActivityBrief } from "@/lib/mctb/handoff/team-activity-brief-types";

const LOG_LIKE =
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}|from \+\d{10,}|no voicemail was left|recovery text was sent and caller replied/i;
const BOILERPLATE_NO_PROMISE = /no appointment, price, or promise/i;

function normalizeBullet(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Customer-facing brief — drops log language and duplicates the summary already states. */
export function tightenTeamBriefForDetail(brief: MctbTeamActivityBrief): MctbTeamActivityBrief {
  const summaryNorm = normalizeBullet(brief.summary);
  const seen = new Set<string>();
  const bullets: string[] = [];

  for (const raw of brief.bullets) {
    const b = raw.trim();
    if (!b) continue;
    if (LOG_LIKE.test(b)) continue;
    if (BOILERPLATE_NO_PROMISE.test(b)) continue;
    if (/^recovery text was sent/i.test(b)) continue;
    if (/^missed call at /i.test(b)) continue;
    const norm = normalizeBullet(b);
    if (summaryNorm.includes(norm) || norm.length < 8) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    bullets.push(b);
    if (bullets.length >= 5) break;
  }

  return {
    ...brief,
    bullets,
    headline: brief.headline.trim(),
    summary: brief.summary.trim(),
    recommendedNextStep: brief.recommendedNextStep.trim(),
  };
}
