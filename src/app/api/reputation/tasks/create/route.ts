import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadLatestReputationAudit } from "@/lib/reputation/engine";
import { fallbackReputationTasks } from "@/lib/providers/deepseek/reputation";
import { createServiceClient } from "@/lib/db/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId } = body as { businessId?: string };
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const latest = await loadLatestReputationAudit(businessId);
    if (!latest?.audit) {
      return NextResponse.json({ error: "No reputation audit found — run an audit first" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("reputation_tasks").select("id").eq("audit_id", latest.audit.id);
    if (existing?.length) {
      return NextResponse.json({ created: 0, tasks: existing });
    }

    const fallback = fallbackReputationTasks({
      reviewGap: (latest.audit.review_gap as number) ?? 0,
      weeklyTarget: (latest.audit.recommended_weekly_target as number) ?? 1,
      unanswered: 0,
      keywordGaps: (latest.keywordGaps ?? []).slice(0, 3).map((g) => g.keyword as string),
    });

    const rows = fallback.tasks.map((t) => ({
      audit_id: latest.audit!.id,
      organization_id: auth.organizationId,
      business_id: businessId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      impact: t.impact,
      effort: t.effort,
      status: "open",
      evidence_json: { evidence: t.evidence },
    }));

    const { data: inserted, error: insertError } = await supabase.from("reputation_tasks").insert(rows).select("id");
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    return NextResponse.json({ created: inserted?.length ?? 0, tasks: inserted });
  } catch (err) {
    return httpErrorFromException(err, "Failed to create tasks");
  }
}
