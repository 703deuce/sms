import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { logReviewRequestEvent } from "@/lib/reputation/review-requests";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      businessId,
      linkId,
      eventType,
      channel,
      customerName,
      customerPhone,
      customerEmail,
      serviceType,
      notes,
    } = body as {
      businessId?: string;
      linkId?: string;
      eventType?: string;
      channel?: string;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      serviceType?: string;
      notes?: string;
    };

    if (!businessId || !eventType) {
      return NextResponse.json({ error: "businessId and eventType required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const event = await logReviewRequestEvent({
      businessId,
      organizationId: auth.organizationId,
      linkId,
      eventType,
      channel,
      customerName,
      customerPhone,
      customerEmail,
      serviceType,
      notes,
    });

    return NextResponse.json({ event });
  } catch (err) {
    return httpErrorFromException(err, "Failed to log event");
  }
}
