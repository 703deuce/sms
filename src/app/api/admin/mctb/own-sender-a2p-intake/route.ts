import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-auth";
import { listMctbOwnSenderA2pSubmissionsForAdmin } from "@/lib/mctb/own-sender-a2p-intake";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const data = await listMctbOwnSenderA2pSubmissionsForAdmin();
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
