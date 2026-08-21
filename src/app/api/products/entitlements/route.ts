import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserProductAccess } from "@/lib/products/entitlements";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getUserProductAccess(session.userId);
  return NextResponse.json({ data: access });
}
