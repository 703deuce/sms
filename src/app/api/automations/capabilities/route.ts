import { NextResponse } from "next/server";
import { getAutomationCapabilities } from "@/lib/automations/capabilities";

export async function GET() {
  return NextResponse.json({ data: getAutomationCapabilities() });
}
