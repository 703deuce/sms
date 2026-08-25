import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { searchFaxNumbers } from "@/lib/fax/fax-number-provisioning";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const areaCode = String(body.areaCode || "").replace(/\D/g, "").slice(0, 3);
    if (areaCode.length !== 3) {
      return jsonError(new Error("A 3-digit area code is required"), 400);
    }
    const data = await searchFaxNumbers(areaCode);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
