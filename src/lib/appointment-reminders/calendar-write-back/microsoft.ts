import "server-only";

import {
  microsoftGraphFetch,
  type CalendarConfig,
} from "@/lib/calendar/providers";
import { MICROSOFT_GRAPH_V1 } from "@/lib/microsoft/graph-helpers";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import {
  buildTransovoStatusHtml,
  buildTransovoStatusPlainText,
  mergeTransovoStatusIntoBody,
  statusBlockForKind,
} from "./status-block";
import { mergeTransovoOutlookCategories } from "./categories";
import type { ArCalendarWriteBackJobPayload } from "./types";

type MicrosoftEventBody = {
  id: string;
  subject?: string;
  body?: { contentType?: string; content?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  "@odata.etag"?: string;
  changeKey?: string;
  isCancelled?: boolean;
  categories?: string[];
};

async function fetchMicrosoftEventFull(input: {
  connectionId: string;
  config: CalendarConfig;
  providerEventId: string;
  providerCalendarId?: string;
}): Promise<
  | { ok: true; event: MicrosoftEventBody }
  | { ok: false; reason: "not_found" | "auth" | "error"; message: string }
> {
  const calendarPath = input.providerCalendarId
    ? `/me/calendars/${encodeURIComponent(input.providerCalendarId)}/events/${encodeURIComponent(input.providerEventId)}`
    : `/me/events/${encodeURIComponent(input.providerEventId)}`;
  const url = `${MICROSOFT_GRAPH_V1}${calendarPath}?$select=id,subject,body,start,end,isCancelled,changeKey,categories`;
  const res = await microsoftGraphFetch(input.connectionId, input.config, url);
  if (res.status === 404) return { ok: false, reason: "not_found", message: "Event not found" };
  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: "auth", message: `Graph ${res.status}` };
  }
  if (!res.ok) {
    return { ok: false, reason: "error", message: `Graph ${res.status}` };
  }
  const event = (await res.json()) as MicrosoftEventBody;
  if (!event.id) return { ok: false, reason: "error", message: "Malformed event" };
  return { ok: true, event };
}

function etagFromEvent(event: MicrosoftEventBody): string | undefined {
  return event["@odata.etag"] || event.changeKey;
}

export async function applyMicrosoftCalendarWriteBack(input: {
  workspaceId: string;
  appointment: {
    id: string;
    externalId: string | null;
    metadata: unknown;
    startsAt: Date;
    endsAt: Date;
    timezone: string | null;
  };
  connectionId: string;
  config: CalendarConfig;
  job: ArCalendarWriteBackJobPayload;
  colorCodingEnabled: boolean;
}): Promise<
  | { ok: true; skipped?: boolean; providerEtag?: string }
  | { ok: false; retryable: boolean; message: string }
> {
  const ref = providerRefFromAppointment(input.appointment);
  if (!ref || ref.provider !== "microsoft") {
    return { ok: false, retryable: false, message: "Not a Microsoft-linked appointment" };
  }

  const fetched = await fetchMicrosoftEventFull({
    connectionId: input.connectionId,
    config: input.config,
    providerEventId: ref.providerEventId,
    providerCalendarId: ref.providerCalendarId,
  });
  if (!fetched.ok) {
    const retryable = fetched.reason === "error";
    return { ok: false, retryable, message: fetched.message };
  }
  if (fetched.event.isCancelled && input.job.kind !== "canceled") {
    return { ok: true, skipped: true };
  }

  const meta = (input.appointment.metadata || {}) as { arCalendarWriteBack?: { lastProviderEtag?: string } };
  const priorEtag = meta.arCalendarWriteBack?.lastProviderEtag;
  const block = statusBlockForKind({
    kind: input.job.kind,
    atIso: input.job.atIso,
    timezone: input.job.timezone,
    previousStartsAtIso: input.job.previousStartsAtIso,
    newStartsAtIso: input.job.newStartsAtIso,
  });

  const existingBody = fetched.event.body?.content || "";
  const contentType =
    fetched.event.body?.contentType?.toLowerCase() === "html" ? "html" : "text";
  const section =
    contentType === "html"
      ? buildTransovoStatusHtml(block)
      : buildTransovoStatusPlainText(block);
  const merged = mergeTransovoStatusIntoBody(existingBody, contentType, section);

  const patchBody: Record<string, unknown> = {
    body: {
      contentType: contentType === "html" ? "HTML" : "text",
      content: merged,
    },
    categories: mergeTransovoOutlookCategories(
      fetched.event.categories,
      input.job.kind,
      input.colorCodingEnabled,
    ),
  };

  const calendarPath = ref.providerCalendarId
    ? `/me/calendars/${encodeURIComponent(ref.providerCalendarId)}/events/${encodeURIComponent(ref.providerEventId)}`
    : `/me/events/${encodeURIComponent(ref.providerEventId)}`;

  const res = await microsoftGraphFetch(
    input.connectionId,
    input.config,
    `${MICROSOFT_GRAPH_V1}${calendarPath}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: 'outlook.timezone="' + input.job.timezone + '"' },
      body: JSON.stringify(patchBody),
    },
  );

  if (res.status === 429 || res.status >= 500) {
    return { ok: false, retryable: true, message: `Graph PATCH ${res.status}` };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, retryable: false, message: `Graph PATCH ${res.status}` };
  }
  if (res.status === 404) {
    return { ok: false, retryable: false, message: "Event not found on calendar" };
  }
  if (!res.ok) {
    return { ok: false, retryable: false, message: `Graph PATCH ${res.status}` };
  }

  const etag = etagFromEvent(fetched.event);
  if (priorEtag && etag && priorEtag === etag && merged === existingBody) {
    return { ok: true, skipped: true, providerEtag: etag };
  }

  return { ok: true, providerEtag: etag };
}
