/**
 * Human-visible Transovo status block for provider calendar event bodies.
 */

export const TRANSOVO_STATUS_MARKER = "TRANSOVO APPOINTMENT STATUS";
export const TRANSOVO_STATUS_HTML_BEGIN = "<!-- TRANSOVO-AR-STATUS-BEGIN -->";
export const TRANSOVO_STATUS_HTML_END = "<!-- TRANSOVO-AR-STATUS-END -->";

export type StatusBlockInput = {
  statusLabel: string;
  lines: string[];
  footer?: string;
};

export function buildTransovoStatusPlainText(input: StatusBlockInput): string {
  const footer = input.footer ?? "Managed by Transovo Appointment Reminders";
  return [
    "⸻",
    TRANSOVO_STATUS_MARKER,
    "",
    `Status: ${input.statusLabel}`,
    ...input.lines,
    "",
    footer,
  ].join("\n");
}

export function buildTransovoStatusHtml(input: StatusBlockInput): string {
  const plain = buildTransovoStatusPlainText(input);
  const escaped = plain
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "<br/>";
      return `<p style="margin:0 0 4px 0;">${escapeHtml(line)}</p>`;
    })
    .join("");
  return `${TRANSOVO_STATUS_HTML_BEGIN}<div data-transovo-ar-status="1">${escaped}</div>${TRANSOVO_STATUS_HTML_END}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PLAIN_SECTION_RE =
  /⸻\s*\n\s*TRANSOVO APPOINTMENT STATUS\n[\s\S]*?Managed by Transovo Appointment Reminders\s*/gi;

const HTML_SECTION_RE = new RegExp(
  `${TRANSOVO_STATUS_HTML_BEGIN}[\\s\\S]*?${TRANSOVO_STATUS_HTML_END}`,
  "gi",
);

export function stripTransovoStatusSection(content: string): string {
  let next = content.replace(HTML_SECTION_RE, "").trim();
  next = next.replace(PLAIN_SECTION_RE, "").trim();
  return next.replace(/\n{3,}/g, "\n\n").trim();
}

export function mergeTransovoStatusIntoBody(
  existingContent: string,
  contentType: "html" | "text",
  section: string,
): string {
  const base = stripTransovoStatusSection(existingContent);
  const spacer = base.length ? (contentType === "html" ? "<br/><br/>" : "\n\n") : "";
  return `${base}${spacer}${section}`.trim();
}

export function formatStatusInstant(iso: string, timezone: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: timezone,
    });
  } catch {
    return iso;
  }
}

export function statusBlockForKind(input: {
  kind: import("./types").ArCalendarWriteBackKind;
  atIso: string;
  timezone: string;
  previousStartsAtIso?: string;
  previousEndsAtIso?: string;
  newStartsAtIso?: string;
  newEndsAtIso?: string;
}): StatusBlockInput {
  const atLabel = formatStatusInstant(input.atIso, input.timezone);
  switch (input.kind) {
    case "confirmed":
      return {
        statusLabel: "Confirmed",
        lines: [`Confirmed: ${atLabel}`],
      };
    case "cancellation_requested":
      return {
        statusLabel: "Cancellation requested",
        lines: [`Requested: ${atLabel}`],
      };
    case "canceled":
      return {
        statusLabel: "Canceled",
        lines: [`Canceled: ${atLabel}`],
      };
    case "reschedule_requested":
      return {
        statusLabel: "Reschedule requested",
        lines: [`Requested: ${atLabel}`],
      };
    case "rescheduled": {
      const prev =
        input.previousStartsAtIso
          ? formatStatusInstant(input.previousStartsAtIso, input.timezone)
          : undefined;
      const next =
        input.newStartsAtIso
          ? formatStatusInstant(input.newStartsAtIso, input.timezone)
          : undefined;
      const lines = [
        ...(prev ? [`Previous time: ${prev}`] : []),
        ...(next ? [`New time: ${next}`] : []),
        `Updated: ${atLabel}`,
      ];
      return {
        statusLabel: "Rescheduled",
        lines,
      };
    }
    default:
      return { statusLabel: "Updated", lines: [`Updated: ${atLabel}`] };
  }
}
