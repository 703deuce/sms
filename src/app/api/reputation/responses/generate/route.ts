import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { generateResponseDrafts, loadLatestReputationAudit } from "@/lib/reputation/engine";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, reviewIds } = body as { businessId?: string; reviewIds?: string[] };

    if (!businessId || !reviewIds?.length) {
      return NextResponse.json({ error: "businessId and reviewIds required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const rate = await assertRateLimit({
      key: `reputation-responses:${auth.organizationId}`,
      maxPerWindow: 25,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
        }
      );
    }
    const latest = await loadLatestReputationAudit(businessId);
    if (!latest?.audit) {
      return NextResponse.json({ error: "No reputation audit found" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: business } = await supabase.from("businesses").select("name").eq("id", businessId).single();

    const drafts = await generateResponseDrafts({
      auditId: latest.audit.id as string,
      businessId,
      organizationId: auth.organizationId,
      reviewRecordIds: reviewIds,
      businessName: business?.name ?? "Business",
    });

    return NextResponse.json({ drafts });
  } catch (err) {
    return httpErrorFromException(err, "Failed to generate responses");
  }
}
