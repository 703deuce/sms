import { NextResponse } from "next/server";

export function jsonError(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : "Request failed";
  const code = status >= 500 ? status : 400;
  return NextResponse.json({ error: message }, { status: code });
}
