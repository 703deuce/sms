/**
 * Authoritative certification case definitions derived from
 * docs/APPOINTMENTS-MCTB-FULL-FEATURE-SETTINGS-INVENTORY.md (2026-09-07).
 *
 * Each case maps UI → API → persistence → runtime → error path.
 */

export type CertStatus =
  | "PENDING"
  | "PASS"
  | "FAIL"
  | "BLOCKED — PSTN"
  | "BLOCKED — LIVE EXTERNAL PROVIDER"
  | "BLOCKED — ENVIRONMENT"
  | "NOT APPLICABLE"
  | "DEFECT — MISSING UI"
  | "DEFECT — MISSING RUNTIME"
  | "TIMEOUT"
  | "UI DEFERRED";

export type CertExecution =
  | "AUTO"
  | "UI"
  | "MANUAL"
  | "STATIC"
  | "BLOCKED"
  | "DEFECT";

export type CertCase = {
  id: string;
  product: "appointments" | "mctb" | "shared" | "cross";
  family: string;
  feature: string;
  userSequence: string;
  ui: string;
  api: string;
  db: string;
  runtime: string;
  errorPath: string;
  execution: CertExecution;
  command?: string;
  notes?: string;
  initialStatus?: CertStatus;
};

function seq(items: string[]): string {
  return items.map((s, i) => `${i + 1}. ${s}`).join(" ");
}

function expand(
  family: string,
  product: CertCase["product"],
  base: Omit<CertCase, "id" | "family" | "product"> & { steps: string[] },
  execution: CertExecution = "UI",
  command?: string,
): CertCase[] {
  return base.steps.map((step, i) => ({
    id: `${family}-${String(i + 1).padStart(3, "0")}`,
    product,
    family,
    feature: step,
    userSequence: seq([step, ...(base.userSequence ? [base.userSequence] : [])]),
    ui: base.ui,
    api: base.api,
    db: base.db,
    runtime: base.runtime,
    errorPath: base.errorPath,
    execution,
    command,
    notes: base.notes,
    initialStatus: base.initialStatus,
  }));
}

/** Appointment type config fields — each needs save → reload → public effect */
const AP_TYPE_FIELDS = [
  "enabled",
  "description",
  "location",
  "priceDisplay",
  "bookingHours",
  "minimumBookingNoticeMinutes",
  "maximumBookingDaysAhead",
  "bufferBeforeMinutes",
  "bufferAfterMinutes",
  "timezone",
  "visibility",
  "displayOrder",
  "durationOptions",
  "permissions",
  "ownerTeamId",
  "bookingApproval",
  "redirectAfterBooking",
  "confirmationPage",
  "bookingQuestions",
  "staffAssignment",
  "staffIds",
  "collectiveStaffIds",
  "groupCapacity",
  "locationIds",
  "bookingLimits",
  "cancellationPolicy",
  "reschedulePolicy",
  "groupBooking",
  "recurring",
  "namedScheduleId",
  "notetaker",
  "transovoVideo",
] as const;

const STAFF_FIELDS = [
  "create",
  "edit",
  "deactivate",
  "customerSelectable",
  "appointmentTypeIds",
  "locationIds",
  "calendarConnectionId",
  "weeklyHours",
  "dateOverrides",
  "blackoutDates",
  "schedulingPool",
  "historicalAppointments",
] as const;

const NOTETAKER_PLATFORM_FIELDS = [
  "enabled",
  "joinRule",
  "selectedEventTypeIds",
  "externalParticipantsOnly",
  "recordingEnabled",
  "transcriptEnabled",
  "summaryEnabled",
  "actionItemsEnabled",
  "followUpEnabled",
  "botName",
  "summaryTemplate",
  "notifyAttendeesAdvance",
  "advanceNoticeText",
  "emailOnRecapReady",
  "autoShareWith",
  "recordingRetentionDays",
  "transcriptRetentionDays",
] as const;

const HANDOFF_RESPONSE_MODES = [
  "notify_only",
  "guided_collection",
  "ai_conversation",
  "immediate_handoff",
] as const;

