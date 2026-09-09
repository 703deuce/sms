import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { processAiSchedulingRequest } from "@/lib/appointments/ai-scheduling";
import { resolveWorkspaceBySlug } from "@/lib/appointments/settings";
import { loadAppointmentPlatformConfig } from "@/lib/appointments";
import { enforcePublicBookingAiRateLimit } from "@/lib/appointments/public-booking-rate-limit";

type Params = { params: Promise<{ slug: string }> };

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking page disabled" }, { status: 403 });
    }

    const ip = clientIp(request);
    if (!enforcePublicBookingAiRateLimit(workspace.id, ip)) {
      return NextResponse.json(
        { error: "Too many requests — please wait a moment." },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      text?: string;
      conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    const text = String(body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }

    const data = await processAiSchedulingRequest({
      workspaceId: workspace.id,
      text,
      conversationHistory: body.conversationHistory,
    });

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
