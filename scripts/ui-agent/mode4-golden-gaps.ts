/**
 * Golden-screen UI blueprint gaps from Stage E audit (2026-09-06).
 * Used by Mode 4 Completion & Polish passes — not backend wiring gaps.
 *
 * Update this file after each blueprint audit. Cursor may override via --gaps-file.
 */
export type GoldenGap = {
  id: string;
  category: "subflow" | "state" | "modal" | "responsive" | "shell" | "control";
  summary: string;
  details: string;
  /** Atomic feature ids this gap closes (optional) */
  atomicFeatureIds?: string[];
};

export type GoldenGapEntry = {
  manifestId: string;
  canonicalPath: string;
  blueprintScore: number;
  priority: number;
  gaps: GoldenGap[];
};

export const AUDIT_GAP_REGISTRY: GoldenGapEntry[] = [
  {
    manifestId: "appointments-calendar",
    canonicalPath: "Appointments → Calendar",
    blueprintScore: 45,
    priority: 1,
    gaps: [
      {
        id: "cal-create-from-slot",
        category: "subflow",
        summary: "Create appointment from empty slot click",
        details:
          "Clicking an empty time slot opens a drawer or side panel with prefilled date/time, customer fields, booking type, and save/cancel. Wire from day/week/month grids.",
        atomicFeatureIds: ["cal-new-from-slot"],
      },
      {
        id: "cal-event-popover",
        category: "modal",
        summary: "Compact appointment popover on block click",
        details:
          "Before navigating to full detail, show a popover with customer, time, status, quick actions (open detail, message, reschedule). Full detail is separate.",
        atomicFeatureIds: ["cal-overlay-detail"],
      },
      {
        id: "cal-new-appointment-form",
        category: "subflow",
        summary: "New appointment form from header CTA",
        details: "Header 'New appointment' opens the same create drawer/modal as slot click (without prefilled time).",
      },
      {
        id: "cal-settings-entry",
        category: "subflow",
        summary: "Calendar settings entry UI",
        details: "Design settings panel or modal reachable from calendar (hours, connected calendars, display options). onShowCalendarSettings must open real UI.",
      },
      {
        id: "cal-loading-error-empty",
        category: "state",
        summary: "Loading, error, and empty calendar states",
        details: "Skeleton while loading; error + retry; empty week/day with CTA to create first appointment or adjust filters.",
      },
      {
        id: "cal-video-badges",
        category: "control",
        summary: "Video/meeting indicators on event blocks",
        details: "Show video icon on events with linked Transovo Video meetings.",
        atomicFeatureIds: ["cal-meeting-video-badges"],
      },
      {
        id: "cal-responsive",
        category: "responsive",
        summary: "Mobile/narrow layout",
        details: "Stack sidebar below grid or collapse to agenda-only; toolbar wraps; touch-friendly event targets.",
      },
    ],
  },
  {
    manifestId: "booking-types",
    canonicalPath: "Booking → Booking Types",
    blueprintScore: 70,
    priority: 2,
    gaps: [
      {
        id: "type-question-builder",
        category: "subflow",
        summary: "Customer question builder (full interior)",
        details:
          "Replace stub with question list: add/edit/remove/reorder, question types (text, single choice, multi, phone, etc.), required toggle, preview on booking page mock.",
        atomicFeatureIds: ["type-custom-questions"],
      },
      {
        id: "type-delete-confirm",
        category: "modal",
        summary: "Delete booking type confirmation",
        details: "Danger zone delete opens confirmation modal explaining impact on existing appointments and booking page.",
      },
      {
        id: "type-visibility",
        category: "control",
        summary: "Visibility control (public / unlisted / secret)",
        details: "Surface visibility select in editor with helper text for each mode.",
        atomicFeatureIds: ["type-visibility"],
      },
      {
        id: "type-group-recurring",
        category: "control",
        summary: "Group booking and recurring options",
        details: "UI for group capacity/seats and recurring booking toggle with relevant fields.",
        atomicFeatureIds: ["type-group-capacity", "type-recurring"],
      },
      {
        id: "type-schedule-edit",
        category: "subflow",
        summary: "Edit availability schedule entry",
        details: "Link or inline affordance from named schedule dropdown to view/edit schedule (modal or drawer).",
      },
      {
        id: "type-multiple-durations",
        category: "control",
        summary: "Multiple duration options",
        details: "Allow adding multiple duration choices per type, not only single duration select.",
        atomicFeatureIds: ["type-multiple-durations"],
      },
      {
        id: "type-loading-error",
        category: "state",
        summary: "Page loading and error states",
        details: "Skeleton on load; error banner with retry when types fail to load.",
      },
      {
        id: "type-narrow-layout",
        category: "responsive",
        summary: "Narrow/mobile layout",
        details: "Three-column layout stacks: list → editor → preview/status on small screens.",
      },
      {
        id: "type-view-booking-page",
        category: "control",
        summary: "View booking page destination",
        details: "Header 'View booking page' must open preview or external-link affordance, not dead button.",
      },
    ],
  },
  {
    manifestId: "home",
    canonicalPath: "Home",
    blueprintScore: 65,
    priority: 3,
    gaps: [
      {
        id: "home-onboarding-checklist",
        category: "subflow",
        summary: "First-run onboarding checklist",
        details: "Setup checklist card with progress, steps (connect calendar, create booking type, set availability, copy link), and CTAs.",
        atomicFeatureIds: ["home-onboarding-checklist", "setup-wizard"],
      },
      {
        id: "home-empty-schedule",
        category: "state",
        summary: "Empty today's schedule state",
        details: "When no appointments today, show empty state with CTA to calendar or new appointment.",
      },
      {
        id: "home-date-picker",
        category: "subflow",
        summary: "Date picker panel",
        details: "Header date control opens dropdown/calendar to change overview date.",
      },
      {
        id: "home-zero-data",
        category: "state",
        summary: "First-use / zero-data dashboard",
        details: "When workspace has no appointments yet, show guided empty dashboard distinct from error.",
      },
      {
        id: "home-responsive",
        category: "responsive",
        summary: "Responsive grid collapse",
        details: "Stat cards and 2/3-column sections stack cleanly on tablet/mobile.",
      },
    ],
  },
  {
    manifestId: "appointments-list",
    canonicalPath: "Appointments → List",
    blueprintScore: 80,
    priority: 4,
    gaps: [
      {
        id: "list-new-appointment",
        category: "subflow",
        summary: "New appointment form/drawer/modal",
        details: "Replace toast with full create UI: customer, type, time, staff, notes, save/cancel.",
      },
      {
        id: "list-cancel-confirm",
        category: "modal",
        summary: "Cancel confirmation from row actions",
        details: "Cancel opens confirmation dialog with impact on reminders before confirming.",
      },
      {
        id: "list-reschedule-ui",
        category: "subflow",
        summary: "Reschedule flow from list",
        details: "Reschedule from row menu opens slot-picker modal (reuse detail pattern), not toast only.",
        atomicFeatureIds: ["appt-reschedule-staff"],
      },
      {
        id: "list-row-to-detail",
        category: "subflow",
        summary: "Explicit row → detail transition",
        details: "Row click shows designed navigation affordance or inline preview before full detail route.",
        atomicFeatureIds: ["list-row-open"],
      },
    ],
  },
  {
    manifestId: "appointment-detail",
    canonicalPath: "Appointments → Appointment Detail",
    blueprintScore: 85,
    priority: 5,
    gaps: [
      {
        id: "detail-cancel-confirm",
        category: "modal",
        summary: "Cancel confirmation dialog",
        details: "Cancel action requires confirmation modal explaining reminder cancellation and customer notification.",
        atomicFeatureIds: ["appt-cancel-staff"],
      },
      {
        id: "detail-error-notfound",
        category: "state",
        summary: "Error and not-found states",
        details: "Load failure with retry; 404/not-found when appointment id invalid.",
      },
      {
        id: "detail-terminal-states",
        category: "state",
        summary: "Terminal state layouts (canceled, completed, no-show)",
        details: "Distinct read-only treatment when appointment is closed — muted actions, status emphasis, timeline frozen.",
      },
      {
        id: "detail-disconnected",
        category: "state",
        summary: "Disconnected/unavailable states",
        details: "Visual treatment when payment provider disconnected, video not provisioned, or SMS consent missing for reminders.",
      },
    ],
  },
  {
    manifestId: "workflow-builder",
    canonicalPath: "Automations → Workflows",
    blueprintScore: 80,
    priority: 6,
    gaps: [
      {
        id: "wf-condition-nodes",
        category: "subflow",
        summary: "Workflow condition nodes / filters",
        details: "UI to add conditions (status, type, payment, consent) on steps or workflow scope.",
        atomicFeatureIds: ["workflow-conditions"],
      },
      {
        id: "wf-webhook-action",
        category: "subflow",
        summary: "Outbound webhook action in step config",
        details: "Add webhook action type with URL, headers, payload preview in StepConfigModal.",
        atomicFeatureIds: ["workflow-actions-webhook"],
      },
      {
        id: "wf-payment-link-action",
        category: "subflow",
        summary: "Payment link generation action",
        details: "Add payment-link action in step config with amount/template fields.",
        atomicFeatureIds: ["workflow-actions-payment-link"],
      },
      {
        id: "wf-wizard-scope",
        category: "subflow",
        summary: "Setup wizard scope step",
        details: "Wizard includes step to choose all booking types vs specific types (not hardcoded).",
      },
      {
        id: "wf-wizard-validation",
        category: "state",
        summary: "Wizard validation and failure states",
        details: "Empty message validation, activation failure banner, inline errors on review step.",
      },
      {
        id: "wf-paused-edit-state",
        category: "state",
        summary: "Paused workflow edit treatment",
        details: "When editing a paused workflow, builder shows clear 'Paused — won't run until reactivated' banner/chip.",
      },
    ],
  },
];

export function getGoldenGapEntry(manifestId: string): GoldenGapEntry | undefined {
  return AUDIT_GAP_REGISTRY.find((e) => e.manifestId === manifestId);
}

export function listAuditGapManifestIds(): string[] {
  return AUDIT_GAP_REGISTRY.map((e) => e.manifestId);
}
