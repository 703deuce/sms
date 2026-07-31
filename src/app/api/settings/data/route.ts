import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  exportWorkspaceData,
  getDataPrefs,
  upsertDataPrefs,
} from "@/lib/settings/data-prefs";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getDataPrefs(auth.workspaceId);
    return NextResponse.json({
      data: {
        messageRetentionDays: data?.messageRetentionDays ?? 365,
        consentRetention: data?.consentRetention ?? "forever",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      messageRetentionDays?: number;
      consentRetention?: string;
    };
    const data = await upsertDataPrefs(auth.workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const payload = await exportWorkspaceData(auth.workspaceId);
    return NextResponse.json({ data: payload });
  } catch (err) {
    return jsonError(err, 500);
  }
}
