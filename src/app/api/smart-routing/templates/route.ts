import { NextResponse } from "next/server";
import { SMART_ROUTING_TEMPLATES } from "@/lib/smart-routing/templates";

export async function GET() {
  return NextResponse.json({ data: SMART_ROUTING_TEMPLATES });
}
