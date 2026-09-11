"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDashed,
  ClipboardList,
  Copy,
  ExternalLink,
  Eye,
  LayoutGrid,
  MapPin,
  Settings2,
  Ticket,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import {
  Field,
  Panel,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/appointments/workspace-ui";
import type { WorkshopFormState } from "@/lib/appointments/workshops/workshop-form";
import {
  dateBlock,
  durationLabel,
  formatSessionDay,
  formatSessionTimes,
  primarySession,
  upcomingSessions,
  type WorkshopSessionRow,
} from "@/lib/appointments/workshops/workshop-schedule";
import {
  checkedInCount,
  locationLabel,
  workshopPriceLabel,
  workshopRegistrationState,
  workshopSeats,
} from "@/lib/appointments/workshops/workshop-summary";
import type { WorkshopRegistrant } from "@/features/appointments/kimi/workshops/use-workshop-editor";
import type { WorkshopSectionId } from "./workshop-section-types";

type Props = {
  form: WorkshopFormState;
  sessions: WorkshopSessionRow[];
  registrants: WorkshopRegistrant[];
  waitlistCount: number;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  intakeFormNames: Map<string, string>;
  bookingLink: string | null;
  copied: boolean;
  onFormChange: <K extends keyof WorkshopFormState>(key: K, value: WorkshopFormState[K]) => void;
  onNavigateSection: (id: WorkshopSectionId) => void;
  onPreview: () => void;
  onCopyLink: () => void;
};

const VISIBILITY_HINT: Record<WorkshopFormState["visibility"], string> = {
  public: "Listed on your public workshops page.",
  hidden: "Reachable only by staff — not listed publicly.",
};

export function WorkshopOverviewSection({
  form,
  sessions,
  registrants,
  waitlistCount,
  staffNames,
  locationNames,
  intakeFormNames,
  bookingLink,
  copied,
  onFormChange,
  onNavigateSection,
  onPreview,
  onCopyLink,
}: Props) {
  const session = primarySession(sessions);
  const upcoming = upcomingSessions(sessions);
  const active = registrants.filter((r) => r.status !== "cancelled");
  const seats = workshopSeats(form, sessions, active.length);
  const state = workshopRegistrationState(form, sessions, active.length);
  const host = form.staffId ? staffNames.get(form.staffId) || "Assigned" : "Not set";
  const place = locationLabel(form, locationNames);
  const fillPct = seats.capacity > 0 ? Math.min(100, (seats.registered / seats.capacity) * 100) : 0;
  const checkedIn = checkedInCount(registrants);
  const block = session ? dateBlock(session.startsAt) : null;

  const setupRows: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    section: WorkshopSectionId;
  }> = [
    {
      icon: CalendarDays,
      label: "Date & time",
      value: session
        ? `${formatSessionDay(session.startsAt)} · ${formatSessionTimes(session.startsAt, session.endsAt)}${
            sessions.filter((s) => s.status !== "cancelled").length > 1
              ? ` · ${sessions.filter((s) => s.status !== "cancelled").length} sessions`
              : ""
          }`
        : "No date set",
      section: "date-time",
    },
    {
      icon: MapPin,
      label: "Place",
      value: `${place} · ${host}${form.resourceIds.length ? ` · ${form.resourceIds.length} resources` : ""}`,
      section: "place",
    },
    {
      icon: Users,
      label: "Registration",
      value: `${seats.registered} / ${seats.capacity} · ${state.label}${form.waitlistEnabled ? " · waitlist on" : ""}`,
      section: "registration",
    },
    {
      icon: Wallet,
      label: "Pricing & access",
      value: `${workshopPriceLabel(form)}${form.memberOnly ? " · members only" : ""}${
        form.packageProductIds.length + form.membershipProductIds.length > 0
          ? ` · ${form.packageProductIds.length + form.membershipProductIds.length} entitlements`
          : ""
      }`,
      section: "pricing-access",
    },
    {
      icon: ClipboardList,
      label: "Customer setup",
      value:
        form.bookingQuestions.length || form.intakeFormIds.length
          ? `${form.bookingQuestions.length} question${form.bookingQuestions.length === 1 ? "" : "s"} · ${form.intakeFormIds.length} form${form.intakeFormIds.length === 1 ? "" : "s"}`
          : "Name and phone only",
      section: "customer-setup",
    },
    {
      icon: Settings2,
      label: "Advanced",
      value: [
        form.cancellationPolicy ? "Custom policy" : "Workspace policy",
        form.admissionEnabled ? "Check-in on" : "Check-in off",
        form.confirmationMessage ? "Custom confirmation" : "Default confirmation",
      ].join(" · "),
      section: "advanced",
    },
  ];

  const steps: Array<{
    label: string;
    done: boolean;
    section: WorkshopSectionId;
    blocker: string;
  }> = [
    {
      label: "Details",
      done: Boolean(form.name.trim()),
      section: "overview",
      blocker: "Give the workshop a name.",
    },
    {
      label: "Date",
      done: upcoming.length > 0,
      section: "date-time",
      blocker: "No upcoming date yet.",
    },
    {
      label: "Place",
      done: form.locationMode !== "in_person" || Boolean(form.locationId),
      section: "place",
      blocker: "No location chosen.",
    },
    { label: "Host", done: Boolean(form.staffId), section: "place", blocker: "No host assigned." },
    {
      label: "Capacity",
      done: form.capacity > 0,
      section: "registration",
      blocker: "Set how many people can register.",
    },
    {
      label: "Price",
      done: form.isFree || form.priceCents > 0,
      section: "pricing-access",
      blocker: "Set a price or mark the workshop free.",
    },
  ];
  const done = steps.filter((s) => s.done).length;

  const previewForms = form.intakeFormIds
    .map((id) => intakeFormNames.get(id))
    .filter(Boolean)
    .join(", ");

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Workshop details" icon={LayoutGrid} className="ws-span-7">
          <div className="space-y-3.5">
            <Field label="Name" htmlFor="wks-name">
              <TextInput
                id="wks-name"
                value={form.name}
                placeholder="SEO Masterclass"
                onChange={(e) => onFormChange("name", e.target.value)}
              />
            </Field>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field
                label="Category"
                htmlFor="wks-category"
                hint="Groups workshops on the public page."
              >
                <TextInput
                  id="wks-category"
                  value={form.category}
                  placeholder="Marketing"
                  onChange={(e) => onFormChange("category", e.target.value)}
                />
              </Field>
              <Field
                label="Visibility"
                htmlFor="wks-visibility"
                hint={VISIBILITY_HINT[form.visibility]}
              >
                <SelectInput
                  id="wks-visibility"
                  value={form.visibility}
                  onChange={(e) =>
                    onFormChange("visibility", e.target.value as WorkshopFormState["visibility"])
                  }
                >
                  <option value="public">Public</option>
                  <option value="hidden">Hidden</option>
                </SelectInput>
              </Field>
              <Field
                label="Status"
                htmlFor="wks-status"
                hint="Inactive workshops take no registrations."
              >
                <SelectInput
                  id="wks-status"
                  value={form.active ? "active" : "inactive"}
                  onChange={(e) => onFormChange("active", e.target.value === "active")}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </SelectInput>
              </Field>
            </div>
            <Field
              label="Description"
              htmlFor="wks-description"
              hint={`${form.description.length}/500 characters`}
            >
              <TextArea
                id="wks-description"
                rows={3}
                maxLength={500}
                value={form.description}
                placeholder="What this workshop covers, and who it suits."
                onChange={(e) => onFormChange("description", e.target.value)}
              />
            </Field>
            <Field
              label="Image URL"
              htmlFor="wks-image"
              hint="Shown beside the workshop on the public page."
            >
              <TextInput
                id="wks-image"
                type="url"
                placeholder="https://…"
                value={form.imageUrl}
                onChange={(e) => onFormChange("imageUrl", e.target.value)}
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Event snapshot"
          icon={CalendarDays}
          className="ws-span-5"
          actions={
            <button
              type="button"
              className="ws-text-btn"
              onClick={() => onNavigateSection("date-time")}
            >
              Manage date &amp; time
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </button>
          }
        >
          {session && block ? (
            <>
              <div className="ws-event-head">
                <span className="ws-date-block" aria-hidden>
                  <span className="ws-date-block-month">{block.month}</span>
                  <span className="ws-date-block-day">{block.day}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">
                    {formatSessionDay(session.startsAt)}
                  </p>
                  <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
                    {formatSessionTimes(session.startsAt, session.endsAt)}
                  </p>
                  <div className="ws-row-secondary mt-1">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {place}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="h-3 w-3" aria-hidden />
                      {host}
                    </span>
                  </div>
                </div>
              </div>
              <div className="ws-stat mt-3">
                <span className="ws-stat-value">{seats.registered}</span>
                <span className="ws-stat-unit">of {seats.capacity} registered</span>
              </div>
              <div className={`ws-meter${seats.remaining === 0 ? " is-full" : ""}`}>
                <span style={{ width: `${fillPct}%` }} />
              </div>
              <p className="ws-stat-note">
                {upcoming.length > 1
                  ? `Runs across ${upcoming.length} sessions.`
                  : `One session, ${durationLabel(
                      Math.round(
                        (new Date(session.endsAt).getTime() -
                          new Date(session.startsAt).getTime()) /
                          60_000,
                      ),
                    )}.`}
              </p>
            </>
          ) : (
            <div className="ws-empty-inline">
              <span className="ws-empty-inline-icon">
                <CalendarDays className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                  No date set
                </p>
                <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                  Customers cannot register until this workshop has a date.
                </p>
                <button
                  type="button"
                  className="ws-text-btn mt-1.5"
                  onClick={() => onNavigateSection("date-time")}
                >
                  Set the date
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Registration snapshot"
          icon={Users}
          className="ws-span-5"
          actions={
            <button
              type="button"
              className="ws-text-btn"
              onClick={() => onNavigateSection("registration")}
            >
              View registrations
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </button>
          }
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <p className="ws-summary-row-label">Registered</p>
              <div className="ws-stat">
                <span className="ws-stat-value">{seats.registered}</span>
              </div>
            </div>
            <div>
              <p className="ws-summary-row-label">Available</p>
              <div className="ws-stat">
                <span className="ws-stat-value">{seats.remaining}</span>
              </div>
            </div>
            <div>
              <p className="ws-summary-row-label">Waitlist</p>
              <div className="ws-stat">
                <span className="ws-stat-value">{waitlistCount}</span>
              </div>
            </div>
            {/* Check-in is only meaningful once admission is switched on, so it
                does not take a slot on every workshop. */}
            {form.admissionEnabled ? (
              <div>
                <p className="ws-summary-row-label">Checked in</p>
                <div className="ws-stat">
                  <span className="ws-stat-value">{checkedIn}</span>
                  <span className="ws-stat-unit">of {seats.registered}</span>
                </div>
              </div>
            ) : null}
          </div>
          <p className="ws-stat-note">
            <span
              className={`ws-chip ${
                state.tone === "open"
                  ? "ws-chip-success"
                  : state.tone === "full" || state.tone === "cancelled"
                    ? "ws-chip-warning"
                    : "ws-chip-neutral"
              }`}
            >
              {state.label}
            </span>{" "}
            {state.detail}
          </p>
        </Panel>

        <Panel
          title="Customer preview"
          icon={Eye}
          className="ws-span-7"
          actions={
            bookingLink ? (
              <>
                <button type="button" className="ws-text-btn" onClick={onPreview}>
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  Open
                </button>
                <button type="button" className="ws-text-btn" onClick={onCopyLink}>
                  {copied ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden />
                  )}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </>
            ) : null
          }
        >
          <p className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">
            {form.name.trim() || "Untitled workshop"}
          </p>
          <p className="mt-0.5 text-[var(--type-list)] text-[var(--text-secondary)]">
            {form.description.trim() || "No description yet."}
          </p>
          <div className="ws-row-secondary mt-2">
            <span>
              {session
                ? `${formatSessionDay(session.startsAt)} · ${formatSessionTimes(session.startsAt, session.endsAt)}`
                : "No date listed"}
            </span>
            <span>{place}</span>
            <span>{workshopPriceLabel(form)}</span>
            <span>
              {form.showRemainingSpots
                ? seats.remaining > 0
                  ? `${seats.remaining} spots left`
                  : "Full"
                : "Spots hidden"}
            </span>
            <span>{previewForms ? `Form: ${previewForms}` : "No form attached"}</span>
          </div>
          {form.cancelledAt ? (
            <p className="ws-stat-note">
              This workshop is cancelled, so the public page no longer offers it. The preview shows
              what it would say if you reopened it.
            </p>
          ) : form.visibility === "hidden" || !form.active ? (
            <p className="ws-stat-note">
              This workshop is not on the public page right now, so the preview is what it would
              show once it is listed.
            </p>
          ) : null}
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Setup summary"
          icon={Ticket}
          className="ws-span-12"
          flush
          actions={
            <span className="text-[var(--type-helper)] text-[var(--text-secondary)]">
              {done}/{steps.length} complete
            </span>
          }
        >
          <div className="ws-setup-progress" style={{ padding: "0.5rem 0.875rem" }}>
            {steps.map((step) =>
              step.done ? (
                <span key={step.label} className="done">
                  <Check className="mr-1 inline h-3 w-3" aria-hidden />
                  {step.label}
                  <span className="sr-only"> complete</span>
                </span>
              ) : (
                <button
                  key={step.label}
                  type="button"
                  title={step.blocker}
                  onClick={() => onNavigateSection(step.section)}
                >
                  <CircleDashed className="mr-1 inline h-3 w-3" aria-hidden />
                  {step.label}
                  <span className="sr-only"> incomplete — go to section</span>
                  <ArrowUpRight className="ml-0.5 inline h-3 w-3" aria-hidden />
                </button>
              ),
            )}
          </div>
          <div className="ws-row-list">
            {setupRows.map((row) => (
              <div key={row.label} className="ws-row-item" style={{ minHeight: "3.25rem" }}>
                <span className="ws-summary-row-icon" aria-hidden>
                  <row.icon className="h-3.5 w-3.5" />
                </span>
                <span className="ws-row-main">
                  <span className="ws-summary-row-label block">{row.label}</span>
                  <span className="ws-row-primary">{row.value}</span>
                </span>
                <span className="ws-row-actions">
                  <button
                    type="button"
                    className="ws-text-btn"
                    onClick={() => onNavigateSection(row.section)}
                  >
                    Edit
                  </button>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
