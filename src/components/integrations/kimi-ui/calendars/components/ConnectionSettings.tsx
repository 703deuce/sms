"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "./ui/Button";
import { providerCalendarsByConnection, type CalendarConnection, type ProviderCalendar } from "../types";

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="sb-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

function CalendarChecklist({
  calendars,
  selected,
  onToggle,
  disabled,
}: {
  calendars: ProviderCalendar[];
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-white p-1.5">
      {calendars.map((cal) => {
        const on = selected.includes(cal.id);
        return (
          <label
            key={cal.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-[var(--muted)]"
          >
            <input
              type="checkbox"
              checked={on}
              disabled={disabled}
              onChange={() => onToggle(cal.id)}
              className="h-3.5 w-3.5 accent-[var(--primary)]"
            />
            <span className="truncate text-[var(--foreground)]">{cal.name}</span>
            {cal.primary ? (
              <span className="sb-chip sb-chip-info ml-auto flex-none">Primary</span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

export function ConnectionSettings({
  connection,
  saving,
  readOnly = false,
  onSave,
}: {
  connection: CalendarConnection;
  saving: boolean;
  readOnly?: boolean;
  onSave: (config: NonNullable<CalendarConnection["config"]>) => Promise<void>;
}) {
  const connected = connection.status === "connected";
  const editable = connected && !readOnly;
  const [calendars, setCalendars] = useState<ProviderCalendar[] | null>(null);
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const [writeCalendarId, setWriteCalendarId] = useState(connection.config?.writeCalendarId ?? "");
  const [blockingIds, setBlockingIds] = useState<string[]>(connection.config?.blockingCalendarIds ?? []);
  const [importIds, setImportIds] = useState<string[]>(connection.config?.importCalendarIds ?? []);
  const [syncEnabled, setSyncEnabled] = useState(connection.config?.syncEnabled ?? true);
  const [requireExternalAttendees, setRequireExternalAttendees] = useState(
    connection.config?.importRules?.requireExternalAttendees ?? true,
  );
  const [requireAttendeeEmail, setRequireAttendeeEmail] = useState(
    connection.config?.importRules?.requireAttendeeEmail ?? true,
  );
  const [skipAllDay, setSkipAllDay] = useState(connection.config?.importRules?.skipAllDay ?? true);
  const [excludePatterns, setExcludePatterns] = useState(
    (connection.config?.importRules?.titleExcludePatterns ?? []).join(", "),
  );

  useEffect(() => {
    setCalendarsLoading(true);
    // Sandbox: mock-data stands in for GET /api/integrations/calendars/${id}/provider-calendars
    const t = setTimeout(() => {
      setCalendars(providerCalendarsByConnection[connection.id] ?? []);
      setCalendarsLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [connection.id]);

  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const showImportRules = importIds.length > 0;

  return (
    <div className="mt-3 space-y-5 rounded-lg border border-[var(--border)] bg-[#fafbfd] p-4">
      {/* Sync */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-[var(--foreground)]">Calendar sync</p>
          <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
            {connected
              ? "Keep this connection in sync. Pause to stop writing and importing events."
              : "Reconnect this calendar to resume sync."}
          </p>
        </div>
        <Toggle checked={syncEnabled} onChange={setSyncEnabled} disabled={!editable} label="Calendar sync" />
      </div>

      <div className="h-px bg-[var(--border)]" />

      {/* Write calendar */}
      <div>
        <label htmlFor={`write-${connection.id}`} className="sb-field-label">
          Calendar for new appointments
        </label>
        {calendarsLoading ? (
          <div className="sb-skeleton h-9 w-full" />
        ) : (
          <select
            id={`write-${connection.id}`}
            className="sb-select max-w-sm"
            value={writeCalendarId}
            disabled={!editable}
            onChange={(e) => setWriteCalendarId(e.target.value)}
          >
            <option value="">Select a calendar…</option>
            {(calendars ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <p className="sb-field-help">
          Appointments created in Transovo are written to this calendar.
        </p>
      </div>

      {/* Blocking calendars */}
      <div>
        <span className="sb-field-label">Calendars that block availability</span>
        {calendarsLoading ? (
          <div className="sb-skeleton h-24 w-full" />
        ) : (
          <CalendarChecklist
            calendars={calendars ?? []}
            selected={blockingIds}
            disabled={!editable}
            onToggle={(id) => setBlockingIds((l) => toggleIn(l, id))}
          />
        )}
        <p className="sb-field-help">
          Busy events on selected calendars make those times unavailable for booking.
        </p>
      </div>

      {/* Import calendars */}
      <div>
        <span className="sb-field-label">Import events as appointments</span>
        {calendarsLoading ? (
          <div className="sb-skeleton h-24 w-full" />
        ) : (
          <CalendarChecklist
            calendars={calendars ?? []}
            selected={importIds}
            disabled={!editable}
            onToggle={(id) => setImportIds((l) => toggleIn(l, id))}
          />
        )}
        <p className="sb-field-help">
          Events on selected calendars become Transovo appointments and can receive reminders.
        </p>
      </div>

      {/* Import rules — progressive disclosure */}
      {showImportRules ? (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-white p-3.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
            Import rules
          </p>
          {(
            [
              {
                label: "Only import events with external attendees",
                value: requireExternalAttendees,
                set: setRequireExternalAttendees,
              },
              {
                label: "Require an attendee email address",
                value: requireAttendeeEmail,
                set: setRequireAttendeeEmail,
              },
              { label: "Skip all-day events", value: skipAllDay, set: setSkipAllDay },
            ] as const
          ).map((rule) => (
            <div key={rule.label} className="flex items-center justify-between gap-4">
              <span className="text-[13px] text-[var(--foreground)]">{rule.label}</span>
              <Toggle
                checked={rule.value}
                onChange={rule.set}
                disabled={!editable}
                label={rule.label}
              />
            </div>
          ))}
          <div>
            <label htmlFor={`exclude-${connection.id}`} className="sb-field-label">
              Skip events whose title contains
            </label>
            <input
              id={`exclude-${connection.id}`}
              className="sb-input max-w-sm"
              placeholder="e.g. lunch, personal"
              value={excludePatterns}
              disabled={!editable}
              onChange={(e) => setExcludePatterns(e.target.value)}
            />
            <p className="sb-field-help">Comma-separated. Matching is case-insensitive.</p>
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            size="sm"
            disabled={saving || (!connected && !syncEnabled)}
            onClick={() =>
              void onSave({
                ...connection.config,
                writeCalendarId,
                blockingCalendarIds: blockingIds,
                importCalendarIds: importIds,
                syncEnabled,
                importRules: {
                  requireExternalAttendees,
                  requireAttendeeEmail,
                  skipAllDay,
                  titleExcludePatterns: excludePatterns
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
          >
            {saving ? <Loader2 className="sb-spin h-3.5 w-3.5" /> : null}
            Save connection settings
          </Button>
        </div>
      ) : null}
    </div>
  );
}
