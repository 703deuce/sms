import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";

const schema = z.object({
  reviewId: z.string().uuid(),
  resolved: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const now = new Date().toISOString();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("business_reviews")
      .update({
        resolved_at: parsed.data.resolved ? now : null,
        resolved_by: parsed.data.resolved ? auth.userId : null,
      })
      .eq("id", parsed.data.reviewId)
      .eq("business_id", businessId)
      .eq("organization_id", auth.organizationId)
      .select("id, resolved_at, resolved_by")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Review not found" }, { status: 404 });

    return NextResponse.json({ review: data });
  } catch (err) {
    return httpErrorFromException(err, "Failed to update review resolution");
  }
}
