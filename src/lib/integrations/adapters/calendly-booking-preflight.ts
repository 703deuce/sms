import type { AdapterContext } from "../framework/types";
import { CalendlyConnectorError } from "./calendly-client";
import { getEventTypeDetail, isEventTypeAiBookable } from "./calendly-event-types";

export type CalendlyMissingField = "EMAIL" | "NAME" | "PHONE" | "CUSTOM_QUESTION" | "LOCATION";

export type CalendlyBookingPreflightResult =
  | {
      status: "READY_TO_BOOK";
      eventTypeUri: string;
      startTimeUtc: string;
      durationMinutes: number;
      timezone: string;
      invitee: { name: string; email: string; phone?: string | null };
      location?: { kind: string; location?: string };
      questionsAndAnswers?: Array<{ question: string; answer: string; position?: number }>;
    }
  | { status: "MISSING_REQUIRED_DATA"; missing: CalendlyMissingField[]; message: string }
  | { status: "EVENT_TYPE_INVALID"; message: string }
  | { status: "PLAN_BLOCKED"; message: string };

/** CAL-BKG-003 — validate before POST /invitees */
export async function prepareCalendlyBooking(
  ctx: AdapterContext,
  input: {
    eventTypeUri: string;
    startTimeUtc: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    timezone: string;
    customAnswers?: Record<string, string>;
  },
): Promise<CalendlyBookingPreflightResult> {
  const missing: CalendlyMissingField[] = [];
  if (!input.name?.trim()) missing.push("NAME");
  if (!input.email?.trim()) missing.push("EMAIL");
  if (missing.length) {
    return {
      status: "MISSING_REQUIRED_DATA",
      missing,
      message:
        missing.includes("EMAIL")
          ? "What's the best email for the calendar invitation?"
          : "I need your name to complete the booking.",
    };
  }

  try {
    const et = await getEventTypeDetail(ctx, input.eventTypeUri);
    const eligible = isEventTypeAiBookable(et);
    if (!eligible.ok) {
      return { status: "EVENT_TYPE_INVALID", message: eligible.reasons.join("; ") };
    }

    let location: { kind: string; location?: string } | undefined;
    const firstLoc = et.locations[0];
    if (firstLoc?.kind) {
      location = { kind: String(firstLoc.kind) };
      if (firstLoc.location) location.location = String(firstLoc.location);
    }

    const questionsAndAnswers: Array<{ question: string; answer: string; position?: number }> =
      [];
    for (const q of et.customQuestions) {
      if (!q.required) continue;
      const key = q.name || "";
      const ans = key ? input.customAnswers?.[key] : undefined;
      if (!ans?.trim()) {
        return {
          status: "MISSING_REQUIRED_DATA",
          missing: ["CUSTOM_QUESTION"],
          message: `Before I book, I need to know: ${key || "a required scheduling question"}`,
        };
      }
      questionsAndAnswers.push({ question: key, answer: ans.trim() });
    }

    return {
      status: "READY_TO_BOOK",
      eventTypeUri: et.uri,
      startTimeUtc: input.startTimeUtc,
      durationMinutes: et.durationMinutes,
      timezone: input.timezone,
      invitee: {
        name: input.name.trim(),
        email: input.email!.trim().toLowerCase(),
        phone: input.phone,
      },
      ...(location ? { location } : {}),
      ...(questionsAndAnswers.length ? { questionsAndAnswers } : {}),
    };
  } catch (err) {
    if (err instanceof CalendlyConnectorError && err.code === "CALENDLY_PLAN_REQUIRED") {
      return {
        status: "PLAN_BLOCKED",
        message:
          "Your Calendly connection works, but direct AI booking is not available for this Calendly account/plan.",
      };
    }
    throw err;
  }
}
