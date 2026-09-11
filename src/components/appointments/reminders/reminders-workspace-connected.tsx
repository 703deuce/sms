"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Bell } from "lucide-react";
import type { ReminderItem, RemindersSectionId } from "@/features/appointments/kimi/reminders/types";
import { REMINDERS_SECTIONS } from "./reminders-section-types";
import { RemindersSequenceSection } from "./reminders-sequence-section";
import { RemindersStepDrawer } from "./reminders-step-drawer";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

type WorkspaceData = {
  stats: {
    activeSteps: number;
    channels: string;
    offeringsCount: number;
    coveragePercent: number;
    scheduledCount: number;
    sentToday: number;
    failed7d: number;
  };
  offerings: Array<{
    id: string;
    name: string;
    kind: string;
    sequenceLabel: string;
    stepCount: number;
    channels: string;
    status: string;
  }>;
  activity: Array<{
    id: string;
    at: string;
    customerLabel: string;
    bookingLabel: string;
    reminderLabel: string;
    channel: string;
    status: string;
    detail?: string;
    appointmentId: string;
  }>;
  readiness: { sms: string; email: string };
  timezone: string;
};

type Props = {
  model: { reminders: ReminderItem[]; mergeTags: string[] };
  saved: boolean;
  saving: boolean;
  onSave: () => void;
  onToggle: (stepKey: string) => void;
  onTemplateChange: (stepKey: string, template: string) => void;
  onChannelChange: (stepKey: string, channel: import("@/lib/appointments/types").ReminderChannel) => void;
  onResetTemplate: (stepKey: string) => void;
  onMinutesBeforeChange: (stepKey: string, minutes: number) => void;
  onAddStep: () => void;
  onRemoveStep: (stepKey: string) => void;
  onAdvancedChange: (stepKey: string, patch: Record<string, unknown>) => void;
  testPhone: string;
  testStep: string;
  testing: boolean;
  testSent: boolean;
  testError: string;
  onTestPhoneChange: (v: string) => void;
  onTestStepChange: (v: string) => void;
  onSendTest: () => void;
};

