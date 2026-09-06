import { NextResponse } from "next/server";
import { recordEmailClick } from "@/lib/appointments/reminder-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const url = searchParams.get("url");
  if (id) {
    try {
      await recordEmailClick(id);
    } catch {
      // tracking must not break redirects
    }
  }
  if (url) {
    return NextResponse.redirect(decodeURIComponent(url));
  }
  return NextResponse.json({ ok: true });
}
