import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getBookingProviders,
  getBookingContext,
  findAvailableTimes,
  createBooking,
  getBookingStatus,
} from "@/lib/mctb/ai-booking/service";
import { orchestrateMctbAiBooking } from "@/lib/mctb/ai-booking/orchestrator";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    if (url.searchParams.get("scope") === "context") {
      const data = await getBookingContext(auth.workspaceId);
      return NextResponse.json({ data });
    }
    const providers = await getBookingProviders(auth.workspaceId);
    return NextResponse.json({ data: { providers } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: string;
      conversationId?: string;
      windowStartUtc?: string;
      windowEndUtc?: string;
      timezone?: string;
      specificTimeUtc?: string | null;
      choiceUtterance?: string | null;
      confirmBooking?: boolean;
      slotId?: string;
      contactId?: string | null;
      customerName?: string;
      customerPhone?: string | null;
      customerEmail?: string | null;
      providerBookingId?: string;
    };

    const action = body.action || "orchestrate";

    if (action === "find_available_times") {
      if (!body.windowStartUtc || !body.windowEndUtc || !body.timezone) {
        return NextResponse.json({ error: "window and timezone required" }, { status: 400 });
      }
      const data = await findAvailableTimes({
        workspaceId: auth.workspaceId,
        conversationId: body.conversationId,
        windowStartUtc: body.windowStartUtc,
        windowEndUtc: body.windowEndUtc,
        timezone: body.timezone,
        preferredStartUtc: body.specificTimeUtc,
      });
      return NextResponse.json({ data });
    }

    if (action === "create_booking") {
      if (!body.conversationId || !body.slotId || !body.customerName) {
        return NextResponse.json({ error: "conversationId, slotId, customerName required" }, { status: 400 });
      }
      const data = await createBooking({
        workspaceId: auth.workspaceId,
        conversationId: body.conversationId,
        contactId: body.contactId,
        slotId: body.slotId,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail,
      });
      return NextResponse.json({ data });
    }

    if (action === "booking_status") {
      if (!body.providerBookingId) {
        return NextResponse.json({ error: "providerBookingId required" }, { status: 400 });
      }
      const data = await getBookingStatus(auth.workspaceId, body.providerBookingId);
      return NextResponse.json({ data });
    }

    if (action === "test_availability") {
      if (!body.windowStartUtc || !body.windowEndUtc) {
        return NextResponse.json({ error: "window required" }, { status: 400 });
      }
      const data = await findAvailableTimes({
        workspaceId: auth.workspaceId,
        windowStartUtc: body.windowStartUtc,
        windowEndUtc: body.windowEndUtc,
        timezone: body.timezone || "America/New_York",
        maxResults: 12,
      });
      return NextResponse.json({ data });
    }

    if (action === "orchestrate") {
      if (
        !body.conversationId ||
        !body.windowStartUtc ||
        !body.windowEndUtc ||
        !body.timezone ||
        !body.customerName
      ) {
        return NextResponse.json(
          { error: "conversationId, window, timezone, customerName required" },
          { status: 400 },
        );
      }
      const data = await orchestrateMctbAiBooking({
        workspaceId: auth.workspaceId,
        conversationId: body.conversationId,
        contactId: body.contactId,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail,
        windowStartUtc: body.windowStartUtc,
        windowEndUtc: body.windowEndUtc,
        timezone: body.timezone,
        specificTimeUtc: body.specificTimeUtc,
        choiceUtterance: body.choiceUtterance,
        confirmBooking: body.confirmBooking,
      });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 500);
  }
}