export function RemindersWorkspaceConnected(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as RemindersSectionId) || "overview";
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [editStepKey, setEditStepKey] = useState<string | null>(null);

  const setSection = useCallback(
    (id: RemindersSectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/reminders?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    void fetch("/api/appointments/reminders/workspace")
      .then((r) => r.json())
      .then((json) => setWorkspace(json.data as WorkspaceData))
      .catch(() => setWorkspace(null));
  }, [props.saved]);

  const editStep = useMemo(
    () => props.model.reminders.find((r) => r.stepKey === editStepKey) || null,
    [editStepKey, props.model.reminders],
  );

  const activeSection = REMINDERS_SECTIONS.find((s) => s.id === section);

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto flex w-full max-w-[1560px] flex-col">
        <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <div className="ws-event-head-main min-w-0">
            <div className="flex items-start gap-3">
              <span className="ws-icon-tile mt-0.5" aria-hidden>
                <Bell className="h-4 w-4" />
              </span>
              <div>
                <h1 className="ws-event-title">Reminders</h1>
                <p className="ws-event-subtitle">
                  Automate booking confirmations and time-based appointment reminders.
                </p>
              </div>
            </div>
          </div>
          <div className="ws-event-head-actions flex shrink-0 items-center gap-2">
            <button type="button" className="ws-secondary-btn" onClick={() => setSection("sequence")}>
              Preview sequence
            </button>
            {props.saved && !props.saving ? (
              <span className="text-sm text-[var(--state-success)]" role="status">Saved ✓</span>
            ) : null}
            <button type="button" className="appt-pilot-primary-btn" disabled={props.saving} onClick={props.onSave}>
              {props.saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </header>

        {workspace ? (
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:px-6">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Active sequence", value: `${workspace.stats.activeSteps} steps` },
                { label: "Channels", value: workspace.stats.channels },
                { label: "Offerings", value: workspace.stats.offeringsCount },
                { label: "Scheduled", value: workspace.stats.scheduledCount },
                { label: "Sent today", value: workspace.stats.sentToday },
                { label: "Failed (7d)", value: workspace.stats.failed7d },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                    {item.label}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 lg:hidden">
          <select
            className="input"
            value={section}
            onChange={(e) => setSection(e.target.value as RemindersSectionId)}
            aria-label="Reminders section"
          >
            {REMINDERS_SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <nav className="ws-section-tabs hidden overflow-x-auto lg:flex" aria-label="Reminders sections">
          {REMINDERS_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="ws-section-tab shrink-0"
              aria-current={section === s.id ? "page" : undefined}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 lg:px-6">
          {activeSection ? (
            <p className="mb-3 text-sm text-[var(--text-secondary)] lg:hidden">{activeSection.description}</p>
          ) : null}

          {section === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-5 space-y-4">
                <div className="ws-panel p-4">
                  <h2 className="text-sm font-semibold">Sequence summary</h2>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {props.model.reminders
                      .filter((r) => r.enabled)
                      .map((r) => (
                        <li key={r.stepKey} className="flex justify-between gap-2 border-b border-[var(--border)] py-1">
                          <span className="text-[var(--text-secondary)]">{r.badge}</span>
                          <span className="truncate font-medium capitalize">{r.channel} · {r.title}</span>
                        </li>
                      ))}
                  </ul>
                  <button type="button" className="ws-text-btn mt-2 text-sm" onClick={() => setSection("sequence")}>
                    Edit sequence
                  </button>
                </div>
                <div className="ws-panel p-4 text-sm">
                  <h2 className="font-semibold">Delivery health</h2>
                  <p className="mt-2">SMS: {workspace?.readiness.sms || "—"}</p>
                  <p>Email: {workspace?.readiness.email || "—"}</p>
                  {workspace && workspace.stats.failed7d > 0 ? (
                    <button type="button" className="ws-text-btn mt-2" onClick={() => setSection("activity")}>
                      View {workspace.stats.failed7d} failure(s)
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="ws-panel p-4">
                  <h2 className="text-sm font-semibold">Customer preview</h2>
                  <div className="mt-3 space-y-3">
                    {props.model.reminders
                      .filter((r) => r.enabled)
                      .map((r) => (
                        <div key={r.stepKey} className="border-b border-[var(--border)] pb-2">
                          <p className="text-xs font-medium uppercase text-[var(--accent)]">{r.badge}</p>
                          <p className="text-xs capitalize text-[var(--text-secondary)]">{r.channel}</p>
                          <p className="mt-1 text-sm whitespace-pre-wrap">{r.preview || r.template}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {section === "sequence" ? (
            <RemindersSequenceSection
              steps={props.model.reminders}
              onToggle={props.onToggle}
              onEdit={setEditStepKey}
              onAdd={props.onAddStep}
              onMinutesChange={props.onMinutesBeforeChange}
            />
          ) : null}

          {section === "assignment" ? (
            <div className="ws-panel overflow-x-auto">
              <p className="border-b border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                All offerings use the workspace default sequence today. Per-offering custom sequences are not yet
                stored on booking types — use Workflows for advanced branching.
              </p>
              <table className="ws-table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th>Offering</th>
                    <th>Type</th>
                    <th>Sequence</th>
                    <th>Steps</th>
                    <th>Channels</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(workspace?.offerings || []).map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium">{row.name}</td>
                      <td className="capitalize">{row.kind}</td>
                      <td><span className="ws-chip ws-chip-neutral">{row.sequenceLabel}</span></td>
                      <td>{row.stepCount}</td>
                      <td>{row.channels}</td>
                      <td><span className="ws-chip ws-chip-success">{row.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {section === "templates" ? (
            <div className="ws-panel overflow-x-auto">
              <table className="ws-table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Channel</th>
                    <th>Timing</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {props.model.reminders.map((r) => (
                    <tr key={r.stepKey}>
                      <td className="font-medium">{r.title}</td>
                      <td className="capitalize">{r.channel}</td>
                      <td>{r.badge}</td>
                      <td>—</td>
                      <td>
                        <button type="button" className="ws-text-btn" onClick={() => setEditStepKey(r.stepKey)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {section === "activity" ? (
            <div className="ws-panel overflow-x-auto">
              {!workspace?.activity.length ? (
                <p className="p-8 text-center text-sm text-[var(--text-secondary)]">No reminder activity yet.</p>
              ) : (
                <table className="ws-table w-full min-w-[900px]">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Customer</th>
                      <th>Booking</th>
                      <th>Reminder</th>
                      <th>Channel</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.activity.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap text-[var(--text-secondary)]">
                          {new Date(row.at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>{row.customerLabel}</td>
                        <td>
                          <Link href={`/appointments/${row.appointmentId}`} className="ws-text-btn">
                            {row.bookingLabel}
                          </Link>
                        </td>
                        <td>{row.reminderLabel}</td>
                        <td>{row.channel}</td>
                        <td>
                          <span
                            className={`ws-chip ${
                              row.status === "Failed"
                                ? "ws-chip-warning"
                                : row.status === "Skipped"
                                  ? "ws-chip-neutral"
                                  : "ws-chip-success"
                            }`}
                          >
                            {row.status}
                          </span>
                          {row.detail ? (
                            <span className="ml-1 text-xs text-[var(--text-secondary)]">{row.detail}</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}

          {section === "settings" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="ws-panel p-4 text-sm">
                <h2 className="font-semibold">Timezone</h2>
                <p className="mt-1">{workspace?.timezone || "America/New_York"}</p>
                <p className="mt-2 text-[var(--text-secondary)]">
                  Reminder fire times are calculated from appointment start in this timezone.
                </p>
                <Link href="/appointments/availability" className="ws-text-btn mt-2 inline-flex">Availability settings</Link>
              </div>
              <div className="ws-panel p-4 text-sm">
                <h2 className="font-semibold">Messaging</h2>
                <p className="mt-1">SMS and email use canonical workspace messaging configuration.</p>
                <Link href="/settings/merchant-payments" className="ws-text-btn mt-2 inline-flex">Manage messaging</Link>
              </div>
              <div className="ws-panel p-4 text-sm lg:col-span-2">
                <h2 className="font-semibold">Send test</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className="input min-w-[200px]"
                    placeholder="Mobile number"
                    value={props.testPhone}
                    onChange={(e) => props.onTestPhoneChange(e.target.value)}
                  />
                  <select
                    className="input"
                    value={props.testStep}
                    onChange={(e) => props.onTestStepChange(e.target.value)}
                  >
                    {props.model.reminders.map((r) => (
                      <option key={r.stepKey} value={r.stepKey}>{r.title}</option>
                    ))}
                  </select>
                  <button type="button" className="appt-pilot-primary-btn" disabled={props.testing} onClick={props.onSendTest}>
                    {props.testing ? "Sending…" : "Send test"}
                  </button>
                </div>
                {props.testError ? <p className="ws-inline-error mt-2">{props.testError}</p> : null}
                {props.testSent ? <p className="mt-2 text-sm text-[var(--state-success)]">Test sent.</p> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <RemindersStepDrawer
        step={editStep}
        onClose={() => setEditStepKey(null)}
        onTemplateChange={(t) => editStepKey && props.onTemplateChange(editStepKey, t)}
        onChannelChange={(c) => editStepKey && props.onChannelChange(editStepKey, c)}
        onReset={() => editStepKey && props.onResetTemplate(editStepKey)}
        onRemove={
          editStep?.isCustom && editStepKey
            ? () => {
                props.onRemoveStep(editStepKey);
                setEditStepKey(null);
              }
            : undefined
        }
        onAdvancedChange={(patch) => editStepKey && props.onAdvancedChange(editStepKey, patch)}
      />
    </div>
  );
}
