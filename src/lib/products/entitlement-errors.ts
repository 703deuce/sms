import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";

const ENTITLEMENT_MESSAGES: Record<string, string> = {
  AI_NOTETAKER_NOT_ENTITLED: "AI Notetaker is not available on your current plan.",
  TRANSOVO_VIDEO_NOT_ENTITLED: "Transovo Video is not available on your current plan.",
  MEETINGS_NOT_ENTITLED: "Meeting intelligence features are not available on your current plan.",
};

export function isEntitlementError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return message.endsWith("_NOT_ENTITLED");
}

export function jsonEntitlementError(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (message.endsWith("_NOT_ENTITLED")) {
    return NextResponse.json(
      {
        error: ENTITLEMENT_MESSAGES[message] || "This feature is not available on your current plan.",
        code: message,
      },
      { status: 403 },
    );
  }
  return jsonError(err, status);
}
