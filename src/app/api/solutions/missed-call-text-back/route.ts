import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadMissedCallTextBack,
  saveMissedCallTextBack,
} from "@/lib/solutions/missed-call-text-back/save";
import type { MissedCallTextBackConfig } from "@/lib/solutions/missed-call-text-back/types";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const setupId = url.searchParams.get("setupId") || undefined;
    const data = await loadMissedCallTextBack(auth.workspaceId, setupId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Partial<MissedCallTextBackConfig> & {
      setupId?: string;
    };
    const result = await saveMissedCallTextBack(auth.workspaceId, body);
    const data = await loadMissedCallTextBack(auth.workspaceId, result.setupId);
    return NextResponse.json(
      { data: { ...data, ...result } },
      { status: result.created ? 201 : 200 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}