const HANDOFF_LEAD_FIELDS = [
  "caller_name",
  "service_reason",
  "urgency",
  "location_zip",
  "service_address",
  "callback_time",
  "customer_type",
  "appointment_intent",
  "additional_details",
] as const;

function apTypeCases(): CertCase[] {
  return AP_TYPE_FIELDS.map((field) => ({
    id: `AP-TYPES-${field}`,
    product: "appointments",
    family: "AP-TYPES",
    feature: `Booking type field: ${field}`,
    userSequence: seq([
      `Edit booking type ${field}`,
      "Save",
      "Reload editor",
      "Verify public booking/runtime reflects change",
    ]),
    ui: "/appointments/types",
    api: "PATCH /api/appointments/types/[id]",
    db: "VoiceService.configJson",
    runtime: "availability + public book",
    errorPath: "invalid value → field error; stale reload",
    execution: field === "notetaker" || field === "transovoVideo" ? "AUTO" : "UI",
    command:
      field === "notetaker"
        ? "npx tsx scripts/test-voice-notetaker-wiring.ts"
        : field === "transovoVideo"
          ? "npx tsx scripts/test-transovo-video-wiring.ts"
          : undefined,
    initialStatus: "UI DEFERRED" as CertStatus,
  }));
}

function buildFamilies(): CertCase[] {
  const cases: CertCase[] = [];

  cases.push(
    ...expand(
      "AP-OVERVIEW",
      "appointments",
      {
        steps: [
          "KPI strip renders real counts",
          "Setup health rows link to setup",
          "Recent activity lists",
          "Drilldown navigation",
          "Empty/no-data state",
          "Partial/degraded data state",
          "Error state with retry",
          "Timezone-aware labels",
          "Stale data reload",
        ],
        userSequence: "Load /appointments/overview",
        ui: "/appointments/overview",
        api: "GET /api/appointments/overview",
        db: "aggregates",
        runtime: "overview service",
        errorPath: "API error → retry",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-CALENDAR",
      "appointments",
      {
        steps: [
          "Month view navigation",
          "Week view",
          "Day view",
          "Agenda/list view if implemented",
          "Today shortcut",
          "Create from calendar slot",
          "Open appointment detail",
          "Drag-reschedule when enabled",
          "Collision handling",
          "Canceled/completed/no-show styling",
          "Timezone display",
          "Overlapping appointments",
          "Filter/state persistence",
          "Refresh preserves state",
        ],
        userSequence: "Use /appointments/calendar",
        ui: "/appointments/calendar",
        api: "GET /api/appointments, /api/calendar/events",
        db: "VoiceAppointment",
        runtime: "calendar adapter",
        errorPath: "conflict → user message",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-LIST",
      "appointments",
      {
        steps: [
          "Search",
          "Date filter",
          "Status filter",
          "Service filter",
          "Staff filter",
          "Location filter",
          "Sort",
          "Pagination",
          "URL state sync",
          "Detail → back restores filters",
        ],
        userSequence: "Use /appointments list",
        ui: "/appointments",
        api: "GET /api/appointments",
        db: "VoiceAppointment",
        runtime: "list query",
        errorPath: "invalid filter → empty/filtered empty",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-DETAIL",
      "appointments",
      {
        steps: [
          "Edit appointment",
          "Reschedule",
          "Cancel",
          "Confirm",
          "Complete",
          "Mark no-show",
          "Internal notes",
          "Reminder timeline",
          "Meeting/video actions",
          "AI Notetaker panel",
          "Payment display (no charge)",
          "Contact relationship",
          "Source attribution",
          "Activity/history timeline",
        ],
        userSequence: "Open /appointments/[id]",
        ui: "/appointments/[id]",
        api: "PATCH /api/appointments/[id]",
        db: "VoiceAppointment.metadata",
        runtime: "lifecycle + reminders + meetings",
        errorPath: "invalid transition → 4xx",
        execution: "UI",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-CREATE",
      "appointments",
      {
        steps: [
          "Select existing customer",
          "Create new customer inline",
          "Select service/type",
          "Duration selection",
          "Staff assignment",
          "Location",
          "Date/time pick",
          "Custom booking questions",
          "Approval-required type",
          "Group capacity",
          "Buffers applied",
          "Booking limits enforced",
          "Conflicting slot rejected",
          "Persistence",
          "Downstream reminders scheduled",
        ],
        userSequence: "Staff books via /appointments/new",
        ui: "/appointments/new",
        api: "POST /api/appointments",
        db: "VoiceAppointment",
        runtime: "availability engine + reminders",
        errorPath: "slot taken → error",
        execution: "AUTO",
        command: "npx tsx scripts/test-appointments-double-booking.ts",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-WAITLIST",
      "appointments",
      {
        steps: [
          "Add customer to waitlist",
          "Select service/type",
          "Capture timing/preferences",
          "Save waitlist entry",
          "Slot becomes available",
          "Offer slot to customer",
          "Verify offer event",
          "Public /waitlist/accept/[token]",
          "Customer accepts offer",
          "Appointment created",
          "Capacity consumed",
          "Waitlist item closed",
          "Invalid/expired token",
          "Slot taken before acceptance",
          "Offer timeout/retry",
          "Competing customers for one slot",
        ],
        userSequence: "Waitlist E2E",
        ui: "/appointments/waitlist",
        api: "POST /api/appointments/waitlist",
        db: "AppointmentWaitlistEntry",
        runtime: "waitlist notify job",
        errorPath: "race → clear error",
        execution: "MANUAL",
        initialStatus: "BLOCKED — ENVIRONMENT",
        notes: "No dedicated waitlist E2E script yet",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-RECALLS",
      "appointments",
      {
        steps: [
          "Create recall need",
          "Recall due date",
          "Customer/service linkage",
          "Recall hub view",
          "Eligible recall",
          "Completed recall",
          "Dismissed recall",
          "Duplicate prevention",
        ],
        userSequence: "Recalls hub",
        ui: "/appointments/recalls",
        api: "GET /api/appointments/recalls/hub",
        db: "platform config recalls",
        runtime: "recall scanner",
        errorPath: "duplicate blocked",
        execution: "MANUAL",
        initialStatus: "BLOCKED — ENVIRONMENT",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-RECALL-CAMPAIGNS",
      "appointments",
      {
        steps: [
          "Create campaign",
          "Choose recall population",
          "Configure outreach",
          "Preview",
          "Activate",
          "Execution (fixture transport)",
          "Stop/cancel",
          "Customer response handling",
          "Booking attribution",
          "Activity logging",
          "Duplicate prevention",
        ],
        userSequence: "Recall campaigns",
        ui: "/appointments/recall-campaigns",
        api: "POST /api/appointments/recall-campaigns",
        db: "RecallCampaign",
        runtime: "campaign worker (fixture)",
        errorPath: "invalid population → validation",
        execution: "MANUAL",
        initialStatus: "BLOCKED — ENVIRONMENT",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-NOSHOW",
      "appointments",
      {
        steps: [
          "Mark appointment no-show",
          "Recovery eligibility",
          "Configured recovery behavior",
          "Notification/message created",
          "Rebooking path",
          "Successful rebooking",
          "No-show analytics",
          "Disabled recovery",
          "Opt-out blocks SMS",
        ],
        userSequence: "No-show recovery",
        ui: "/appointments/no-show-recovery",
        api: "POST /api/appointments/no-show-recovery",
        db: "VoiceAppointment + workflow",
        runtime: "no-show recovery",
        errorPath: "opt-out suppression",
        execution: "MANUAL",
        initialStatus: "BLOCKED — ENVIRONMENT",
      },
    ),
  );

  cases.push(...apTypeCases());

  cases.push(
    ...expand(
      "AP-AI-BOOKING",
      "appointments",
      {
        steps: [
          "Public NL booking — identify intent",
          "Identify service",
          "Availability lookup",
          "Present valid slots",
          "Collect required fields",
          "Select slot",
          "Appointment created",
          "Confirmation returned",
          "Attribution recorded",
          "Ambiguous service",
          "Ambiguous date",
          "Invalid date",
          "Unavailable time",
          "Multiple services",
          "User changes mind",
          "SMS inbound booking fixture",
          "Email inbound booking fixture",
        ],
        userSequence: "AI booking channels",
        ui: "/appointments/ai-booking, /book/[slug]",
        api: "POST /api/public/book/[slug]/ai",
        db: "AppointmentAiMutationRecord",
        runtime: "processAiSchedulingRequest",
        errorPath: "verifier rejects unsafe writes",
        execution: "AUTO",
        command: "npx tsx scripts/test-appointment-ai-hardening.ts",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-OWNER-AMY",
      "appointments",
      {
        steps: [
          "Valid NL settings change",
          "Multiple changes",
          "Ambiguous request",
          "Unsupported request rejected",
          "Write verifier gate",
          "Persistence",
          "Downstream behavior changes",
          "No hallucinated setting",
          "No unauthorized write",
        ],
        userSequence: "Owner Amy agent",
        ui: "settings/agent surfaces",
        api: "owner amy tools",
        db: "SolutionSetup / platform config",
        runtime: "owner-llm-loop + verifier",
        errorPath: "verifier rejection",
        execution: "AUTO",
        command: "npx tsx scripts/test-appointment-ai-hardening.ts",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-WRITE-VERIFIER",
      "appointments",
      {
        steps: [
          "Valid AI mutation",
          "Invalid object rejected",
          "Unauthorized field rejected",
          "Missing required field",
          "Stale version rejected",
          "Dangerous write blocked",
          "Malformed tool output",
          "Verifier prevents DB mutation",
        ],
        userSequence: "verifyWriteAction",
        ui: "n/a",
        api: "AI pipeline",
        db: "no mutation on reject",
        runtime: "write verifier",
        errorPath: "all rejection paths",
        execution: "AUTO",
        command: "npx tsx scripts/test-appointment-ai-hardening.ts",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-VOICE-REMINDERS",
      "appointments",
      {
        steps: [
          "Create template",
          "TTS mode",
          "Audio mode",
          "Human script",
          "Voicemail script",
          "Keypad confirm mapping",
          "Keypad reschedule mapping",
          "Keypad cancel mapping",
          "Keypad transfer mapping",
          "Retry no-answer rules",
          "Retry busy rules",
          "Voicemail behavior config",
          "Default template",
          "Caller ID state",
          "Transfer target",
          "Job/event construction",
          "Webhook fixture processing",
        ],
        userSequence: "Voice reminder config (no PSTN)",
        ui: "/appointments/voice-reminders",
        api: "GET/PATCH /api/appointments/voice-reminders",
        db: "platform voiceReminders",
        runtime: "voice reminder job builder",
        errorPath: "missing template → block send",
        execution: "AUTO",
        command: "npx tsx scripts/test-appointment-voice-reminders.ts",
        notes: "Live outbound call: BLOCKED — PSTN",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-WORKFLOWS",
      "appointments",
      {
        steps: [
          "Workflow trigger coverage",
          "Workflow action coverage",
          "Trigger → condition → step chain",
          "Delay step",
          "Confirmation request step",
          "Reminder step",
          "No-show step",
          "Unknown reply routing",
          "Recall step",
          "Internal notification",
          "Stop conditions",
          "Disabled workflow",
          "Edit active workflow",
          "Execution history",
          "Retries",
          "Idempotency",
        ],
        userSequence: "Workflow builder",
        ui: "/appointments/workflows",
        api: "/api/appointments/workflows",
        db: "AppointmentWorkflow*",
        runtime: "workflow engine",
        errorPath: "step failure logged",
        execution: "AUTO",
        command: "npx tsx scripts/test-appointment-workflows-hardening.ts",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-NOTETAKER",
      "appointments",
      {
        steps: NOTETAKER_PLATFORM_FIELDS.map(
          (f) => `Platform config field ${f} save→reload→runtime`,
        ),
        userSequence: "/settings/ai-notetaker",
        ui: "/settings/ai-notetaker",
        api: "settings save",
        db: "notetaker config JSON",
        runtime: "meeting-assistant service",
        errorPath: "invalid join rule",
        execution: "AUTO",
        command: "npx tsx scripts/test-voice-notetaker-wiring.ts",
        notes: "Live Zoom/Teams bot: BLOCKED — LIVE EXTERNAL PROVIDER",
      },
    ),
  );

  cases.push(
    ...expand(
      "AP-NATIVE-VIDEO",
      "appointments",
      {
        steps: [
          "Transovo Video location on book",
          "Room generated and linked",
          "Host token/credential",
          "Guest public token valid",
          "Guest invalid token",
          "Guest expired token",
          "Room API permissions",
          "Meeting started/ended events",
          "Cleanup/expiration logic",
        ],
        userSequence: "Transovo Video",
        ui: "/video, /appointments/[id]/video/host",
        api: "/api/appointments/[id]/video",
        db: "VideoMeeting",
        runtime: "transovo-video service",
        errorPath: "expired token",
        execution: "AUTO",
        command: "npx tsx scripts/test-transovo-video-wiring.ts",
        notes: "WebRTC media session: UI DEFERRED",
      },
    ),
  );

  // MCTB families
  cases.push(
    ...expand(
      "MCTB-HOME",
      "mctb",
      {
        steps: [
          "KPI strip",
          "Needs attention",
          "Recent missed calls",
          "Recent conversations",
          "Setup health",
          "Pause notice",
          "Error retry",
        ],
        userSequence: "/mctb",
        ui: "/mctb",
        api: "GET /api/mctb/overview",
        db: "aggregates",
        runtime: "overview",
        errorPath: "error state",
      },
    ),
  );

  cases.push({
    id: "MCTB-DEFECT-SETUP-LINKS",
    product: "mctb",
    family: "MCTB-SETUP",
    feature: "Links & request form setup page",
    userSequence: seq([
      "Runtime has requestFormEnabled, defaultLinkUrl, requestFormFieldsJson",
      "Canonical route /mctb/setup/links missing",
    ]),
    ui: "MISSING — /mctb/setup/links",
    api: "PATCH /api/mctb/setup (defaultLinkUrl, requestFormEnabled)",
    db: "MissedCallTextConfig",
    runtime: "/f/mctb/[token] public form works",
    errorPath: "n/a",
    execution: "DEFECT",
    initialStatus: "DEFECT — MISSING UI",
    notes:
      "Implement /mctb/setup/links OR retire customer-facing config expectation. Public form /f/mctb/[token] exists.",
  });

  cases.push({
    id: "MCTB-LEGACY-SCHED-001",
    product: "mctb",
    family: "MCTB-LEGACY",
    feature: "Legacy schedule/business-hours fields backward compatibility",
    userSequence: seq([
      "Load workspace with legacy businessHoursOnly / allowedStartTime in DB",
      "Recovery controls canonical UI used",
      "Business Hours page must NOT appear in nav",
      "Legacy fields still read for runtime where applicable",
    ]),
    ui: "/mctb/setup/recovery (not business-hours)",
    api: "GET/POST /api/mctb/setup",
    db: "MissedCallTextConfig + customFields mctb schedule",
    runtime: "schedule.ts readMctbScheduleFromCustomFields",
    errorPath: "migration path",
    execution: "AUTO",
    command: "npx tsx scripts/test-mctb-schedule-pause.ts",
    notes: "Retired Business Hours UI must not reappear as canonical nav",
  });

  for (const mode of HANDOFF_RESPONSE_MODES) {
    cases.push({
      id: `MCTB-HO-MODE-${mode}`,
      product: "mctb",
      family: "MCTB-HANDOFF",
      feature: `Response mode: ${mode}`,
      userSequence: seq([`Configure ${mode}`, "Inbound reply triggers correct automation"]),
      ui: "/mctb/setup/notifications",
      api: "PATCH /api/mctb/handoff",
      db: "MctbHandoffConfig.responseMode",
      runtime: "process-inbound-reply",
      errorPath: "invalid mode rejected",
      execution: "AUTO",
      command: "npx tsx scripts/test-mctb-handoff.ts",
    });
  }

  for (const field of HANDOFF_LEAD_FIELDS) {
    for (const req of ["off", "optional", "required"] as const) {
      cases.push({
        id: `MCTB-HO-FIELD-${field}-${req}`,
        product: "mctb",
        family: "MCTB-HANDOFF",
        feature: `Lead field ${field} = ${req}`,
        userSequence: seq([`Set ${field} to ${req}`, "Inbound collection respects requirement"]),
        ui: "/mctb/setup/notifications",
        api: "PATCH /api/mctb/handoff",
        db: "MctbHandoffConfig.fieldSchemaJson",
        runtime: "guided collection",
        errorPath: "missing required blocks progress",
        execution: "AUTO",
        command: "npx tsx scripts/test-mctb-handoff.ts",
      });
    }
  }

  cases.push(
    ...expand(
      "MCTB-RT",
      "mctb",
      {
        steps: [
          "TeXML ingress fixture press_1",
          "TeXML ingress fixture existing_consent",
          "Press-1 DTMF fixture",
          "Voicemail path fixture",
          "Classifier fixture",
          "Webhook duplicate idempotency",
          "Malformed provider event",
          "Send status webhook",
          "Inbound reply fixture",
          "Eligibility suppression",
          "Cooldown repeat caller",
          "Max messages cap",
          "Opt-out STOP",
          "Delayed recovery job",
        ],
        userSequence: "MCTB runtime fixtures",
        ui: "n/a",
        api: "telnyx mctb webhooks",
        db: "MissedCallEvent, traces",
        runtime: "texml + eligibility + send job",
        errorPath: "suppressed ≠ failed",
        execution: "AUTO",
        command: "npx tsx scripts/test-mctb-final-pipeline-contract.ts",
        notes: "Real PSTN: BLOCKED — PSTN",
      },
    ),
  );

  // Cross-product
  cases.push(
    ...expand(
      "X-PRODUCT",
      "cross",
      {
        steps: [
          "MCTB booking intent → public book",
          "Appointment source=MCTB attribution",
          "MCTB state → appointment_booked",
          "Reminder reply in appointment context",
          "AI booking reply in inbox",
          "MCTB caller → contact match",
          "Appointment → notetaker → recap link",
          "Transovo Video → notetaker transcript",
        ],
        userSequence: "Cross-product flows",
        ui: "multiple",
        api: "multiple",
        db: "VoiceAppointment + Conversation",
        runtime: "handoff + booking",
        errorPath: "attribution missing",
        execution: "AUTO",
        command: "npx tsx scripts/test-appointment-booking-agent-layer.ts",
      },
    ),
  );

  // Feature flags
  const flags = [
    "APPOINTMENTS_IN_V1_NAV",
    "APPOINTMENTS_V1_PRIMARY",
    "workspace mctb",
    "ai_notetaker",
    "transovo_video",
    "visual_voicemail",
    "MASS_TEXTING",
  ];
  for (const flag of flags) {
    cases.push({
      id: `FLAG-${flag.replace(/\s+/g, "-").toUpperCase()}`,
      product: "shared",
      family: "FEATURE-FLAGS",
      feature: `Feature flag: ${flag}`,
      userSequence: seq([`Enabled: nav/routes/API visible`, `Disabled: gated/hidden`]),
      ui: "nav + routes",
      api: "entitlement middleware",
      db: "WorkspaceProductFeature",
      runtime: "v1-launch-nav.ts",
      errorPath: "no dead nav links",
      execution: flag === "MASS_TEXTING" ? "STATIC" : "MANUAL",
      initialStatus: "PENDING",
      notes: flag === "MASS_TEXTING" ? "Must remain outside MCTB V1 shell" : undefined,
    });
  }

  return cases;
}

export const CERT_MATRIX_CASES: CertCase[] = buildFamilies();

export function casesByCommand(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const c of CERT_MATRIX_CASES) {
    if (!c.command) continue;
    const list = map.get(c.command) ?? [];
    list.push(c.id);
    map.set(c.command, list);
  }
  return map;
}
