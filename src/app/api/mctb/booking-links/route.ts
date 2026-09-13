import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createMctbBookingLink,
  listMctbBookingLinks,
} from "@/lib/mctb/booking-links/service";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const activeOnly = new URL(request.url).searchParams.get("active") === "1";
    const data = await listMctbBookingLinks(auth.workspaceId, activeOnly);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      label?: string;
      url?: string;
      description?: string | null;
      active?: boolean;
      isDefault?: boolean;
    };
    const data = await createMctbBookingLink(auth.workspaceId, {
      label: body.label || "",
      url: body.url || "",
      description: body.description,
      active: body.active,
      isDefault: body.isDefault,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
