import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AGENT_TEMPLATE_CATALOG } from "@/lib/voice/templates/catalog";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    data: AGENT_TEMPLATE_CATALOG,
    runtime: "livekit_python",
    defaultProductionTemplate: "transovo_receptionist_v1",
  });
}
