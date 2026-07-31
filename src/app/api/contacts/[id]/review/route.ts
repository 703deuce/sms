import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { recordContactReview } from "@/lib/automations/reviews";

/**
 * Record a review for a contact (internal / webhook integration).
 * POST body: { rating?: number, positive?: boolean, negative?: boolean, source?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: contactId } = await params;
    const body = (await request.json()) as {
      rating?: number;
      positive?: boolean;
      negative?: boolean;
      source?: string;
    };

    const result = await recordContactReview(auth.workspaceId, contactId, body);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
