import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const status = (body as { status?: string; businessId?: string }).status ?? "done";
    const businessId = (body as { businessId?: string }).businessId;

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const supabase = createServiceClient();
    const { data: task } = await supabase
      .from("review_momentum_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("business_id", businessId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { data: updated, error } = await supabase
      .from("review_momentum_tasks")
      .update({ status })
      .eq("id", taskId)
      .eq("business_id", businessId)
      .eq("organization_id", auth.organizationId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ task: updated });
  } catch (err) {
    return httpErrorFromException(err, "Update failed");
  }
}
