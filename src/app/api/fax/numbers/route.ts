import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listFaxNumbers } from "@/lib/fax/fax-number-provisioning";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listFaxNumbers(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
