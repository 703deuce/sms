import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { reservePremiumNumber } from "@/lib/premium-numbers/reservation-service";
import type { PremiumSearchMode } from "@/lib/premium-numbers/premium-pricing";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    workspaceId?: string;
    phoneNumber?: string;
    searchLogId?: string;
    searchMode?: PremiumSearchMode;
  } | null;

  const phoneNumber = String(body?.phoneNumber || "").trim();
  const searchLogId = String(body?.searchLogId || "").trim();
  if (!phoneNumber || !searchLogId) {
    return NextResponse.json({ error: "phoneNumber and searchLogId required" }, { status: 400 });
  }

  try {
    const workspaceId = await resolveWorkspaceId(auth.session, body?.workspaceId);
    const result = await reservePremiumNumber({
      workspaceId,
      userId: auth.session.userId,
      phoneNumber,
      searchLogId,
      searchMode: body?.searchMode === "personal" ? "personal" : "business",
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, 400);
  }
}
