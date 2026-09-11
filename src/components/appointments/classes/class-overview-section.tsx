"use client";

import {
  ArrowUpRight,
  CalendarClock,
  Check,
  CircleDashed,
  ClipboardList,
  Copy,
  ExternalLink,
  Eye,
  LayoutGrid,
  MapPin,
  Settings2,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { Field, Panel, SelectInput, TextArea, TextInput } from "@/components/appointments/workspace-ui";
import type { ClassFormState, ClassOccurrenceRow } from "@/lib/appointments/classes/class-form";
import { describeClassRecurrence } from "@/lib/appointments/classes/class-recurrence";
import {
  classPriceLabel,
  formatSessionRange,
  nextOccurrence,
  registrationState,
  seatsForNextSession,
  upcomingOccurrences,
} from "@/lib/appointments/classes/class-summary";
import type { ClassWaitlistEntry } from "@/features/appointments/kimi/classes/use-class-editor";
import type { ClassSectionId } from "./class-section-types";

type Props = {
  form: ClassFormState;
  occurrences: ClassOccurrenceRow[];
  waitlist: ClassWaitlistEntry[];
  registrantCount: number;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  bookingLink: string | null;
  copied: boolean;
  intakeFormNames: Map<string, string>;
  onFormChange: <K extends keyof ClassFormState>(key: K, value: ClassFormState[K]) => void;
  onNavigateSection: (id: ClassSectionId) => void;
  onPreview: () => void;
  onCopyLink: () => void;
};

const VISIBILITY_HINT: Record<ClassFormState["visibility"], string> = {
  public: "Listed on your public classes page.",
  hidden: "Reachable only by staff — not listed publicly.",
};

export function ClassOverviewSection({
  form,
  occurrences,
  waitlist,
  registrantCount,
  staffNames,
  locationNames,
  bookingLink,
  copied,
  intakeFormNames,
  onFormChange,
  onNavigateSection,
  onPreview,
  onCopyLink,
}: Props) {
  const next = nextOccurrence(occurrences);
  const seats = seatsForNextSession(form, occurrences);
  const state = registrationState(form, occurrences);
  const upcoming = upcomingOccurrences(occurrences);
  const instructor = form.staffId ? staffNames.get(form.staffId) || "Assigned" : "Not set";
  const location = form.locationId ? locationNames.get(form.locationId) || "Assigned" : "Not set";
  const fillPct = seats.capacity > 0 ? Math.min(100, (seats.enrolled / seats.capacity) * 100) : 0;

  const setupRows: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    section: ClassSectionId;
  }> = [
    {
      icon: CalendarClock,
      label: "Schedule",
      value: `${describeClassRecurrence(form.recurrence)} · ${upcoming.length} upcoming`,
      section: "schedule",
    },
    {
      icon: UserRound,
      label: "People & place",
      value: `${instructor} · ${location}${form.resourceIds.length ? ` · ${form.resourceIds.length} resources` : ""}`,
      section: "people-place",
    },
    {
      icon: Users,
      label: "Capacity & registration",
      value: `${form.capacity} seats · ${registrantCount} registered${form.waitlistEnabled ? ` · waitlist on` : " · waitlist off"}`,
      section: "capacity",
    },
    {
      icon: Wallet,
      label: "Pricing & access",
      value: `${classPriceLabel(form)}${form.memberOnly ? " · members only" : ""}${
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
        form.cancellationPolicy ? "Policy set" : "Workspace policy",
        form.admissionEnabled ? "Check-in on" : "Check-in off",
        form.confirmationMessage ? "Custom confirmation" : "Default confirmation",
      ].join(" · "),
      section: "advanced",
    },
  ];

  const steps: Array<{ label: string; done: boolean; section: ClassSectionId; blocker: string }> = [
    { label: "Details", done: Boolean(form.name.trim()), section: "overview", blocker: "Give the class a name." },
    { label: "Schedule", done: upcoming.length > 0, section: "schedule", blocker: "No upcoming sessions yet." },
    { label: "Instructor", done: Boolean(form.staffId), section: "people-place", blocker: "No instructor assigned." },
    { label: "Location", done: Boolean(form.locationId), section: "people-place", blocker: "No location assigned." },
    { label: "Capacity", done: form.capacity > 0, section: "capacity", blocker: "Set how many seats there are." },
    {
      label: "Pricing",
      done: form.isFree || form.priceCents > 0,
      section: "pricing-access",
      blocker: "Set a price or mark the class free.",
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
        <Panel title="Class details" icon={LayoutGrid} className="ws-span-7">
          <div className="space-y-3.5">
            <Field label="Name" htmlFor="cls-name">
              <TextInput
                id="cls-name"
                value={form.name}
                placeholder="Sunrise Vinyasa"
                onChange={(e) => onFormChange("name", e.target.value)}
              />
            </Field>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field label="Category" htmlFor="cls-category" hint="Groups classes on the public page.">
                <TextInput
                  id="cls-category"
                  value={form.category}
                  placeholder="Yoga"
                  onChange={(e) => onFormChange("category", e.target.value)}
                />
              </Field>
              <Field label="Visibility" htmlFor="cls-visibility" hint={VISIBILITY_HINT[form.visibility]}>
                <SelectInput
                  id="cls-visibility"
                  value={form.visibility}
                  onChange={(e) =>
                    onFormChange("visibility", e.target.value as ClassFormState["visibility"])
                  }
                >
                  <option value="public">Public</option>
                  <option value="hidden">Hidden</option>
                </SelectInput>
              </Field>
              <Field label="Status" htmlFor="cls-status" hint="Inactive classes take no registrations.">
                <SelectInput
                  id="cls-status"
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
              htmlFor="cls-description"
              hint={`${form.description.length}/500 characters`}
            >
              <TextArea
                id="cls-description"
                rows={3}
                maxLength={500}
                value={form.description}
                placeholder="What happens in this class, and who it suits."
                onChange={(e) => onFormChange("description", e.target.value)}
              />
            </Field>
            <Field label="Image URL" htmlFor="cls-image" hint="Shown beside the class on the public page.">
              <TextInput
                id="cls-image"
                type="url"
                placeholder="https://…"
                value={form.imageUrl}
                onChange={(e) => onFormChange("imageUrl", e.target.value)}
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Next session"
          icon={CalendarClock}
          className="ws-span-5"
          actions={
            <button
              type="button"
              className="ws-text-btn"
              onClick={() => onNavigateSection("schedule")}
            >
              Schedule
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </button>
          }
        >
          {next ? (
            <>
              <p className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">
                {formatSessionRange(next.startsAt, next.endsAt)}
              </p>
              <div className="ws-row-secondary mt-1.5">
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3 w-3" aria-hidden />
                  {instructor}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {location}
                </span>
              </div>
              <div className="ws-stat mt-3">
                <span className="ws-stat-value">{seats.enrolled}</span>
                <span className="ws-stat-unit">of {seats.capacity} seats taken</span>
              </div>
              <div className={`ws-meter${seats.remaining === 0 ? " is-full" : ""}`}>
                <span style={{ width: `${fillPct}%` }} />
              </div>
              <p className="ws-stat-note">
                {upcoming.length > 1
                  ? `${upcoming.length - 1} more session${upcoming.length - 1 === 1 ? "" : "s"} after this one.`
                  : "This is the last scheduled session."}
              </p>
            </>
          ) : (
            <div className="ws-empty-inline">
              <span className="ws-empty-inline-icon">
                <CalendarClock className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                  No sessions scheduled
                </p>
                <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                  Customers cannot register until at least one session exists.
                </p>
                <button
                  type="button"
                  className="ws-text-btn mt-1.5"
                  onClick={() => onNavigateSection("schedule")}
                >
                  Add sessions
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
            <button type="button" className="ws-text-btn" onClick={() => onNavigateSection("capacity")}>
              Manage
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </button>
          }
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <p className="ws-summary-row-label">Registered</p>
              <div className="ws-stat">
                <span className="ws-stat-value">{registrantCount}</span>
              </div>
            </div>
            <div>
              <p className="ws-summary-row-label">Seats left</p>
              <div className="ws-stat">
                <span className="ws-stat-value">{seats.remaining}</span>
                <span className="ws-stat-unit">next session</span>
              </div>
            </div>
            <div>
              <p className="ws-summary-row-label">Waitlist</p>
              <div className="ws-stat">
                <span className="ws-stat-value">{waitlist.length}</span>
              </div>
            </div>
          </div>
          <p className="ws-stat-note">
            <span
              className={`ws-chip ${
                state.tone === "open"
                  ? "ws-chip-success"
                  : state.tone === "full"
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
                  {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </>
            ) : null
          }
        >
          <p className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">
            {form.name.trim() || "Untitled class"}
          </p>
          <p className="mt-0.5 text-[var(--type-list)] text-[var(--text-secondary)]">
            {form.description.trim() || "No description yet."}
          </p>
          <div className="ws-row-secondary mt-2">
            <span>{next ? formatSessionRange(next.startsAt, next.endsAt) : "No session listed"}</span>
            <span>{classPriceLabel(form)}</span>
            <span>
              {form.showRemainingSpots
                ? seats.remaining > 0
                  ? `${seats.remaining} spots left`
                  : "Full"
                : "Spots hidden"}
            </span>
            <span>{previewForms ? `Form: ${previewForms}` : "No form attached"}</span>
          </div>
          {form.visibility === "hidden" || !form.active ? (
            <p className="ws-stat-note">
              This class is not on the public page right now, so the preview is what it would show
              once it is listed.
            </p>
          ) : null}
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Setup summary"
          icon={Settings2}
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
