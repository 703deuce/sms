import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPhoneSettings, upsertPhoneSettings } from "@/lib/phone/settings";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getPhoneSettings(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { defaultCallerIdNumber?: string | null };
    const data = await upsertPhoneSettings(auth.workspaceId, {
      defaultCallerIdNumber: body.defaultCallerIdNumber,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
