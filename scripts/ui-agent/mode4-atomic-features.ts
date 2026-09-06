/**
 * Atomic feature inventory for Mode 4 preflight.
 * Each entry is an independently meaningful capability — not a category bucket.
 *
 * @see docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md
 */
export type AtomicFeature = {
  id: string;
  capability: string;
  domain: string;
  /** Mode 4 manifest entry IDs — contextual features may list multiple */
  manifestIds: string[];
  uiRepresentation: string;
  runtimeContract: string;
  /** false = legacy/excluded product — must not appear in Mode 4 UI */
  inScope: boolean;
  excludeReason?: string;
};

export const ATOMIC_FEATURES: AtomicFeature[] = [
  // ── Home ──
  { id: "home-summary-cards", capability: "Operations summary cards (today, confirmed, awaiting, reschedule)", domain: "Home", manifestIds: ["home"], uiRepresentation: "Dashboard metric cards", runtimeContract: "overview metrics API", inScope: true },
  { id: "home-todays-appointments", capability: "Today's appointments section with drill-through", domain: "Home", manifestIds: ["home"], uiRepresentation: "List section → appointment detail", runtimeContract: "appointments list query", inScope: true },
  { id: "home-needs-attention", capability: "Needs attention queue (confirmation, reschedule, failed reminders, unread)", domain: "Home", manifestIds: ["home"], uiRepresentation: "Attention list with deep links", runtimeContract: "overview needs-attention", inScope: true },
  { id: "home-recent-conversations", capability: "Recent conversations strip", domain: "Home", manifestIds: ["home", "messages-inbox"], uiRepresentation: "Conversation preview cards", runtimeContract: "inbox API", inScope: true },
  { id: "home-onboarding-checklist", capability: "First-run setup checklist entry", domain: "Home", manifestIds: ["home", "appointments-setup"], uiRepresentation: "Checklist CTA → setup", runtimeContract: "setup progress state", inScope: true },

  // ── Appointments — Calendar ──
  { id: "cal-day-week-month", capability: "Calendar day / week / month views", domain: "Appointments", manifestIds: ["appointments-calendar"], uiRepresentation: "View switcher + grid", runtimeContract: "calendar appointments query", inScope: true },
  { id: "cal-nav-prev-today-next", capability: "Calendar previous / today / next navigation", domain: "Appointments", manifestIds: ["appointments-calendar"], uiRepresentation: "Toolbar controls", runtimeContract: "date range state", inScope: true },
  { id: "cal-new-from-slot", capability: "Create appointment from empty slot click", domain: "Appointments", manifestIds: ["appointments-calendar", "appointments-new"], uiRepresentation: "Drawer/form with prefilled time", runtimeContract: "createPlatformAppointment", inScope: true },
  { id: "cal-overlay-detail", capability: "Compact appointment overlay on block click", domain: "Appointments", manifestIds: ["appointments-calendar", "appointment-detail"], uiRepresentation: "Popover/overlay before full detail", runtimeContract: "appointment detail fetch", inScope: true },
  { id: "cal-status-on-blocks", capability: "Status indicators on calendar blocks", domain: "Appointments", manifestIds: ["appointments-calendar"], uiRepresentation: "Color/badge on event", runtimeContract: "appointment.status", inScope: true },
  { id: "cal-meeting-video-badges", capability: "Meeting/video indicators on calendar events", domain: "Appointments", manifestIds: ["appointments-calendar", "meetings-upcoming"], uiRepresentation: "Icon on block", runtimeContract: "meeting-indicators", inScope: true },

  // ── Appointments — List ──
  { id: "list-status-tabs", capability: "List tabs (today, upcoming, awaiting, confirmed, canceled, past)", domain: "Appointments", manifestIds: ["appointments-list"], uiRepresentation: "Tab bar + filtered table", runtimeContract: "appointments-service filters", inScope: true },
  { id: "list-search", capability: "Search appointments by name, phone, email, service", domain: "Appointments", manifestIds: ["appointments-list"], uiRepresentation: "Search input", runtimeContract: "list query params", inScope: true },
  { id: "list-columns-actions", capability: "List columns (time, customer, service, status, reminders, actions)", domain: "Appointments", manifestIds: ["appointments-list"], uiRepresentation: "Data table", runtimeContract: "appointments list API", inScope: true },
  { id: "list-row-open", capability: "Open appointment from list row", domain: "Appointments", manifestIds: ["appointments-list", "appointment-detail"], uiRepresentation: "Row click → detail", runtimeContract: "route /appointments/[id]", inScope: true },
  { id: "list-mobile-cards", capability: "Mobile stacked card layout for list", domain: "Appointments", manifestIds: ["appointments-list"], uiRepresentation: "Responsive cards", runtimeContract: "same list data", inScope: true },

  // ── Appointments — Waitlist ──
  { id: "waitlist-admin-view", capability: "Admin waitlist entries view", domain: "Appointments", manifestIds: ["appointments-waitlist"], uiRepresentation: "Waitlist table", runtimeContract: "waitlist.ts admin API", inScope: true },
  { id: "waitlist-admin-actions", capability: "Manage waitlist entry (offer, remove, status)", domain: "Appointments", manifestIds: ["appointments-waitlist"], uiRepresentation: "Row actions", runtimeContract: "waitlist admin mutations", inScope: true },
  { id: "waitlist-public-join", capability: "Customer join waitlist when no slots", domain: "Booking", manifestIds: ["public-booking", "appointments-waitlist"], uiRepresentation: "Waitlist step on public book", runtimeContract: "/api/public/book/[slug]/waitlist", inScope: true },
  { id: "waitlist-offer-accept", capability: "Customer accept waitlist slot offer via token", domain: "Booking", manifestIds: ["public-waitlist-accept"], uiRepresentation: "Token acceptance page", runtimeContract: "waitlist accept token", inScope: true },
  { id: "waitlist-slot-workflow-trigger", capability: "Workflow trigger when waitlist slot opens", domain: "Automations", manifestIds: ["workflow-builder"], uiRepresentation: "Trigger config in builder", runtimeContract: "emitWaitlistSlotAvailable", inScope: true },

  // ── Appointments — Recalls ──
  { id: "recalls-hub", capability: "Recalls hub navigation to sub-tools", domain: "Appointments", manifestIds: ["appointments-recalls"], uiRepresentation: "Hub cards", runtimeContract: "static nav", inScope: true },
  { id: "recall-campaigns-crud", capability: "Recall campaigns (segment by last visit / type)", domain: "Appointments", manifestIds: ["appointments-recall-campaigns"], uiRepresentation: "Campaign list + editor", runtimeContract: "recall-campaigns.ts", inScope: true },
  { id: "no-show-recovery-config", capability: "No-show recovery automation configuration", domain: "Appointments", manifestIds: ["appointments-no-show-recovery", "workflow-builder"], uiRepresentation: "Recovery settings + template link", runtimeContract: "no-show-recovery.ts", inScope: true },
  { id: "auto-no-show-scan", capability: "Automatic no-show marking scan", domain: "Appointments", manifestIds: ["appointments-no-show-recovery", "appointment-detail"], uiRepresentation: "Status transition + timeline", runtimeContract: "workflow-scanners.scanAppointmentNoShows", inScope: true },

  // ── Appointments — Create / Detail ──
  { id: "appt-create-form", capability: "Staff create appointment form", domain: "Appointments", manifestIds: ["appointments-new"], uiRepresentation: "Multi-field form", runtimeContract: "createPlatformAppointment", inScope: true },
  { id: "appt-customer-picker", capability: "Search/create customer on appointment form", domain: "Appointments", manifestIds: ["appointments-new", "contacts"], uiRepresentation: "Contact picker", runtimeContract: "contacts API", inScope: true },
  { id: "appt-detail-header", capability: "Appointment detail header (customer, service, time, status)", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Detail header", runtimeContract: "appointment fetch", inScope: true },
  { id: "appt-confirm-staff", capability: "Staff confirm appointment", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Confirm action", runtimeContract: "PATCH /api/appointments/[id]", inScope: true },
  { id: "appt-cancel-staff", capability: "Staff cancel appointment", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Cancel action + confirm", runtimeContract: "cancelAppointment", inScope: true },
  { id: "appt-reschedule-staff", capability: "Staff reschedule with slot picker", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Reschedule flow", runtimeContract: "availability + update", inScope: true },
  { id: "appt-mark-completed", capability: "Mark appointment completed", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Complete action", runtimeContract: "status update", inScope: true },
  { id: "appt-mark-no-show", capability: "Mark appointment no-show", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "No-show action", runtimeContract: "status update", inScope: true },
  { id: "appt-internal-notes", capability: "Internal notes on appointment", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Notes field", runtimeContract: "internal-notes.ts", inScope: true },
  { id: "appt-comms-timeline", capability: "Communication timeline on detail", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Chronological timeline", runtimeContract: "metadata timeline", inScope: true },
  { id: "appt-reminder-timeline", capability: "Reminder schedule preview on detail", domain: "Appointments", manifestIds: ["appointment-detail", "reminder-sequences"], uiRepresentation: "Reminder timeline", runtimeContract: "/api/appointments/[id]/reminder-timeline", inScope: true },
  { id: "appt-reminder-override", capability: "Per-appointment reminder suppression/override", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Override toggle/controls", runtimeContract: "reminder-state.ts", inScope: true },
  { id: "appt-extra-recipients", capability: "Extra reminder recipients per appointment", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Recipient list input", runtimeContract: "metadata extraRecipients", inScope: true },
  { id: "appt-slot-diagnostics", capability: "Unavailable-slot diagnostics (why blocked)", domain: "Appointments", manifestIds: ["appointment-detail", "availability"], uiRepresentation: "Diagnostics panel", runtimeContract: "slot-diagnostics.ts", inScope: true },
  { id: "appt-approval-approve", capability: "Approve booking request", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Approve button", runtimeContract: "booking-approval.ts", inScope: true },
  { id: "appt-approval-reject", capability: "Reject booking request", domain: "Appointments", manifestIds: ["appointment-detail"], uiRepresentation: "Reject button", runtimeContract: "booking-approval.ts", inScope: true },
  { id: "appt-message-customer", capability: "Message customer from appointment", domain: "Appointments", manifestIds: ["appointment-detail", "messages-inbox"], uiRepresentation: "Message CTA → inbox", runtimeContract: "conversations link", inScope: true },
  { id: "appt-payment-status", capability: "Payment status on appointment detail", domain: "Appointments", manifestIds: ["appointment-detail", "payments-transactions"], uiRepresentation: "Payment badge + amount", runtimeContract: "metadata paymentStatus", inScope: true },
  { id: "appt-refund", capability: "Refund payment from appointment detail", domain: "Appointments", manifestIds: ["appointment-detail", "payments-transactions"], uiRepresentation: "Refund action", runtimeContract: "/api/merchant-payments/refund", inScope: true },
  { id: "appt-video-panel", capability: "Transovo Video meeting panel on appointment", domain: "Appointments", manifestIds: ["appointment-detail", "meetings-upcoming"], uiRepresentation: "Video join panel", runtimeContract: "transovo-video", inScope: true },
  { id: "appt-notetaker-panel", capability: "AI Notetaker panel on appointment", domain: "Appointments", manifestIds: ["appointment-detail", "settings-meetings"], uiRepresentation: "Notetaker controls", runtimeContract: "notetaker-panel", inScope: true },

  // ── Public appointment tokens ──
  { id: "public-confirm-token", capability: "Customer confirm via token link", domain: "Appointments", manifestIds: ["public-confirm"], uiRepresentation: "Confirm page", runtimeContract: "/api/public/appointments/confirm/[token]", inScope: true },
  { id: "public-cancel-token", capability: "Customer cancel via token link", domain: "Appointments", manifestIds: ["public-cancel"], uiRepresentation: "Cancel page", runtimeContract: "cancel token API", inScope: true },
  { id: "public-reschedule-token", capability: "Customer reschedule via token with slot list", domain: "Appointments", manifestIds: ["public-reschedule"], uiRepresentation: "Reschedule page", runtimeContract: "reschedule token + availability", inScope: true },

  // ── Booking Types ──
  { id: "type-crud", capability: "Booking type create/edit/delete", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Type cards + editor", runtimeContract: "upsertAppointmentType", inScope: true },
  { id: "type-visibility", capability: "Type visibility (public / unlisted / secret)", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Visibility select", runtimeContract: "AppointmentTypeConfig.visibility", inScope: true },
  { id: "type-multiple-durations", capability: "Multiple duration options per type", domain: "Booking", manifestIds: ["booking-types", "public-booking"], uiRepresentation: "Duration picker", runtimeContract: "DurationOption", inScope: true },
  { id: "type-buffers", capability: "Buffer before/after per type", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Buffer inputs", runtimeContract: "bufferBefore/AfterMinutes", inScope: true },
  { id: "type-custom-questions", capability: "Custom booking questions per type", domain: "Booking", manifestIds: ["booking-types", "public-booking"], uiRepresentation: "Question builder + public form", runtimeContract: "BookingQuestion", inScope: true },
  { id: "type-staff-any", capability: "Staff assignment: any available", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Host mode option", runtimeContract: "StaffAssignmentMode", inScope: true },
  { id: "type-staff-specific", capability: "Staff assignment: specific host(s)", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Host picker", runtimeContract: "assigned staff IDs", inScope: true },
  { id: "type-staff-customer-chooses", capability: "Staff assignment: customer chooses host", domain: "Booking", manifestIds: ["booking-types", "public-booking"], uiRepresentation: "Host selection step", runtimeContract: "StaffAssignmentMode", inScope: true },
  { id: "type-round-robin", capability: "Round-robin host distribution", domain: "Booking", manifestIds: ["booking-types", "team-pages"], uiRepresentation: "Round robin config", runtimeContract: "StaffAssignmentMode.round_robin", inScope: true },
  { id: "type-collective", capability: "Collective scheduling (all hosts)", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Collective mode option", runtimeContract: "StaffAssignmentMode.collective", inScope: true },
  { id: "type-maximize-availability", capability: "Maximize availability host selection", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Assignment mode option", runtimeContract: "scheduling-domain", inScope: true },
  { id: "type-group-capacity", capability: "Group booking capacity / seats", domain: "Booking", manifestIds: ["booking-types", "public-booking"], uiRepresentation: "Capacity field + attendee count", runtimeContract: "GroupBookingConfig", inScope: true },
  { id: "type-recurring", capability: "Recurring bookings (weekly/biweekly/monthly)", domain: "Booking", manifestIds: ["public-booking", "booking-types"], uiRepresentation: "Recurrence option on book", runtimeContract: "recurring.ts", inScope: true },
  { id: "type-cancellation-policy", capability: "Cancellation policy per type", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Policy settings", runtimeContract: "CancellationPolicy", inScope: true },
  { id: "type-reschedule-policy", capability: "Reschedule policy per type", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Policy settings", runtimeContract: "ReschedulePolicy", inScope: true },
  { id: "type-booking-limits", capability: "Booking limits (daily/weekly/monthly/per-type)", domain: "Booking", manifestIds: ["booking-types", "availability"], uiRepresentation: "Limit config", runtimeContract: "BookingLimitConfig", inScope: true },
  { id: "type-approval-required", capability: "Approval-required booking", domain: "Booking", manifestIds: ["booking-types", "appointment-detail"], uiRepresentation: "Approval toggle + pending state", runtimeContract: "BookingApprovalConfig", inScope: true },
  { id: "type-payment-none-deposit-full", capability: "Payment requirement (none / deposit / full)", domain: "Booking", manifestIds: ["booking-types", "public-booking"], uiRepresentation: "Payment setting + checkout step", runtimeContract: "PaymentRequirement", inScope: true },
  { id: "type-redirect-url", capability: "Post-booking redirect URL", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Redirect URL field", runtimeContract: "BookingRedirectConfig", inScope: true },
  { id: "type-confirmation-resources", capability: "Custom confirmation page resources", domain: "Booking", manifestIds: ["booking-types", "public-booking"], uiRepresentation: "Confirmation step content", runtimeContract: "ConfirmationPageResources", inScope: true },
  { id: "type-notetaker-defaults", capability: "Per-type AI notetaker defaults", domain: "Booking", manifestIds: ["booking-types", "settings-meetings"], uiRepresentation: "Notetaker toggle on type", runtimeContract: "EventTypeNotetakerConfig", inScope: true },
  { id: "type-video-defaults", capability: "Per-type Transovo Video defaults", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Video toggle on type", runtimeContract: "EventTypeVideoConfig", inScope: true },
  { id: "type-copy-link", capability: "Copy public booking link from type card", domain: "Booking", manifestIds: ["booking-types", "booking-pages"], uiRepresentation: "Copy link button", runtimeContract: "booking-links", inScope: true },
  { id: "type-preview", capability: "Preview booking page from type", domain: "Booking", manifestIds: ["booking-types", "public-booking"], uiRepresentation: "Preview action", runtimeContract: "public book route", inScope: true },
  { id: "type-bulk-edit", capability: "Bulk edit / reorder booking types", domain: "Booking", manifestIds: ["booking-types"], uiRepresentation: "Bulk edit panel", runtimeContract: "bulkUpdateAppointmentTypes", inScope: true },

  // ── Availability ──
  { id: "avail-weekly-hours", capability: "Weekly recurring availability hours", domain: "Booking", manifestIds: ["availability"], uiRepresentation: "Weekly grid", runtimeContract: "AppointmentPlatformConfig hours", inScope: true },
  { id: "avail-multi-window", capability: "Multiple time windows per day", domain: "Booking", manifestIds: ["availability"], uiRepresentation: "Split windows per day", runtimeContract: "availability windows", inScope: true },
  { id: "avail-date-overrides", capability: "Date-specific availability overrides", domain: "Booking", manifestIds: ["availability"], uiRepresentation: "Override calendar", runtimeContract: "date overrides", inScope: true },
  { id: "avail-blackouts", capability: "Blackout dates", domain: "Booking", manifestIds: ["availability"], uiRepresentation: "Blackout list", runtimeContract: "blackoutDates", inScope: true },
  { id: "avail-holidays", capability: "Holiday calendar entries", domain: "Booking", manifestIds: ["availability"], uiRepresentation: "Holiday list", runtimeContract: "HolidayCalendarEntry", inScope: true },
  { id: "avail-min-notice", capability: "Minimum booking notice", domain: "Booking", manifestIds: ["availability", "booking-types"], uiRepresentation: "Notice duration input", runtimeContract: "minNoticeMinutes", inScope: true },
  { id: "avail-max-horizon", capability: "Maximum days ahead booking", domain: "Booking", manifestIds: ["availability", "booking-types"], uiRepresentation: "Horizon input", runtimeContract: "maxDaysAhead", inScope: true },
  { id: "avail-named-schedules", capability: "Named reusable availability schedules", domain: "Booking", manifestIds: ["availability", "booking-types"], uiRepresentation: "Schedule picker", runtimeContract: "NamedAvailabilitySchedule", inScope: true },
  { id: "avail-external-busy", capability: "External calendar busy blocking", domain: "Booking", manifestIds: ["availability", "integrations-calendars", "settings-calendar"], uiRepresentation: "Blocking indicator + settings", runtimeContract: "externalCalendarBlocking", inScope: true },
  { id: "avail-staff-hours", capability: "Per-staff availability hours", domain: "Booking", manifestIds: ["availability", "booking-types"], uiRepresentation: "Staff hours in type/availability", runtimeContract: "staff-availability.ts", inScope: true },

  // ── Booking pages & public book ──
  { id: "booking-page-enable", capability: "Enable/disable public booking page", domain: "Booking", manifestIds: ["booking-pages"], uiRepresentation: "Enable toggle", runtimeContract: "bookingEnabled", inScope: true },
  { id: "booking-page-branding", capability: "Booking page business branding", domain: "Booking", manifestIds: ["booking-pages", "settings-business"], uiRepresentation: "Logo/name/phone fields", runtimeContract: "platform config", inScope: true },
  { id: "booking-embed", capability: "Embedded booking iframe", domain: "Booking", manifestIds: ["public-embed-booking", "booking-pages"], uiRepresentation: "Embed code", runtimeContract: "embedBookingUrl", inScope: true },
  { id: "booking-popup-widget", capability: "Popup booking widget script", domain: "Booking", manifestIds: ["booking-pages"], uiRepresentation: "Popup script snippet", runtimeContract: "popupBookingScript", inScope: true },
  { id: "booking-single-use-link", capability: "Single-use booking links", domain: "Booking", manifestIds: ["booking-pages", "public-booking"], uiRepresentation: "Generate single-use URL", runtimeContract: "booking-links singleUse", inScope: true },
  { id: "booking-returning-prefill", capability: "Returning invitee cookie prefill", domain: "Booking", manifestIds: ["public-booking"], uiRepresentation: "Prefilled contact fields", runtimeContract: "storeReturningInviteeCookieData", inScope: true },
  { id: "booking-email-otp", capability: "Email OTP verification for booking", domain: "Booking", manifestIds: ["public-booking"], uiRepresentation: "OTP step", runtimeContract: "/api/public/book/[slug]/otp", inScope: true },
  { id: "booking-sms-consent", capability: "SMS consent checkbox on public book", domain: "Booking", manifestIds: ["public-booking", "settings-business"], uiRepresentation: "Unchecked consent checkbox", runtimeContract: "sms-consent-disclosure", inScope: true },
  { id: "booking-utm", capability: "UTM attribution capture on booking", domain: "Booking", manifestIds: ["public-booking", "analytics-overview"], uiRepresentation: "Hidden capture → analytics", runtimeContract: "UtmAttribution metadata", inScope: true },
  { id: "booking-fraud-challenge", capability: "Human verification / fraud challenge", domain: "Booking", manifestIds: ["public-booking"], uiRepresentation: "Challenge step", runtimeContract: "booking-protection", inScope: true },
  { id: "booking-protection-mode", capability: "Booking protection mode (standard/strict/off)", domain: "Booking", manifestIds: ["booking-pages", "settings-business"], uiRepresentation: "Protection setting", runtimeContract: "bookingProtection config", inScope: true },
  { id: "public-slot-picker", capability: "Public availability slot picker", domain: "Booking", manifestIds: ["public-booking", "public-booking-service"], uiRepresentation: "Date + slot UI", runtimeContract: "availability-engine", inScope: true },
  { id: "public-service-select", capability: "Service/type selection step", domain: "Booking", manifestIds: ["public-booking-service"], uiRepresentation: "Service list step", runtimeContract: "public book service route", inScope: true },
  { id: "public-stripe-checkout", capability: "Stripe checkout during booking", domain: "Booking", manifestIds: ["public-booking", "integrations-payments"], uiRepresentation: "Checkout redirect", runtimeContract: "createAppointmentCheckoutSession", inScope: true },
  { id: "public-square-payment", capability: "Square payment step during booking", domain: "Booking", manifestIds: ["public-booking", "integrations-payments"], uiRepresentation: "Square payment UI", runtimeContract: "square-payment-step", inScope: true },
  { id: "public-ai-book-chat", capability: "Public AI-assisted booking chat on page", domain: "Booking", manifestIds: ["public-booking", "ai-booking"], uiRepresentation: "AI chat widget", runtimeContract: "/api/public/book/[slug]/ai", inScope: true },
  { id: "public-reminder-diagnostics", capability: "Public reminder diagnostics page", domain: "Booking", manifestIds: ["public-booking", "booking-pages"], uiRepresentation: "/book/[slug]/reminders", runtimeContract: "reminder preview API", inScope: true },

  // ── Routing & polls & team ──
  { id: "routing-forms-builder", capability: "Routing forms builder", domain: "Booking", manifestIds: ["routing-forms"], uiRepresentation: "Form editor", runtimeContract: "routing-forms.ts", inScope: true },
  { id: "routing-forms-public", capability: "Public routing form submission", domain: "Booking", manifestIds: ["routing-forms"], uiRepresentation: "Public /routing/[slug]/[formSlug]", runtimeContract: "public-routing-form-client", inScope: true },
  { id: "routing-analytics", capability: "Routing form conversion analytics", domain: "Booking", manifestIds: ["routing-forms", "analytics-overview"], uiRepresentation: "Conversion stats", runtimeContract: "routingAnalytics", inScope: true },
  { id: "routing-rules", capability: "Deterministic routing rules (answers → destination)", domain: "Booking", manifestIds: ["routing-forms", "booking-types"], uiRepresentation: "Rules config", runtimeContract: "RoutingRule", inScope: true },
  { id: "meeting-polls-create", capability: "Meeting polls create/vote/book winner", domain: "Booking", manifestIds: ["meeting-polls"], uiRepresentation: "Poll builder + vote UI", runtimeContract: "meeting-polls.ts", inScope: true },
  { id: "team-booking-pages", capability: "Team multi-type booking landing pages", domain: "Booking", manifestIds: ["team-pages"], uiRepresentation: "Team page editor + public /team/", runtimeContract: "TeamBookingPage", inScope: true },

  // ── AI Booking admin ──
  { id: "ai-booking-admin-console", capability: "AI booking admin test console", domain: "Booking", manifestIds: ["ai-booking"], uiRepresentation: "Admin test UI", runtimeContract: "ai-booking-orchestrator", inScope: true },
  { id: "ai-booking-sms-inbound", capability: "Inbound SMS AI booking in conversations", domain: "Messages", manifestIds: ["messages-inbox", "ai-booking"], uiRepresentation: "Auto-reply booking flow", runtimeContract: "ai-scheduling channel-adapters", inScope: true },
  { id: "ai-booking-email-webhook", capability: "Inbound email AI booking", domain: "Messages", manifestIds: ["ai-booking", "integrations-calendars"], uiRepresentation: "Email webhook handler UI status", runtimeContract: "/api/webhooks/email-booking", inScope: true },

  // ── Contacts ──
  { id: "contacts-list", capability: "Contacts list search/filter", domain: "Contacts", manifestIds: ["contacts"], uiRepresentation: "Contacts table", runtimeContract: "contacts API", inScope: true },
  { id: "contacts-detail", capability: "Contact detail profile", domain: "Contacts", manifestIds: ["contact-detail"], uiRepresentation: "Profile layout", runtimeContract: "contact fetch", inScope: true },
  { id: "contacts-appt-history", capability: "Contact appointment history panel", domain: "Contacts", manifestIds: ["contact-detail"], uiRepresentation: "Upcoming/past appointments", runtimeContract: "contact-appointments-panel", inScope: true },
  { id: "contacts-send-booking-link", capability: "Send booking link to contact (SMS/email)", domain: "Contacts", manifestIds: ["contact-detail", "booking-pages"], uiRepresentation: "Send link action", runtimeContract: "contact-booking-actions", inScope: true },
  { id: "contacts-lists", capability: "Contact lists management", domain: "Contacts", manifestIds: ["contacts-lists"], uiRepresentation: "Lists UI", runtimeContract: "lists API", inScope: true },
  { id: "contacts-segments", capability: "Contact segments (incl. appointment filters)", domain: "Contacts", manifestIds: ["contacts-segments"], uiRepresentation: "Segment builder", runtimeContract: "segment-query appointment filters", inScope: true },
  { id: "contacts-custom-fields", capability: "Custom contact fields", domain: "Contacts", manifestIds: ["contacts-fields"], uiRepresentation: "Fields manager", runtimeContract: "custom-fields.ts", inScope: true },
  { id: "contacts-imports", capability: "CSV contact import", domain: "Contacts", manifestIds: ["contacts-imports"], uiRepresentation: "Import wizard", runtimeContract: "imports API", inScope: true },
  { id: "contacts-auto-create-on-book", capability: "Auto-create contact on public booking", domain: "Contacts", manifestIds: ["public-booking", "contacts"], uiRepresentation: "Implicit on book submit", runtimeContract: "resolveOrCreateContact", inScope: true },

  // ── Messages ──
  { id: "inbox-thread-list", capability: "Shared inbox thread list", domain: "Messages", manifestIds: ["messages-inbox"], uiRepresentation: "Inbox layout", runtimeContract: "inbox API", inScope: true },
  { id: "inbox-appointment-context", capability: "Appointment context badge on thread", domain: "Messages", manifestIds: ["messages-inbox"], uiRepresentation: "Context chip", runtimeContract: "appointmentContext in inbox", inScope: true },
  { id: "inbox-filters-appointment", capability: "Inbox filters (all, unread, appointments)", domain: "Messages", manifestIds: ["messages-inbox"], uiRepresentation: "Filter tabs", runtimeContract: "conversation filters", inScope: true },
  { id: "inbox-reply-sms", capability: "Reply to customer via SMS", domain: "Messages", manifestIds: ["messages-inbox"], uiRepresentation: "Composer", runtimeContract: "messaging send", inScope: true },
  { id: "inbox-saved-replies", capability: "Saved replies library", domain: "Messages", manifestIds: ["messages-saved-replies"], uiRepresentation: "Saved replies manager", runtimeContract: "saved replies API", inScope: true },
  { id: "inbox-unknown-replies", capability: "Unknown SMS reply handling (workflow context)", domain: "Messages", manifestIds: ["messages-inbox", "workflow-builder"], uiRepresentation: "Unknown replies reference", runtimeContract: "unknown-replies-panel", inScope: true },
  { id: "reminder-sms-send", capability: "Appointment reminder SMS delivery", domain: "Messages", manifestIds: ["reminder-sequences"], uiRepresentation: "Timeline sent state", runtimeContract: "sms-sender reminder-delivery", inScope: true },
  { id: "reminder-email-tracking", capability: "Reminder email with open/click tracking", domain: "Messages", manifestIds: ["reminder-sequences", "analytics-reminders"], uiRepresentation: "Email sent + tracking", runtimeContract: "sendReminderEmailWithTracking", inScope: true },

  // ── Automations — Reminders ──
  { id: "reminder-default-sequence", capability: "Default reminder sequence (confirm, 24h, 2h)", domain: "Automations", manifestIds: ["reminder-sequences"], uiRepresentation: "Sequence cards", runtimeContract: "AppointmentPlatformConfig.reminders", inScope: true },
  { id: "reminder-channels", capability: "Reminder channels SMS / email / voice", domain: "Automations", manifestIds: ["reminder-sequences"], uiRepresentation: "Channel select per step", runtimeContract: "ReminderStepExtended.channel", inScope: true },
  { id: "reminder-time-of-day", capability: "Time-of-day reminders (e.g. 9am day before)", domain: "Automations", manifestIds: ["reminder-sequences"], uiRepresentation: "Time-of-day picker", runtimeContract: "ReminderTimeOfDay", inScope: true },
  { id: "reminder-stop-on-reply", capability: "Stop reminder sequence on customer reply", domain: "Automations", manifestIds: ["reminder-sequences"], uiRepresentation: "Toggle on step", runtimeContract: "stopOnReply", inScope: true },
  { id: "reminder-skip-weekends", capability: "Skip weekends/closed days for reminders", domain: "Automations", manifestIds: ["reminder-sequences"], uiRepresentation: "Step flags", runtimeContract: "reminder step flags", inScope: true },
  { id: "reminder-template-vars", capability: "Reminder template merge variables", domain: "Automations", manifestIds: ["reminder-sequences"], uiRepresentation: "Variable insertion in template", runtimeContract: "appointmentMergeVars", inScope: true },
  { id: "reminder-per-calendar-defaults", capability: "Per-calendar reminder defaults", domain: "Automations", manifestIds: ["reminder-sequences", "settings-calendar"], uiRepresentation: "Calendar-specific defaults", runtimeContract: "PerCalendarReminderDefaults", inScope: true },
  { id: "reminder-ics-attachment", capability: "ICS calendar attachment on email reminders", domain: "Automations", manifestIds: ["reminder-sequences"], uiRepresentation: "ICS in email", runtimeContract: "ics-builder.ts", inScope: true },

  // ── Automations — Workflows ──
  { id: "workflow-list", capability: "Workflow list view", domain: "Automations", manifestIds: ["workflow-builder"], uiRepresentation: "Workflow table/cards", runtimeContract: "appointment-workflows/service", inScope: true },
  { id: "workflow-custom-create", capability: "Create custom workflow", domain: "Automations", manifestIds: ["workflow-new", "workflow-builder"], uiRepresentation: "New workflow flow", runtimeContract: "AppointmentWorkflowRecord", inScope: true },
  { id: "workflow-edit", capability: "Edit workflow canvas", domain: "Automations", manifestIds: ["workflow-edit", "workflow-builder"], uiRepresentation: "Builder canvas", runtimeContract: "workflow editor API", inScope: true },
  { id: "workflow-setup-wizard", capability: "Prebuilt workflow setup wizard", domain: "Automations", manifestIds: ["workflow-setup", "automation-templates"], uiRepresentation: "Template wizard steps", runtimeContract: "templates.ts setup route", inScope: true },
  { id: "workflow-triggers", capability: "Workflow triggers (booked, confirmed, canceled, payment, etc.)", domain: "Automations", manifestIds: ["workflow-builder"], uiRepresentation: "Trigger picker", runtimeContract: "APPOINTMENT_WORKFLOW_TRIGGERS", inScope: true },
  { id: "workflow-conditions", capability: "Workflow conditions (status, type, payment, consent)", domain: "Automations", manifestIds: ["workflow-builder"], uiRepresentation: "Condition nodes", runtimeContract: "WorkflowConditionOperator", inScope: true },
  { id: "workflow-actions-sms-email", capability: "Workflow SMS/email actions", domain: "Automations", manifestIds: ["workflow-builder"], uiRepresentation: "Action nodes", runtimeContract: "WorkflowStepAction", inScope: true },
  { id: "workflow-actions-webhook", capability: "Workflow outbound webhook action", domain: "Automations", manifestIds: ["workflow-builder"], uiRepresentation: "Webhook node", runtimeContract: "webhook-delivery.ts", inScope: true },
  { id: "workflow-actions-payment-link", capability: "Workflow payment link generation", domain: "Automations", manifestIds: ["workflow-builder", "payments-transactions"], uiRepresentation: "Payment link action", runtimeContract: "payment-link.ts", inScope: true },
  { id: "workflow-preview-test", capability: "Workflow preview / test run", domain: "Automations", manifestIds: ["workflow-builder"], uiRepresentation: "Test/preview controls", runtimeContract: "/api/appointments/workflows/preview", inScope: true },
  { id: "workflow-activity-logs", capability: "Workflow execution activity logs", domain: "Automations", manifestIds: ["automation-activity"], uiRepresentation: "Activity log table", runtimeContract: "workflow-logs-panel", inScope: true },
  { id: "workflow-templates-gallery", capability: "Prebuilt workflow templates gallery", domain: "Automations", manifestIds: ["automation-templates"], uiRepresentation: "Template cards", runtimeContract: "appointment-workflows/templates.ts", inScope: true },
  { id: "workflow-booking-requested-triggers", capability: "Booking requested/approved/rejected workflow triggers", domain: "Automations", manifestIds: ["workflow-builder", "appointment-detail"], uiRepresentation: "Approval triggers", runtimeContract: "booking-approval + scanners", inScope: true },
  { id: "workflow-meeting-recap-triggers", capability: "Meeting completed / recap ready triggers", domain: "Automations", manifestIds: ["workflow-builder", "meetings-recaps"], uiRepresentation: "Meeting triggers", runtimeContract: "workflow trigger types", inScope: true },

  // ── Meetings ──
  { id: "meetings-upcoming-list", capability: "Upcoming meetings (notetaker home)", domain: "Meetings", manifestIds: ["meetings-upcoming"], uiRepresentation: "Upcoming list", runtimeContract: "notetaker-home", inScope: true },
  { id: "meetings-recaps-list", capability: "Meeting recaps list", domain: "Meetings", manifestIds: ["meetings-recaps"], uiRepresentation: "Recaps table", runtimeContract: "meetings list API", inScope: true },
  { id: "meetings-recap-detail", capability: "Meeting recap detail (transcript, summary)", domain: "Meetings", manifestIds: ["meeting-detail"], uiRepresentation: "Recap detail page", runtimeContract: "meeting detail API", inScope: true },
  { id: "meetings-shared-recap-token", capability: "Shared recap via public token", domain: "Meetings", manifestIds: ["meetings-recaps"], uiRepresentation: "/recap/[token]", runtimeContract: "recap share client", inScope: true },
  { id: "meetings-url-on-book", capability: "Meeting URL resolution on booking confirmation", domain: "Meetings", manifestIds: ["public-booking", "booking-types"], uiRepresentation: "Meeting link on confirm", runtimeContract: "resolveMeetingUrlForAppointment", inScope: true },
  { id: "meetings-host-join", capability: "Host join video from appointment", domain: "Meetings", manifestIds: ["appointment-detail", "meetings-upcoming"], uiRepresentation: "Host join CTA", runtimeContract: "/api/appointments/[id]/video/join", inScope: true },

  // ── Payments ──
  { id: "payments-transactions-list", capability: "Payment transactions list", domain: "Payments", manifestIds: ["payments-transactions"], uiRepresentation: "Transactions table", runtimeContract: "merchant-payments API", inScope: true },
  { id: "payments-deposit-at-book", capability: "Collect deposit at booking", domain: "Payments", manifestIds: ["public-booking", "payments-transactions"], uiRepresentation: "Checkout step", runtimeContract: "PaymentRequirement deposit", inScope: true },
  { id: "payments-workflow-triggers", capability: "Payment required/received/failed workflow triggers", domain: "Payments", manifestIds: ["workflow-builder", "payments-transactions"], uiRepresentation: "Payment trigger nodes", runtimeContract: "payment workflow triggers", inScope: true },
  { id: "payments-merchant-setup", capability: "Merchant payment integration setup", domain: "Payments", manifestIds: ["integrations-payments", "settings-billing"], uiRepresentation: "Connect Stripe/Square", runtimeContract: "stripe-connect", inScope: true },

  // ── Analytics ──
  { id: "analytics-overview-metrics", capability: "Analytics overview operational metrics", domain: "Analytics", manifestIds: ["analytics-overview"], uiRepresentation: "Overview dashboard", runtimeContract: "analytics.ts", inScope: true },
  { id: "analytics-booking-metrics", capability: "Booking metrics (booked, confirmed, canceled, no-show)", domain: "Analytics", manifestIds: ["analytics-booking"], uiRepresentation: "Booking charts", runtimeContract: "loadAppointmentsAnalytics", inScope: true },
  { id: "analytics-reminder-metrics", capability: "Reminder delivery metrics", domain: "Analytics", manifestIds: ["analytics-reminders"], uiRepresentation: "Reminder charts", runtimeContract: "reminder analytics", inScope: true },
  { id: "analytics-automation-metrics", capability: "Automation/workflow metrics", domain: "Analytics", manifestIds: ["analytics-automations"], uiRepresentation: "Automation charts", runtimeContract: "workflow metrics", inScope: true },
  { id: "analytics-utm-popular", capability: "Popular types/times and UTM attribution", domain: "Analytics", manifestIds: ["analytics-overview", "analytics-reports"], uiRepresentation: "Extended metrics", runtimeContract: "analytics-reports.ts", inScope: true },
  { id: "analytics-csv-export", capability: "CSV export of appointment data", domain: "Analytics", manifestIds: ["analytics-reports"], uiRepresentation: "Export button", runtimeContract: "appointmentsToCsv", inScope: true },
  { id: "analytics-pdf-report", capability: "PDF report generation", domain: "Analytics", manifestIds: ["analytics-reports"], uiRepresentation: "PDF download", runtimeContract: "buildAppointmentPdfReport", inScope: true },
  { id: "analytics-scheduled-email", capability: "Scheduled emailed reports (daily/weekly)", domain: "Analytics", manifestIds: ["analytics-reports"], uiRepresentation: "Schedule report UI", runtimeContract: "scheduleEmailedReport", inScope: true },

  // ── Integrations ──
  { id: "integrations-google-calendar", capability: "Google calendar connect + sync", domain: "Integrations", manifestIds: ["integrations-calendars", "settings-calendar"], uiRepresentation: "Connect card", runtimeContract: "calendar OAuth", inScope: true },
  { id: "integrations-microsoft-calendar", capability: "Microsoft/Outlook calendar connect", domain: "Integrations", manifestIds: ["integrations-calendars", "settings-calendar"], uiRepresentation: "Connect card", runtimeContract: "calendar OAuth", inScope: true },
  { id: "integrations-calendly-webhook", capability: "Calendly webhook ingestion", domain: "Integrations", manifestIds: ["integrations-calendars"], uiRepresentation: "Webhook status", runtimeContract: "/api/integrations/calendly/webhook", inScope: true },
  { id: "integrations-payments-connect", capability: "Payment processor integration", domain: "Integrations", manifestIds: ["integrations-payments"], uiRepresentation: "Payments connect UI", runtimeContract: "payments integration API", inScope: true },

  // ── Settings ──
  { id: "settings-business-profile", capability: "Business profile (name, phone, address, timezone)", domain: "Settings", manifestIds: ["settings-business"], uiRepresentation: "Business form", runtimeContract: "/api/appointments/settings", inScope: true },
  { id: "settings-booking-enabled", capability: "Global booking enabled toggle", domain: "Settings", manifestIds: ["settings-business", "booking-pages"], uiRepresentation: "Master toggle", runtimeContract: "bookingEnabled", inScope: true },
  { id: "settings-sms-consent-text", capability: "SMS consent text and version", domain: "Settings", manifestIds: ["settings-business", "settings-messaging"], uiRepresentation: "Consent copy fields", runtimeContract: "consentText/version", inScope: true },
  { id: "settings-terms-privacy", capability: "Terms and privacy URLs for public book", domain: "Settings", manifestIds: ["settings-business", "public-booking"], uiRepresentation: "URL fields", runtimeContract: "termsUrl/privacyUrl", inScope: true },
  { id: "settings-team-users", capability: "Team members and roles", domain: "Settings", manifestIds: ["settings-users"], uiRepresentation: "Users table", runtimeContract: "workspace users API", inScope: true },
  { id: "settings-messaging", capability: "Messaging/sender configuration", domain: "Settings", manifestIds: ["settings-messaging"], uiRepresentation: "Messaging settings", runtimeContract: "messaging settings API", inScope: true },
  { id: "settings-calendar-defaults", capability: "Calendar connection defaults and import", domain: "Settings", manifestIds: ["settings-calendar"], uiRepresentation: "Calendar settings", runtimeContract: "calendar settings API", inScope: true },
  { id: "settings-notetaker", capability: "AI Notetaker / meetings settings", domain: "Settings", manifestIds: ["settings-meetings"], uiRepresentation: "Notetaker settings", runtimeContract: "notetaker-settings", inScope: true },
  { id: "settings-security", capability: "Security settings (MFA, sessions)", domain: "Settings", manifestIds: ["settings-security"], uiRepresentation: "Security panel", runtimeContract: "security settings API", inScope: true },
  { id: "settings-billing", capability: "Billing and subscription", domain: "Settings", manifestIds: ["settings-billing"], uiRepresentation: "Billing UI", runtimeContract: "billing API", inScope: true },
  { id: "settings-suspicious-bookings-log", capability: "Suspicious booking log review", domain: "Settings", manifestIds: ["settings-business", "booking-pages"], uiRepresentation: "Suspicious bookings list", runtimeContract: "suspiciousBookings config", inScope: true },

  // ── Setup / Help ──
  { id: "setup-wizard", capability: "Appointments get-started wizard", domain: "Home", manifestIds: ["appointments-setup"], uiRepresentation: "Setup checklist wizard", runtimeContract: "setup-connected", inScope: true },
  { id: "help-getting-started", capability: "Help / getting started guide", domain: "Settings", manifestIds: ["help-getting-started"], uiRepresentation: "Help content", runtimeContract: "static help", inScope: true },

  // ── Cross-cutting runtime (customer-visible outcomes) ──
  { id: "atomic-slot-booking", capability: "Atomic slot booking under concurrency", domain: "Booking", manifestIds: ["public-booking", "appointment-detail"], uiRepresentation: "Reliable book/reschedule", runtimeContract: "slot-booking.ts", inScope: true },
  { id: "reminder-state-machine", capability: "Reminder regeneration on reschedule/cancel", domain: "Automations", manifestIds: ["reminder-sequences", "appointment-detail"], uiRepresentation: "Updated timeline", runtimeContract: "reminder-state.ts", inScope: true },

  // ── EXCLUDED legacy (must NOT appear in Mode 4 UI) ──
  { id: "ex-mctb-missed-calls", capability: "MCTB missed calls list", domain: "Excluded", manifestIds: [], uiRepresentation: "N/A", runtimeContract: "/voice/missed-calls", inScope: false, excludeReason: "MISSED_CALL_TEXT_BACK_IN_V1_NAV=false" },
  { id: "ex-mctb-setup", capability: "MCTB text-back setup wizard", domain: "Excluded", manifestIds: [], uiRepresentation: "N/A", runtimeContract: "/voice/setup", inScope: false, excludeReason: "MCTB out of Mode 4 scope" },
  { id: "ex-campaigns-broadcast", capability: "Mass SMS campaign broadcast builder", domain: "Excluded", manifestIds: [], uiRepresentation: "N/A", runtimeContract: "/campaigns", inScope: false, excludeReason: "MASS_MESSAGING_IN_V1_NAV=false" },
  { id: "ex-grow-keywords", capability: "Grow text-to-join keywords", domain: "Excluded", manifestIds: [], uiRepresentation: "N/A", runtimeContract: "/grow/keywords", inScope: false, excludeReason: "Grow out of scope" },
  { id: "ex-legacy-sms-automations", capability: "Legacy mass-SMS automation builder", domain: "Excluded", manifestIds: [], uiRepresentation: "N/A", runtimeContract: "/automations", inScope: false, excludeReason: "AUTOMATIONS_IN_V1_NAV=false" },
  { id: "ex-ai-receptionist", capability: "AI receptionist voice agents", domain: "Excluded", manifestIds: [], uiRepresentation: "N/A", runtimeContract: "/voice/agents", inScope: false, excludeReason: "AI_RECEPTIONIST_IN_V1_NAV=false" },
  { id: "ex-standalone-compliance", capability: "Standalone compliance nav page", domain: "Excluded", manifestIds: [], uiRepresentation: "N/A", runtimeContract: "/compliance", inScope: false, excludeReason: "COMPLIANCE_IN_V1_NAV=false" },
  { id: "ex-numbers-marketplace", capability: "Standalone numbers buy/manage marketplace", domain: "Excluded", manifestIds: [], uiRepresentation: "N/A", runtimeContract: "/numbers/buy", inScope: false, excludeReason: "NUMBERS_IN_V1_NAV=false" },
  { id: "ex-enterprise-sso", capability: "Enterprise SAML SSO admin (standalone enterprise page)", domain: "Excluded", manifestIds: [], uiRepresentation: "N/A", runtimeContract: "/appointments/enterprise", inScope: false, excludeReason: "Enterprise admin not in Mode 4 manifest" },
];

export function countAtomicFeatures(): { total: number; inScope: number; excluded: number } {
  const inScope = ATOMIC_FEATURES.filter((f) => f.inScope);
  return { total: ATOMIC_FEATURES.length, inScope: inScope.length, excluded: ATOMIC_FEATURES.length - inScope.length };
}
