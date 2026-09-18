#!/usr/bin/env npx tsx
/**
 * Forensic trace: V2 BOOK_OFFERED_SLOT → Graph payload → Graph stored event.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/forensic-voice-v2-4pm-booking.ts
 *
 * Optional: OFFER_SET_ID=v2offer_... EVENT_ID=... CONVERSATION_ID=...
 */
import { getPrisma } from "../src/lib/db";
import { loadMctbAiBookingConfig } from "../src/lib/mctb/ai-booking/config";
import { resolveMctbMicrosoftConnectionId } from "../src/lib/mctb/ai-booking/microsoft-connection";
import {
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "../src/lib/voice/calendar/providers";
import { zonedDateParts } from "../src/lib/voice/calendar/timezone-slots";
import { toMicrosoftDateTimeTimeZone } from "../src/lib/microsoft/graph-datetime-timezone";
import { MICROSOFT_GRAPH_V1 } from "../src/lib/microsoft/graph-helpers";
import * as ai from "../src/lib/voice/telnyx/ai-client";
import type { VoiceV2Slot } from "../src/lib/voice-receptionist-wizard/types";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const DEFAULT_OFFER = "v2offer_cmu23xlu94q0y1p2y632v5u02";
const DEFAULT_CONV = "0c8c557f-6659-4bf2-9dc7-6a62991ba503";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localWallIso(date: Date, iana: string): string {
  const p = zonedDateParts(date, iana);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:00`;
}

function localDate(date: Date, iana: string): string {
  const p = zonedDateParts(date, iana);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function localTime(date: Date, iana: string): string {
  const p = zonedDateParts(date, iana);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

async function fetchGraphJson(
  token: string,
  url: string,
  prefer?: string,
): Promise<{ status: number; json: Record<string, unknown>; headers: Record<string, string> }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(url, { headers });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json, headers };
}

async function main() {
  const prisma = getPrisma();

  let idem = await prisma.voiceV2BookingIdempotency.findFirst({
    where: process.env.OFFER_SET_ID
      ? { offerSetId: process.env.OFFER_SET_ID }
      : { workspaceId: WORKSPACE_ID },
    orderBy: { createdAt: "desc" },
  });
  if (!idem && process.env.EVENT_ID) {
    idem = await prisma.voiceV2BookingIdempotency.findFirst({
      where: { microsoftEventId: process.env.EVENT_ID },
    });
  }
  if (!idem) throw new Error("no_booking_idempotency_row");

  const offerSetId = process.env.OFFER_SET_ID || idem.offerSetId;
  const eventId = process.env.EVENT_ID || idem.microsoftEventId;
  if (!eventId) throw new Error("no_event_id");

  const offer = await prisma.voiceV2OfferSet.findUnique({ where: { id: offerSetId } });
  if (!offer) throw new Error("offer_set_not_found");

  const slots = Array.isArray(offer.slotsJson)
    ? (offer.slotsJson as VoiceV2Slot[])
    : [];
  const selectedId = idem.slotId;
  const selected = slots.find((s) => s.slot_id === selectedId);

  console.log("\n========== 1. OFFER SET ==========");
  console.log({
    offer_set_id: offer.id,
    workspace_id: offer.workspaceId,
    voice_call_id: offer.voiceCallId,
    created_at: offer.createdAt.toISOString(),
    expires_at: offer.expiresAt.toISOString(),
    service_name: offer.serviceName,
    offer_iana_timezone: offer.timezone,
    connection_id: offer.connectionId,
  });

  console.log("\n--- All slots (canonical persisted) ---");
  for (const s of slots) {
    const start = new Date(s.start_utc);
    const end = new Date(s.end_utc);
    const iana = offer.timezone;
    const row = {
      slot_id: s.slot_id,
      local_date: localDate(start, iana),
      local_start_time: localTime(start, iana),
      local_end_time: localTime(end, iana),
      iana_timezone: iana,
      utc_start: s.start_utc,
      utc_end: s.end_utc,
      spoken_label: s.spoken_label || s.label,
      SELECTED: s.slot_id === selectedId,
    };
    console.log(row);
  }

  console.log("\n========== 2. TELNYX BOOK TOOL CALL ==========");
  const convId = process.env.CONVERSATION_ID || DEFAULT_CONV;
  let telnyxBookArgs: Record<string, unknown> | null = null;
  try {
    const msgs = await ai.listConversationMessages(convId, {});
    const mdata = (msgs as { data?: unknown[] }).data || [];
    const messages = (Array.isArray(mdata) ? mdata : []).sort((a, b) => {
      const ta = new Date(String((a as Record<string, unknown>).created_at)).getTime();
      const tb = new Date(String((b as Record<string, unknown>).created_at)).getTime();
      return ta - tb;
    });
    for (const m of messages) {
      const msg = m as Record<string, unknown>;
      const tcs = msg.tool_calls as Array<Record<string, unknown>> | undefined;
      if (!tcs) continue;
      for (const tc of tcs) {
        const fn = tc.function as Record<string, unknown> | undefined;
        if (fn?.name === "voice_v2_book_offered_slot") {
          telnyxBookArgs = JSON.parse(String(fn.arguments || "{}")) as Record<string, unknown>;
          console.log("tool_invocation_id (Telnyx):", tc.id);
          console.log("arguments:", telnyxBookArgs);
        }
      }
    }
    if (!telnyxBookArgs) console.log("(no voice_v2_book_offered_slot tool_call in conversation", convId, ")");
  } catch (err) {
    console.log("Telnyx fetch failed:", err instanceof Error ? err.message : err);
  }

  console.log("\n--- Backend resolved slot (from selected_slot_id) ---");
  console.log(
    selected
      ? {
          slot_id: selected.slot_id,
          spoken_label: selected.spoken_label || selected.label,
          utc_start: selected.start_utc,
          utc_end: selected.end_utc,
          local_start: localWallIso(new Date(selected.start_utc), offer.timezone),
          local_end: localWallIso(new Date(selected.end_utc), offer.timezone),
          iana_timezone: offer.timezone,
        }
      : "SELECTED_SLOT_NOT_IN_OFFER_JSON",
  );

  const bookingCfg = await loadMctbAiBookingConfig(WORKSPACE_ID);
  const workspaceTz = bookingCfg.timezone?.trim() || "(unset)";

  const startUtc = selected ? new Date(selected.start_utc) : new Date();
  const endUtc = selected ? new Date(selected.end_utc) : new Date();
  const iana = offer.timezone;

  const graphPostStart = toMicrosoftDateTimeTimeZone(startUtc, iana);
  const graphPostEnd = toMicrosoftDateTimeTimeZone(endUtc, iana);

  console.log("\n========== 3. GRAPH CREATE REQUEST (reconstructed from V2 code path) ==========");
  console.log("Code: insertMicrosoftEvent → toMicrosoftDateTimeTimeZone(date, event.timezone)");
  console.log("Endpoint: POST", `${MICROSOFT_GRAPH_V1}/me/events`);
  console.log(
    JSON.stringify(
      {
        subject: `${offer.serviceName} — Voice booking`,
        start: graphPostStart,
        end: graphPostEnd,
        transactionId: idem.idempotencyKey,
      },
      null,
      2,
    ),
  );
  console.log("\nCANONICAL_SLOT_LOCAL_START =", localWallIso(startUtc, iana));
  console.log("CANONICAL_SLOT_LOCAL_END   =", localWallIso(endUtc, iana));
  console.log("CANONICAL_SLOT_IANA_TIMEZONE =", iana);
  console.log("CANONICAL_SLOT_UTC_START   =", startUtc.toISOString());
  console.log("CANONICAL_SLOT_UTC_END     =", endUtc.toISOString());
  console.log("\nMicrosoft-documented shape (local wall + timezone name) WOULD BE:");
  console.log({
    start: { dateTime: localWallIso(startUtc, iana), timeZone: "(mailbox Windows TZ e.g. Pacific Standard Time)" },
    end: { dateTime: localWallIso(endUtc, iana), timeZone: "(mailbox Windows TZ)" },
  });

  const connectionId =
    offer.connectionId ||
    (await resolveMctbMicrosoftConnectionId(
      WORKSPACE_ID,
      bookingCfg.calendarId || bookingCfg.providerConnectionId,
    ));
  if (!connectionId) throw new Error("no_microsoft_connection");
  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId: WORKSPACE_ID, provider: "microsoft" },
  });
  if (!conn) throw new Error("conn_not_found");
  const config = (conn.config || {}) as CalendarConfig;
  if (!hasOAuthTokens(config)) throw new Error("no_oauth");
  const token = await getValidAccessToken(conn.id, "microsoft", config);
  if (!token) throw new Error("no_token");

  const mailbox = await fetchGraphJson(
    token,
    `${MICROSOFT_GRAPH_V1}/me/mailboxSettings?$select=timeZone`,
  );
  const mailboxTz = String((mailbox.json as { timeZone?: string }).timeZone || config.mailboxTimezone || "");

  console.log("\n========== 5. MAILBOX / WORKSPACE TIMEZONES ==========");
  console.log("WORKSPACE_BOOKING_TIMEZONE =", workspaceTz);
  console.log("MICROSOFT_MAILBOX_TIMEZONE (live GET) =", mailboxTz);
  console.log("MICROSOFT_MAILBOX_TIMEZONE (conn.config) =", config.mailboxTimezone || "(unset)");
  console.log("OFFER_SET_TIMEZONE (used on create) =", offer.timezone);

  const eventUrl = `${MICROSOFT_GRAPH_V1}/me/events/${encodeURIComponent(eventId)}`;
  const getDefault = await fetchGraphJson(token, eventUrl);
  const preferTz = mailboxTz || "Pacific Standard Time";
  const getPrefer = await fetchGraphJson(
    token,
    eventUrl,
    `outlook.timezone="${preferTz}"`,
  );

  console.log("\n========== 4. GRAPH GET EVENT (stored by Microsoft) ==========");
  console.log("event.id =", eventId);
  console.log("\n--- GET (no Prefer) status", getDefault.status, "---");
  console.log(JSON.stringify(getDefault.json, null, 2));
  console.log("\n--- GET Prefer: outlook.timezone=\"" + preferTz + "\" status", getPrefer.status, "---");
  console.log(JSON.stringify(getPrefer.json, null, 2));

  const ev = getDefault.json as Record<string, unknown>;
  const start = ev.start as Record<string, string> | undefined;
  const end = ev.end as Record<string, string> | undefined;

  console.log("\n========== 6. COMPLETE CHAIN ==========");
  console.log('CALLER_SELECTION: "four" (from Telnyx transcript; no day stated at selection)');
  console.log(
    "OFFER_SET_DATE (from slot local_date of selected):",
    selected ? localDate(new Date(selected.start_utc), iana) : "?",
  );
  console.log(
    "SELECTED_SLOT:",
    selected
      ? `${localTime(new Date(selected.start_utc), iana)} local in ${iana} on ${localDate(new Date(selected.start_utc), iana)}`
      : idem.slotId,
  );
  console.log("SELECTED_SLOT_UTC:", selected?.start_utc || "?");
  console.log("GRAPH_POST_START: dateTime=" + graphPostStart.dateTime + " timeZone=" + graphPostStart.timeZone);
  console.log("GRAPH_POST_END:   dateTime=" + graphPostEnd.dateTime + " timeZone=" + graphPostEnd.timeZone);
  console.log(
    "GRAPH_STORED_START: dateTime=" +
      (start?.dateTime || "?") +
      " timeZone=" +
      (start?.timeZone || "?"),
  );
  console.log("originalStartTimeZone =", ev.originalStartTimeZone);
  console.log("originalEndTimeZone =", ev.originalEndTimeZone);
  console.log("MICROSOFT_MAILBOX_TIMEZONE:", mailboxTz);
  console.log(
    "EXPECTED_OUTLOOK_DISPLAY (if instant correct):",
    selected ? `${selected.spoken_label || selected.label} on ${localDate(new Date(selected.start_utc), iana)} in mailbox TZ ${mailboxTz}` : "?",
  );
  console.log("ACTUAL_SCREENSHOT_DISPLAY: approximately 2 AM Wednesday (user report)");

  const postLooksLikeUtcInLocalField =
    graphPostStart.dateTime.includes("T23:00:00") &&
    localWallIso(startUtc, iana).includes("T16:00:00");

  let classification = "F. MULTIPLE_ISSUES";
  if (postLooksLikeUtcInLocalField) {
    classification = "C. SLOT_TO_GRAPH_SERIALIZATION_WRONG";
  }

  const postMatchesCanonical =
    graphPostStart.dateTime === localWallIso(startUtc, iana) &&
    graphPostStart.timeZone === "Pacific Standard Time";
  console.log("\nPOST_MATCHES_CANONICAL_LOCAL_WALL:", postMatchesCanonical);
  console.log("\nCLASSIFICATION (preliminary):", postMatchesCanonical ? "OK_AFTER_FIX" : classification);

  const audit = await prisma.auditLog.findFirst({
    where: { event: "voice_v2.pstn_book_trace", detail: { contains: offerSetId } },
    orderBy: { createdAt: "desc" },
  });
  if (audit?.detail) {
    console.log("\n--- voice_v2.pstn_book_trace ---");
    console.log(audit.detail);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
