#!/usr/bin/env node
/**
 * Batch 8A — mechanical feature absorption audit generator (read-only).
 * Parses docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md and emits ledger + summary.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const INVENTORY = join(ROOT, "docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md");
const OUT_DIR = join(ROOT, "docs");

/** Default final page by inventory section number */
const SECTION_DEFAULTS = {
  1: { page: "/appointments/overview", domain: "Home & Shell", parent: "Appointments", surface: "PAGE_SECTION" },
  2: { page: "/appointments/types", domain: "Booking Types", parent: "Booking", surface: "PAGE_SECTION" },
  3: { page: "/appointments/availability", domain: "Availability", parent: "Booking", surface: "PAGE_SECTION" },
  4: { page: "/appointments/staff", domain: "Staff & Locations", parent: "Booking", surface: "PAGE_SECTION" },
  5: { page: "PUBLIC_BOOKING", domain: "Public Booking", parent: "Public", surface: "PUBLIC_BOOKING" },
  6: { page: "/appointments/calendar", domain: "Calendar & Operations", parent: "Operations", surface: "PAGE_SECTION" },
  7: { page: "CUSTOMER_PORTAL", domain: "Customer Portal", parent: "Portal", surface: "CUSTOMER_PORTAL" },
  8: { page: "/appointments/packages", domain: "Packages & Sales", parent: "Commerce", surface: "PAGE_SECTION" },
  9: { page: "/appointments/types/classes", domain: "Classes", parent: "Booking Types", surface: "PAGE_SECTION" },
  10: { page: "/appointments/waitlist", domain: "Waitlist & Recalls", parent: "Operations", surface: "PAGE_SECTION" },
  11: { page: "/appointments/reminders", domain: "Reminders", parent: "Automations", surface: "PAGE_SECTION" },
  12: { page: "/appointments/workflows", domain: "Workflows", parent: "Automations", surface: "PAGE_SECTION" },
  13: { page: "/appointments/ai-booking", domain: "AI Booking", parent: "Booking", surface: "DEDICATED_PAGE" },
  14: { page: "/video", domain: "Meetings", parent: "Meetings", surface: "PAGE_SECTION" },
  15: { page: "/appointments/routing-forms", domain: "Routing & Team", parent: "Booking", surface: "PAGE_SECTION" },
  16: { page: "/appointments/analytics", domain: "Analytics", parent: "Analytics", surface: "PAGE_SECTION" },
  17: { page: "/integrations/calendars", domain: "Integrations", parent: "Platform", surface: "PAGE_SECTION" },
  18: { page: "/settings/security", domain: "Security & Org", parent: "Settings", surface: "PAGE_SECTION" },
  19: { page: "/contacts", domain: "Contacts", parent: "Contacts", surface: "PAGE_SECTION" },
  20: { page: "/integrations/calendars", domain: "Developer / Webhooks", parent: "Integrations", surface: "PAGE_SECTION" },
  21: { page: "RUNTIME_ONLY", domain: "Background Jobs", parent: "Runtime", surface: "RUNTIME_ONLY" },
};

const PARITY_ROUTES = [
  "/appointments/commerce",
  "/appointments/categories",
  "/appointments/client-restrictions",
  "/appointments/restrictions",
  "/appointments/segments",
  "/appointments/recall-campaigns",
  "/appointments/no-show-recovery",
  "/appointments/reports/service-booking",
  "/appointments/resources",
  "/appointments/classes",
  "/appointments/coupons",
  "/appointments/payments",
  "/appointments/policies",
  "/appointments/scheduled",
  "/appointments/enterprise",
  "/appointments/commerce/contact-merge",
  "/appointments/service-booking",
];

/** Feature-specific overrides (evidence from codebase audit batches 1–7) */
const FEATURE_OVERRIDES = {
  "Appointments overview (Home)": { page: "/appointments/overview", impl: "COMPLETE_CURRENT_UI", uiComplete: "LIKELY", notes: "KEEP visual; verify KPIs match runtime" },
  "Primary product nav": { page: "SHELL_RUNTIME", domain: "Product Shell", impl: "RUNTIME_ONLY_COMPLETE", uiComplete: "YES", surface: "RUNTIME_ONLY" },
  "Mobile bottom nav": { page: "SHELL_RUNTIME", domain: "Product Shell", impl: "EXTEND_EXISTING_PAGE", uiComplete: "PARTIAL" },
  "Progressive disclosure modules": { page: "SHELL_RUNTIME", domain: "Product Shell", impl: "RUNTIME_ONLY_COMPLETE", surface: "RUNTIME_ONLY" },
  "V1 launch nav gating": { page: "SHELL_RUNTIME", domain: "Product Shell", impl: "RUNTIME_ONLY_COMPLETE", surface: "RUNTIME_ONLY" },
  "Platform setup wizard": { page: "/appointments/setup", domain: "Setup", impl: "EXTEND_EXISTING_PAGE" },
  "Global search (overview)": { page: "/appointments/overview", section: "Header search", impl: "EXTEND_EXISTING_PAGE", uiComplete: "PARTIAL" },
  "Booking types list & editor": { page: "/appointments/types", impl: "EXTEND_EXISTING_PAGE", notes: "Split landing exists; mega-editor still partially shared" },
  "Archetypes MEETING / SERVICE / CLASS": { page: "/appointments/types", impl: "EXTEND_EXISTING_PAGE" },
  "Categories admin": { page: "/appointments/types/services", section: "Manage Categories drawer", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/categories" },
  "Client restrictions": { page: "/contacts/[id]", section: "Booking Access", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/client-restrictions" },
  "Audience segments": { page: "/contacts/segments", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/segments", missingUi: "AppointmentSegmentsClient unrouted; redirect in place" },
  "Scheduler theme / branding": { page: "/appointments/booking", section: "Branding", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "Commerce admin theme" },
  "Custom booking domain": { page: "/appointments/booking", section: "Branding → Custom domain", impl: "EXTEND_EXISTING_PAGE" },
  "Advanced custom CSS": { page: "/appointments/booking", section: "Branding → Advanced CSS", impl: "EXTEND_EXISTING_PAGE" },
  "Custom terminology / locale": { page: "/appointments/booking", section: "Branding → Terminology", impl: "EXTEND_EXISTING_PAGE" },
  "Share & embed hub": { page: "/appointments/booking", section: "Share & Embed", impl: "MOVE_INTO_EXISTING_PAGE" },
  "Booking QR code generator": { page: "/appointments/booking", section: "Share & Embed → QR", impl: "EXTEND_EXISTING_PAGE" },
  "Formal contracts + e-signature": { page: "/appointments/booking/forms", section: "Contracts", impl: "EXTEND_EXISTING_PAGE", missingUi: "API-first; Forms & Documents page may be thin" },
  "Intake forms on type": { page: "/appointments/booking/forms", section: "Intake templates", impl: "EXTEND_EXISTING_PAGE" },
  "Resources (rooms, equipment)": { page: "/appointments/booking/rooms-equipment", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/resources" },
  "Staff / service calendar colors": { page: "/appointments/calendar", section: "Color legend / indicators", impl: "EXTEND_EXISTING_PAGE", missingUi: "Heuristic colors only; not tied to type color config", uiComplete: "PARTIAL" },
  "Calendar slot-click create": { page: "/appointments/calendar", section: "Slot click → create", impl: "EXTEND_EXISTING_PAGE", uiComplete: "LIKELY" },
  "Meeting / video indicators": { page: "/appointments/calendar", section: "Meeting indicators", impl: "EXTEND_EXISTING_PAGE" },
  "Appointment detail": { page: "/appointments/[id]", impl: "EXTEND_EXISTING_PAGE" },
  "Policy snapshot on record": { page: "/appointments/[id]", section: "Policies snapshot", impl: "EXTEND_EXISTING_PAGE", missingUi: "Backend writes snapshot; detail display may be partial" },
  "Multi-service lines on record": { page: "/appointments/[id]", section: "Service lines", impl: "EXTEND_EXISTING_PAGE" },
  "Appointments list": { page: "/appointments", impl: "EXTEND_EXISTING_PAGE" },
  "Waitlist priority rules": { page: "/appointments/waitlist", section: "Priority rules", impl: "EXTEND_EXISTING_PAGE", missingUi: "API exists; no admin UI on waitlist page", uiPresent: "NO" },
  "Recall campaigns": { page: "/appointments/automations/recall", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/recall-campaigns" },
  "No-show recovery": { page: "/appointments/automations/no-show", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/no-show-recovery" },
  "Recalls hub": { page: "/appointments/recalls", impl: "EXTEND_EXISTING_PAGE", notes: "Operational due-customer list added Batch 7" },
  "Service booking reports": { page: "/appointments/analytics/reports", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/reports/service-booking", missingUi: "Structured panel on analytics; legacy JSON dump remains" },
  "Packages & memberships hub": { page: "/appointments/packages", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/commerce" },
  "Package products": { page: "/appointments/packages", impl: "EXTEND_EXISTING_PAGE", temp: "YES" },
  "Membership products": { page: "/appointments/memberships", impl: "EXTEND_EXISTING_PAGE", temp: "YES" },
  "Gift certificates": { page: "/appointments/gift-cards", impl: "EXTEND_EXISTING_PAGE", temp: "YES" },
  "Coupons / discounts": { page: "/appointments/discounts", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/coupons" },
  "Products for sale": { page: "/appointments/products", impl: "EXTEND_EXISTING_PAGE", temp: "YES" },
  "POS cart (session + line items)": { page: "/appointments/pos", impl: "COMPLETE_CURRENT_UI", uiComplete: "LIKELY" },
  "POS mixed checkout (service + package + membership + gift + product + discount + tip)": { page: "/appointments/pos", impl: "EXTEND_EXISTING_PAGE", uiComplete: "LIKELY" },
  "Invoices": { page: "/payments/invoices", impl: "EXTEND_EXISTING_PAGE", missingUi: "API-first; commerce panel duplicate", uiComplete: "PARTIAL" },
  "Payment transaction ledger": { page: "/payments/transactions", impl: "EXTEND_EXISTING_PAGE" },
  "Refunds (full / partial / wallet)": { page: "/payments/transactions", section: "Refund actions", impl: "EXTEND_EXISTING_PAGE" },
  "Class series admin": { page: "/appointments/types/classes", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/classes" },
  "Household / family accounts": { page: "/contacts/[id]", section: "Household", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "Commerce admin households" },
  "Contact merge": { page: "/contacts", section: "Merge tool", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/commerce/contact-merge" },
  "Custom client fields": { page: "/contacts/fields", impl: "MOVE_INTO_EXISTING_PAGE", duplicate: "YES", temp: "YES", parity: "Commerce admin custom-fields" },
  "Import / export": { page: "/contacts/imports", impl: "MOVE_INTO_EXISTING_PAGE", duplicate: "YES", temp: "YES", parity: "Commerce admin import-export" },
  "Intake form templates": { page: "/appointments/booking/forms", section: "Intake templates", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES" },
  "Outbound webhook endpoints": { page: "/integrations/calendars", section: "Developer webhooks (verify final home)", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "Commerce admin webhooks" },
  "Programs (multi-visit bundles)": { page: "V2_DEFERRED", impl: "V2_DEFERRED", v2: true },
  "Payment plans (installments)": { page: "/appointments/payments", section: "Payment plans (V2 surface)", impl: "V2_DEFERRED", v2: true },
  "Loyalty programs": { page: "V2_DEFERRED", impl: "V2_DEFERRED", v2: true },
  "Treatment records (vertical-adjacent)": { page: "V2_DEFERRED", impl: "V2_DEFERRED", v2: true },
  "Enterprise scheduling (legacy)": { page: "V2_DEFERRED", impl: "V2_DEFERRED", v2: true },
  "Calendly mapping (vertical)": { page: "V2_DEFERRED", impl: "V2_DEFERRED", v2: true },
  "Native appointments integration hub": { page: "V2_DEFERRED", impl: "V2_DEFERRED", v2: true },
  "Integration status diagnostics": { page: "RUNTIME_ONLY", impl: "RUNTIME_ONLY_COMPLETE", surface: "RUNTIME_ONLY" },
  "PWA registration": { page: "V2_DEFERRED", impl: "V2_DEFERRED", v2: true },
  "Reminder diagnostics (support)": { page: "RUNTIME_ONLY", impl: "RUNTIME_ONLY_COMPLETE", surface: "RUNTIME_ONLY" },
  "Caller Amy / appointment assistant": { page: "V2_DEFERRED", impl: "V2_DEFERRED", v2: true, notes: "AI Receptionist out of V1 scope" },
  "Routing rules (legacy)": { page: "/appointments/routing-forms", impl: "MOVE_INTO_EXISTING_PAGE", temp: "YES", parity: "/appointments/routing" },
  "Voice reminders": { page: "/appointments/reminders", section: "Voice channel", impl: "EXTEND_EXISTING_PAGE" },
  "Analytics overview": { page: "/appointments/analytics", impl: "COMPLETE_CURRENT_UI", uiComplete: "LIKELY" },
  "Revenue analytics": { page: "/appointments/analytics/revenue", impl: "EXTEND_EXISTING_PAGE", notes: "Revenue tab added Batch 7" },
};

/** Per-feature routing rules (checked before section default) */
const ROUTING_RULES = [
  { match: /MEETING|meeting type|Host|video join|Upcoming meetings|Meeting recaps|notetaker|Transovo Video|AI Notetaker|Teams meeting/i, page: "/video", domain: "Meetings Upcoming", alt: "/meetings" },
  { match: /recap|notetaker settings/i, page: "/meetings", domain: "Meetings Recaps" },
  { match: /\/settings\/transovo-video|\/settings\/ai-notetaker/i, page: "/settings/ai-notetaker", domain: "Settings → Meetings" },
  { match: /\/appointments\/types\/meetings|MEETING archetype/i, page: "/appointments/types/meetings", domain: "Meetings Editor" },
  { match: /\/appointments\/types\/services|SERVICE(?! membership)|service phase|processing time|add-on/i, page: "/appointments/types/services", domain: "Service Editor" },
  { match: /class series|class occurrence|Class check-in|seat selection|event admission|\/appointments\/types\/classes/i, page: "/appointments/types/classes", domain: "Class Editor" },
  { match: /workshop|event/i, page: "/appointments/types/events", domain: "Workshop/Event Editor" },
  { match: /\/appointments\/booking|share|embed|branding|scheduler theme|custom domain|terminology|QR/i, page: "/appointments/booking", domain: "Booking Pages" },
  { match: /contract|intake form template|e-signature|SignedBooking/i, page: "/appointments/booking/forms", domain: "Forms & Documents" },
  { match: /\/appointments\/staff|round.robin state|staff scheduling/i, page: "/appointments/staff", domain: "Staff" },
  { match: /\/appointments\/locations|location-specific/i, page: "/appointments/locations", domain: "Locations" },
  { match: /resource pool|SchedulingResource|\/appointments\/resources|rooms|equipment/i, page: "/appointments/booking/rooms-equipment", domain: "Rooms & Equipment" },
  { match: /\/appointments\/calendar|Calendar view|slot-click/i, page: "/appointments/calendar", domain: "Calendar" },
  { match: /\/appointments\/new|Create appointment \(staff\)/i, page: "/appointments/new", domain: "Create Appointment" },
  { match: /\/appointments\/\[id\]|Appointment detail|internal notes|reminder timeline|policy snapshot|multi-service|audit timeline/i, page: "/appointments/[id]", domain: "Appointment Detail" },
  { match: /Appointments list/i, page: "/appointments", domain: "Appointments List" },
  { match: /waitlist/i, page: "/appointments/waitlist", domain: "Waitlist" },
  { match: /recall/i, page: "/appointments/recalls", domain: "Recalls" },
  { match: /no-show recovery|no-show scan/i, page: "/appointments/automations/no-show", domain: "Automations" },
  { match: /recall-campaign/i, page: "/appointments/automations/recall", domain: "Automations" },
  { match: /\/appointments\/reminders|reminder sequence|voice reminder|ICS attach|SMS consent/i, page: "/appointments/reminders", domain: "Reminders" },
  { match: /\/appointments\/workflows|workflow/i, page: "/appointments/workflows", domain: "Workflows" },
  { match: /automations\/templates|Automation templates/i, page: "/appointments/automations/templates", domain: "Templates" },
  { match: /automations\/activity|Automation activity/i, page: "/appointments/automations/activity", domain: "Activity" },
  { match: /revenue|refund|deposit|gross|merchant payment|transaction ledger/i, page: "/payments/transactions", domain: "Transactions", alt: "/appointments/analytics/revenue" },
  { match: /invoice/i, page: "/payments/invoices", domain: "Invoices" },
  { match: /package|Package/i, page: "/appointments/packages", domain: "Packages" },
  { match: /membership|Membership/i, page: "/appointments/memberships", domain: "Memberships" },
  { match: /gift certificate|Gift/i, page: "/appointments/gift-cards", domain: "Gift Cards" },
  { match: /coupon|discount/i, page: "/appointments/discounts", domain: "Discounts" },
  { match: /POS|pos-cart/i, page: "/appointments/pos", domain: "Point of Sale" },
  { match: /product for sale|BookingProduct/i, page: "/appointments/products", domain: "Products" },
  { match: /\/appointments\/routing|routing form/i, page: "/appointments/routing-forms", domain: "Routing" },
  { match: /team booking|team-pages|scheduling groups/i, page: "/appointments/team-pages", domain: "Team Booking" },
  { match: /meeting poll/i, page: "/appointments/polls", domain: "Meeting Polls" },
  { match: /AI booking|ai-scheduling|ai-booking/i, page: "/appointments/ai-booking", domain: "AI Booking" },
  { match: /\/contacts\/segments|Audience segments|appointment segments/i, page: "/contacts/segments", domain: "Segments" },
  { match: /\/contacts\/fields|custom client fields|CustomerField/i, page: "/contacts/fields", domain: "Customer Fields" },
  { match: /\/contacts\/imports|Import \/ export/i, page: "/contacts/imports", domain: "Import" },
  { match: /\/contacts|Contacts \(shared\)|Conversations/i, page: "/contacts", domain: "Contacts" },
  { match: /\/conversations|Inbox/i, page: "/conversations", domain: "Messages" },
  { match: /\/book\/|Public booking|Public flow|Public |embed|manage link|\/manage\/|waitlist step|Info step|DateTime|Payment redirect/i, page: "PUBLIC_BOOKING", domain: "Public Booking", surface: "PUBLIC_BOOKING" },
  { match: /Portal|portal/i, page: "CUSTOMER_PORTAL", domain: "Customer Portal", surface: "CUSTOMER_PORTAL" },
  { match: /\/integrations\/payments|Stripe|Square/i, page: "/integrations/payments", domain: "Integrations → Payments" },
  { match: /\/integrations|Google Calendar|Microsoft|iCloud|Reserve with Google|Facebook|Instagram/i, page: "/integrations/calendars", domain: "Integrations" },
  { match: /\/settings|Granular appointment permissions|Org roles|SAML|SCIM/i, page: "/settings/security", domain: "Settings", alt: "/settings/users" },
  { match: /Commerce admin|\/appointments\/commerce|\/appointments\/categories|\/appointments\/client-restrictions|\/appointments\/restrictions|\/appointments\/coupons|\/appointments\/payments|\/appointments\/policies|\/appointments\/scheduled|\/appointments\/enterprise/i, page: "PARITY_TEMP", domain: "Parity Temp", surface: "PAGE_SECTION" },
  { match: /webhook|slot diagnostics API/i, page: "/integrations/calendars", domain: "Developer", section: "Webhooks" },
  { match: /background|job|scan|BullMQ|workflow step execution|Provider appointment sync|Platform reminder scan/i, page: "RUNTIME_ONLY", domain: "Background", surface: "RUNTIME_ONLY" },
  { match: /PROVIDER_BLOCKED|SAML|SCIM|Reserve with Google|Facebook Book|Instagram booking|iCloud/i, page: "PROVIDER_BLOCKED", domain: "Integrations", surface: "PROVIDER_BLOCKED" },
  { match: /analytics\/booking/i, page: "/appointments/analytics/booking", domain: "Analytics Booking" },
  { match: /analytics\/reminders/i, page: "/appointments/analytics/reminders", domain: "Analytics Reminders" },
  { match: /analytics\/automations/i, page: "/appointments/analytics/automations", domain: "Analytics Automations" },
  { match: /analytics\/reports|Reports hub|CSV|PDF export|scheduled.*report|service-booking report/i, page: "/appointments/analytics/reports", domain: "Reports" },
  { match: /analytics overview|Analytics overview/i, page: "/appointments/analytics", domain: "Analytics Overview" },
];

function parseInventory(md) {
  const lines = md.split("\n");
  const rows = [];
  let sectionNum = 0;
  let section = "";
  let inFeatureTable = false;

  for (const line of lines) {
    const sec = line.match(/^## (\d+)\. (.+)/);
    if (sec) {
      sectionNum = Number(sec[1]);
      section = sec[2];
      inFeatureTable = false;
      continue;
    }
    if (sectionNum < 1 || sectionNum > 21) continue;
    if (line.startsWith("| Feature |")) {
      inFeatureTable = true;
      continue;
    }
    if (!inFeatureTable || !line.startsWith("|") || line.includes("---")) continue;
    const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cols.length < 8) continue;
    if (cols[0] === "Feature" || cols[0].startsWith("**")) continue;

    const idx = rows.filter((r) => r.sectionNum === sectionNum).length + 1;
    rows.push({
      id: `${sectionNum}-${idx}`,
      sectionNum,
      section,
      feature: cols[0],
      competitors: cols[1] || "",
      implementation: cols[2] || "",
      routeUi: cols[3] || "",
      apiRuntime: cols[4] || "",
      database: cols[5] || "",
      automatedTest: cols[6] || "",
      uatStatus: cols[7] || "",
      externalDep: cols[8] || "",
    });
  }
  return rows;
}

function resolveFinalPage(row) {
  const override = FEATURE_OVERRIDES[row.feature];
  if (override?.page) {
    return {
      page: override.page,
      domain: override.domain || override.page,
      parent: SECTION_DEFAULTS[row.sectionNum]?.parent || "Appointments",
      section: override.section || "",
      surface: override.surface || "PAGE_SECTION",
    };
  }

  const hay = `${row.feature} ${row.routeUi} ${row.implementation} ${row.apiRuntime}`;
  for (const rule of ROUTING_RULES) {
    if (rule.match.test(hay)) {
      return {
        page: rule.page,
        domain: rule.domain,
        parent: SECTION_DEFAULTS[row.sectionNum]?.parent || "Appointments",
        section: rule.section || "",
        surface: rule.surface || "PAGE_SECTION",
        alt: rule.alt,
      };
    }
  }

  const def = SECTION_DEFAULTS[row.sectionNum];
  if (def) {
    return { page: def.page, domain: def.domain, parent: def.parent, section: "", surface: def.surface };
  }
  return { page: "UNASSIGNED_ERROR", domain: "Unassigned", parent: "Unassigned", section: "", surface: "PAGE_SECTION" };
}

function isV2Row(row) {
  if (FEATURE_OVERRIDES[row.feature]?.v2) return true;
  const uat = row.uatStatus;
  if (uat === "N/A") return true;
  const hay = `${row.feature} ${row.routeUi}`;
  return /enterprise scheduling|treatment records|programs \(multi|payment plans \(install|loyalty program|Caller Amy|Calendly mapping|native appointments integration|PWA registration|reminder diagnostics \(support\)/i.test(hay);
}

function isProviderBlocked(row) {
  return row.uatStatus === "PROVIDER_BLOCKED" ||
    /PROVIDER_BLOCKED|IdP|partner program|Meta Business|Apple CalDAV|Google Reserve/i.test(`${row.externalDep} ${row.feature} ${row.uatStatus}`);
}

function isParityRoute(route) {
  if (!route || route === "—") return false;
  return PARITY_ROUTES.some((p) => route.includes(p)) ||
    /Commerce admin/i.test(route);
}

function classifyRow(row) {
  const final = resolveFinalPage(row);
  const override = FEATURE_OVERRIDES[row.feature] || {};
  const route = row.routeUi;
  const uat = row.uatStatus;
  const hasApi = row.apiRuntime && row.apiRuntime !== "—";
  const hasRoute = route && route !== "—";
  const hasTest = row.automatedTest && row.automatedTest !== "—";

  let implState = override.impl || "EXTEND_EXISTING_PAGE";
  let surfaceType = override.surface || final.surface || "PAGE_SECTION";
  let uiPresent = "UNKNOWN";
  let uiComplete = "UNKNOWN";
  let backendPresent = hasApi ? "YES" : "NO";
  let backendComplete = hasTest ? "LIKELY" : hasApi ? "PARTIAL" : "NO";
  let duplicate = override.duplicate || "NO";
  let tempLocation = override.temp || (isParityRoute(route) ? "YES" : "NO");
  let missingUi = override.missingUi || "";
  let missingBackend = "";
  let notes = override.notes || "";
  let nextAction = "Extend on canonical page per IA directive";
  let publicPresent = "N/A";
  let publicComplete = "N/A";
  let portalPresent = "N/A";
  let portalComplete = "N/A";
  const v1 = isV2Row(row) || final.page === "V2_DEFERRED" ? "V2" : "V1";

  if (isProviderBlocked(row)) {
    implState = "PROVIDER_BLOCKED";
    surfaceType = "PROVIDER_BLOCKED";
    nextAction = "Blocked on external provider access";
  } else if (v1 === "V2" || final.page === "V2_DEFERRED") {
    implState = "V2_DEFERRED";
    surfaceType = "V2_DEFERRED";
    nextAction = "Defer from V1 UI batch";
  } else if (final.page === "RUNTIME_ONLY" || row.sectionNum === 21) {
    implState = "RUNTIME_ONLY_COMPLETE";
    surfaceType = "RUNTIME_ONLY";
    uiPresent = "N/A";
    uiComplete = "N/A";
    nextAction = "No admin UI required";
  } else if (final.page === "PUBLIC_BOOKING" || row.sectionNum === 5) {
    surfaceType = "PUBLIC_BOOKING";
    publicPresent = hasRoute ? "YES" : "PARTIAL";
    publicComplete = uat === "PASS" ? "LIKELY" : "PARTIAL";
    uiPresent = "N/A";
    uiComplete = "N/A";
    if (!hasRoute && hasApi) {
      implState = "PUBLIC_FLOW_MISSING";
      missingUi = missingUi || "Public customer flow not fully exposed";
      publicPresent = "NO";
    }
  } else if (final.page === "CUSTOMER_PORTAL" || /Portal/i.test(route)) {
    surfaceType = "CUSTOMER_PORTAL";
    portalPresent = hasRoute ? "YES" : "PARTIAL";
    portalComplete = uat === "PASS" ? "LIKELY" : "PARTIAL";
    uiPresent = "N/A";
    uiComplete = "N/A";
    if (!hasRoute && hasApi) implState = "PORTAL_FLOW_MISSING";
  } else if (final.page === "PARITY_TEMP" || (isParityRoute(route) && implState !== "COMPLETE_CURRENT_UI")) {
    implState = override.impl || "MOVE_INTO_EXISTING_PAGE";
    tempLocation = "YES";
    uiPresent = hasRoute ? "YES" : "NO";
    uiComplete = "PARTIAL";
    missingUi = missingUi || "Absorb from parity hub into final IA page";
    notes = notes || `Parity route: ${route}`;
  } else if (!hasRoute && hasApi) {
    implState = override.impl || "BACKEND_GAP";
    uiPresent = "NO";
    missingUi = missingUi || "Backend exists; admin/contextual UI not exposed on final page";
    if (final.page !== "UNASSIGNED_ERROR") implState = "EXTEND_EXISTING_PAGE";
  } else if (hasRoute) {
    uiPresent = override.uiPresent || "YES";
    uiComplete = override.uiComplete || (uat === "PASS" ? "LIKELY" : uat === "CODE_COMPLETE" ? "LIKELY" : "PARTIAL");
    if (override.impl) implState = override.impl;
    else if (uat === "PASS" && uiComplete === "LIKELY") implState = "COMPLETE_CURRENT_UI";
  } else {
    uiPresent = "NO";
    uiComplete = "NO";
  }

  if (implState === "MOVE_INTO_EXISTING_PAGE") {
    duplicate = duplicate === "YES" ? "YES" : "POSSIBLE";
  }

  const pageClass =
    implState === "COMPLETE_CURRENT_UI" ? "KEEP" :
    implState === "MOVE_INTO_EXISTING_PAGE" ? "MERGE" :
    implState === "V2_DEFERRED" ? "DEFERRED" :
    implState === "PROVIDER_BLOCKED" ? "PROVIDER_BLOCKED" :
    implState === "RUNTIME_ONLY_COMPLETE" ? "KEEP" : "EXTEND";

  return {
    implState,
    finalPage: final.page,
    finalDomain: final.domain,
    finalParent: final.parent,
    finalSection: override.section || final.section || final.domain,
    surfaceType,
    pageClass,
    uiPresent,
    uiComplete,
    backendPresent,
    backendComplete,
    duplicate,
    tempLocation,
    missingUi,
    missingBackend,
    notes,
    nextAction,
    publicPresent,
    publicComplete,
    portalPresent,
    portalComplete,
    providerDep: row.externalDep || "",
    v1,
  };
}

function csvEscape(s) {
  if (s == null) return "";
  const t = String(s).replace(/"/g, '""');
  return /[",\n]/.test(t) ? `"${t}"` : t;
}

function groupBy(arr, key) {
  const m = new Map();
  for (const item of arr) {
    const k = item[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

function buildGapQueue(audited) {
  const existingPages = audited.filter((r) =>
    r.v1 === "V1" &&
    !["COMPLETE_CURRENT_UI", "RUNTIME_ONLY_COMPLETE", "V2_DEFERRED", "PROVIDER_BLOCKED"].includes(r.implState) &&
    !["PUBLIC_BOOKING", "CUSTOMER_PORTAL", "RUNTIME_ONLY", "PARITY_TEMP", "SHELL_RUNTIME", "PROVIDER_BLOCKED", "V2_DEFERRED"].includes(r.finalPage) &&
    ["EXTEND_EXISTING_PAGE", "MOVE_INTO_EXISTING_PAGE", "BACKEND_GAP", "CONTEXTUAL_UI_MISSING", "PUBLIC_FLOW_MISSING", "PORTAL_FLOW_MISSING"].includes(r.implState)
  );

  const byPage = groupBy(existingPages, "finalPage");
  const priority = (r) => {
    if (r.backendPresent === "YES" && r.uiPresent !== "YES") return "P0";
    if (r.implState === "MOVE_INTO_EXISTING_PAGE") return "P0";
    if (r.uatStatus === "CODE_COMPLETE") return "P0";
    if (r.implState === "EXTEND_EXISTING_PAGE" && r.missingUi) return "P1";
    return "P2";
  };

  const lines = [
    "# Appointments — Existing Page Gap Queue (Batch 8A)",
    "",
    "**Status:** Audit-only output — do not implement from this document without explicit directive.",
    "**Generated:** 2026-09-09",
    "**Authority:** `docs/APPOINTMENTS-FEATURE-ABSORPTION-AUDIT.md`",
    "",
    "Features that must be **added to or moved into** existing final pages (not new page creation).",
    "",
  ];

  const sortedPages = [...byPage.keys()].sort();
  for (const page of sortedPages) {
    const items = byPage.get(page).sort((a, b) => priority(a).localeCompare(priority(b)));
    const p0 = items.filter((i) => priority(i) === "P0").length;
    const classification = items.some((i) => i.implState === "MOVE_INTO_EXISTING_PAGE") ? "KEEP VISUAL / ABSORB FROM PARITY" : "KEEP VISUAL / EXTEND FUNCTIONALITY";
    lines.push(`## PAGE: ${page}`);
    lines.push("");
    lines.push(`**CLASSIFICATION:** ${classification}`);
    lines.push(`**PRIORITY SUMMARY:** P0=${p0}, P1=${items.filter((i) => priority(i) === "P1").length}, P2=${items.filter((i) => priority(i) === "P2").length}`);
    lines.push("");
    lines.push("### MISSING / INCOMPLETE");
    lines.push("");
    for (const r of items) {
      lines.push(`- **[${priority(r)}]** ${r.feature}`);
      if (r.finalSection) lines.push(`  - Section: ${r.finalSection}`);
      if (r.missingUi) lines.push(`  - Gap: ${r.missingUi}`);
      if (r.tempLocation === "YES") lines.push(`  - Temp/parity: ${r.routeUi}`);
      lines.push(`  - Backend: ${r.backendPresent} (${r.implementation})`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

function buildAuditMarkdown(audited, stats) {
  const sections = [];
  sections.push("# Appointments — Feature-to-Page Absorption Audit (Batch 8A)");
  sections.push("");
  sections.push("**Status:** Discovery complete — audit only, no implementation");
  sections.push("**Generated:** 2026-09-09");
  sections.push("**Branch context:** Post Batch 7 (automations, analytics/reports, contacts canonicalization)");
  sections.push("");
  sections.push("## Purpose");
  sections.push("");
  sections.push("Reconcile every row in `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md` against the final IA. This is the authoritative gap list for the next implementation batch.");
  sections.push("");
  sections.push("## Authority order applied");
  sections.push("");
  sections.push("1. `docs/TRANSOVO-APPOINTMENTS-FINAL-PAGE-MANIFEST-IA-DIRECTIVE.md`");
  sections.push("2. `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`");
  sections.push("3. `docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md`");
  sections.push("4. `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md`");
  sections.push("5. `docs/APPOINTMENTS-PAGE-CLASSIFICATION-MANIFEST.md`");
  sections.push("6. Page blueprints + existing code/UI (evidence only)");
  sections.push("");
  sections.push("## Executive summary");
  sections.push("");
  sections.push(`| Metric | Count |`);
  sections.push(`|--------|------:|`);
  sections.push(`| Total inventory rows audited | ${stats.total} |`);
  sections.push(`| V1 rows | ${stats.v1} |`);
  sections.push(`| V2 / deferred rows | ${stats.v2} |`);
  sections.push(`| Complete on final page (no UI work) | ${stats.complete} |`);
  sections.push(`| Extend existing page | ${stats.extend} |`);
  sections.push(`| Move from parity/temp | ${stats.move} |`);
  sections.push(`| Public flow gaps | ${stats.publicGap} |`);
  sections.push(`| Portal flow gaps | ${stats.portalGap} |`);
  sections.push(`| Backend-ready / UI-missing | ${stats.backendReadyUiMissing} |`);
  sections.push(`| UI-present / backend-uncertain | ${stats.uiPresentBackendGap} |`);
  sections.push(`| Provider-blocked | ${stats.provider} |`);
  sections.push(`| Runtime-only (no admin UI) | ${stats.runtime} |`);
  sections.push(`| Temp pages with unique V1 functionality | ${stats.tempUnique} |`);
  sections.push(`| **Unassigned** | **${stats.unassigned}** |`);
  sections.push("");
  sections.push("Structured ledger: `docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv`");
  sections.push("Implementation queue: `docs/APPOINTMENTS-EXISTING-PAGE-GAP-QUEUE.md`");
  sections.push("");

  // Gap groupings A-M
  sections.push("---");
  sections.push("");
  sections.push("## Final gap grouping");
  sections.push("");

  const noChange = audited.filter((r) => r.implState === "COMPLETE_CURRENT_UI" || r.implState === "RUNTIME_ONLY_COMPLETE");
  sections.push("### A. NO CHANGE REQUIRED");
  sections.push("");
  const ncByPage = groupBy(noChange, "finalPage");
  for (const [page, items] of [...ncByPage.entries()].sort()) {
    sections.push(`**${page}** (${items.length}): ${items.map((i) => i.feature).slice(0, 5).join("; ")}${items.length > 5 ? "…" : ""}`);
  }
  sections.push("");

  const smallAdd = audited.filter((r) => r.v1 === "V1" && r.implState === "EXTEND_EXISTING_PAGE" && r.missingUi && r.missingUi.length < 80);
  sections.push("### B. EXISTING PAGE — SMALL ADDITIONS (sample)");
  sections.push("");
  const saByPage = groupBy(smallAdd.slice(0, 40), "finalPage");
  for (const [page, items] of [...saByPage.entries()].sort()) {
    sections.push(`#### ${page}`);
    for (const r of items.slice(0, 5)) {
      sections.push(`- ${r.feature}: ${r.missingUi || r.finalSection}`);
    }
  }
  sections.push("");

  const moveItems = audited.filter((r) => r.implState === "MOVE_INTO_EXISTING_PAGE");
  sections.push("### C. MOVE FROM PARITY / TEMP (high priority)");
  sections.push("");
  sections.push("| Feature | Temp location | Final page | Present on final? |");
  sections.push("|---------|---------------|------------|-------------------|");
  for (const r of moveItems.slice(0, 60)) {
    sections.push(`| ${r.feature} | ${r.routeUi} | ${r.finalPage} | ${r.uiComplete === "LIKELY" ? "Partial" : "Missing/incomplete"} |`);
  }
  sections.push("");

  const backendReady = audited.filter((r) => r.v1 === "V1" && r.backendPresent === "YES" && (r.uiPresent === "NO" || r.uiComplete === "PARTIAL") && r.implState !== "RUNTIME_ONLY_COMPLETE");
  sections.push("### I. BACKEND-READY / UI-MISSING");
  sections.push("");
  sections.push("| Feature | Backend | Final page | Required UI | Complexity |");
  sections.push("|---------|---------|------------|-------------|------------|");
  for (const r of backendReady.slice(0, 50)) {
    const complexity = r.missingUi?.includes("admin") ? "MEDIUM" : "SMALL";
    sections.push(`| ${r.feature} | ${r.implementation} | ${r.finalPage} | ${r.missingUi || r.finalSection} | ${complexity} |`);
  }
  sections.push("");

  sections.push("### K. PROVIDER-BLOCKED");
  sections.push("");
  for (const r of audited.filter((r) => r.implState === "PROVIDER_BLOCKED")) {
    sections.push(`- **${r.feature}** — ${r.providerDep || r.externalDep}`);
  }
  sections.push("");

  sections.push("### L. V2 / INTENTIONALLY DEFERRED");
  sections.push("");
  for (const r of audited.filter((r) => r.implState === "V2_DEFERRED")) {
    sections.push(`- ${r.feature}`);
  }
  sections.push("");

  sections.push("### M. UNASSIGNED");
  sections.push("");
  const unassigned = audited.filter((r) => r.finalPage === "UNASSIGNED_ERROR");
  if (unassigned.length === 0) sections.push("**Count: 0** — audit complete.");
  else {
    sections.push(`**Count: ${unassigned.length}** — INCOMPLETE`);
    for (const r of unassigned) sections.push(`- ${r.id}: ${r.feature}`);
  }
  sections.push("");

  // Page-by-page absorption (key pages)
  sections.push("---");
  sections.push("");
  sections.push("## Page-by-page absorption audit");
  sections.push("");

  const KEY_PAGES = [
    { route: "/appointments/overview", name: "Home / Overview", classification: "KEEP" },
    { route: "/appointments/calendar", name: "Calendar", classification: "KEEP / EXTEND" },
    { route: "/appointments", name: "Appointments List", classification: "KEEP / EXTEND" },
    { route: "/appointments/[id]", name: "Appointment Detail", classification: "EXTEND" },
    { route: "/appointments/waitlist", name: "Waitlist", classification: "EXTEND" },
    { route: "/appointments/recalls", name: "Recalls", classification: "KEEP" },
    { route: "/appointments/booking", name: "Booking Pages", classification: "EXTEND" },
    { route: "/appointments/types", name: "Booking Types Landing", classification: "SPLIT" },
    { route: "/appointments/types/services", name: "Service Editor", classification: "NEW/SPLIT" },
    { route: "/appointments/types/meetings", name: "Meeting Editor", classification: "NEW/SPLIT" },
    { route: "/appointments/types/classes", name: "Class Editor", classification: "NEW/SPLIT" },
    { route: "/appointments/packages", name: "Packages", classification: "NEW" },
    { route: "/appointments/memberships", name: "Memberships", classification: "NEW" },
    { route: "/appointments/pos", name: "Point of Sale", classification: "KEEP/EXTEND" },
    { route: "/payments/transactions", name: "Transactions", classification: "KEEP" },
    { route: "/payments/invoices", name: "Invoices", classification: "KEEP/EXTEND" },
    { route: "/appointments/routing-forms", name: "Routing", classification: "KEEP" },
    { route: "/appointments/team-pages", name: "Team Booking", classification: "KEEP" },
    { route: "/appointments/polls", name: "Meeting Polls", classification: "KEEP" },
    { route: "/appointments/analytics", name: "Analytics Overview", classification: "KEEP" },
    { route: "/contacts/segments", name: "Segments", classification: "KEEP" },
    { route: "PUBLIC_BOOKING", name: "Public Booking", classification: "EXTEND" },
    { route: "CUSTOMER_PORTAL", name: "Customer Portal", classification: "EXTEND" },
  ];

  for (const pg of KEY_PAGES) {
    const expected = audited.filter((r) => r.finalPage === pg.route || (pg.route === "PUBLIC_BOOKING" && r.sectionNum === 5) || (pg.route === "CUSTOMER_PORTAL" && r.sectionNum === 7));
    const present = expected.filter((r) => r.uiPresent === "YES" || r.uiComplete === "LIKELY");
    const partial = expected.filter((r) => r.uiComplete === "PARTIAL");
    const missing = expected.filter((r) => r.uiPresent === "NO" || r.implState === "MOVE_INTO_EXISTING_PAGE" || r.implState === "PUBLIC_FLOW_MISSING" || r.implState === "PORTAL_FLOW_MISSING");
    const changeRequired = missing.length > 0 || partial.length > 3 ? "YES" : "NO";

    sections.push(`### ${pg.name}`);
    sections.push("");
    sections.push(`| Field | Value |`);
    sections.push(`|-------|-------|`);
    sections.push(`| Route | ${pg.route} |`);
    sections.push(`| Classification | ${pg.classification} |`);
    sections.push(`| Expected feature rows | ${expected.length} |`);
    sections.push(`| Features actually present | ${present.length} |`);
    sections.push(`| Features partially present | ${partial.length} |`);
    sections.push(`| Features missing / to absorb | ${missing.length} |`);
    sections.push(`| Page change required next batch? | **${changeRequired}** |`);
    sections.push("");
    if (missing.length > 0) {
      sections.push("**Missing / absorb:**");
      for (const r of missing.slice(0, 15)) {
        sections.push(`- ${r.feature}${r.missingUi ? ` — ${r.missingUi}` : ""}`);
      }
      if (missing.length > 15) sections.push(`- … and ${missing.length - 15} more (see ledger)`);
      sections.push("");
    }
  }

  // Contextual creation matrix
  sections.push("---");
  sections.push("");
  sections.push("## Contextual-creation absorption matrix");
  sections.push("");
  sections.push("| Dependency | Select existing? | Create new? | Manage? | Draft preserved? | Auto-select? | Destination correct? |");
  sections.push("|------------|------------------|-------------|---------|------------------|--------------|------------------------|");
  const contextual = [
    ["SERVICE → STAFF", "PARTIAL", "YES", "YES", "UNKNOWN", "PARTIAL", "YES — staff page + service editor"],
    ["SERVICE → LOCATION", "YES", "YES", "YES", "UNKNOWN", "PARTIAL", "YES"],
    ["SERVICE → ROOM/EQUIPMENT", "PARTIAL", "YES", "YES", "UNKNOWN", "NO", "PARTIAL — rooms page exists; contextual from service editor weak"],
    ["SERVICE → INTAKE FORM", "PARTIAL", "YES", "YES", "UNKNOWN", "NO", "PARTIAL — forms page new"],
    ["SERVICE → CONTRACT", "NO", "YES", "YES", "UNKNOWN", "NO", "PARTIAL"],
    ["SERVICE → PACKAGE", "PARTIAL", "YES", "YES", "UNKNOWN", "NO", "PARTIAL"],
    ["SERVICE → MEMBERSHIP", "PARTIAL", "YES", "YES", "UNKNOWN", "NO", "PARTIAL"],
    ["MEETING → HOST", "YES", "YES", "YES", "UNKNOWN", "PARTIAL", "YES"],
    ["MEETING → AVAILABILITY", "YES", "N/A", "YES", "N/A", "N/A", "YES"],
    ["CLASS → INSTRUCTOR", "PARTIAL", "YES", "YES", "UNKNOWN", "NO", "PARTIAL"],
    ["LOCATION → STAFF", "YES", "N/A", "YES", "N/A", "N/A", "YES"],
    ["CONTACT → PACKAGE", "PARTIAL", "YES", "YES", "UNKNOWN", "NO", "PARTIAL — commerce parity"],
    ["CONTACT → APPOINTMENT", "YES", "YES", "YES", "N/A", "N/A", "YES"],
  ];
  for (const row of contextual) {
    sections.push(`| ${row.join(" | ")} |`);
  }
  sections.push("");

  // Parity cross-check
  sections.push("## Parity vs final page cross-check");
  sections.push("");
  sections.push("See `docs/APPOINTMENTS-FEATURE-SPLIT-ORIGINAL-VS-PARITY.md`. Every parity feature checked against final destination in ledger column `TEMP_PARITY_EXISTS`.");
  sections.push("");

  // Mock/placeholder audit
  sections.push("## Mock / placeholder audit (meaningful hits)");
  sections.push("");
  sections.push("| Feature area | Location | Type | V1? | Required |");
  sections.push("|--------------|----------|------|-----|----------|");
  sections.push("| Booking channel integrations | `booking-channel-integrations.ts` | Provider placeholder | V1 scaffold | Live OAuth when partner access |");
  sections.push("| Analytics routing funnel | `kimi-ui/analytics/types.ts` | Demo sample data | V1 | Wire to real analytics API |");
  sections.push("| Waitlist types | waitlist page imports | mock-data residue | V1 | Use runtime types |");
  sections.push("| Commerce admin | `service-booking-admin-client.tsx` | Parity hub (24 sections) | V1 | Absorb into final pages |");
  sections.push("| Overview date picker | overview page | Decorative non-functional | V1 | Optional: wire or remove interactivity |");
  sections.push("");

  // Batch size estimate
  sections.push("## Next batch size estimate");
  sections.push("");
  sections.push(`| Category | Count |`);
  sections.push(`|----------|------:|`);
  sections.push(`| Existing pages with no change | ${stats.pagesNoChange} |`);
  sections.push(`| Existing pages needing small extension | ${stats.pagesSmall} |`);
  sections.push(`| Existing pages needing medium extension | ${stats.pagesMedium} |`);
  sections.push(`| Existing pages needing major extension | ${stats.pagesMajor} |`);
  sections.push(`| New/split pages still missing features | ${stats.newSplitGaps} |`);
  sections.push(`| Contextual UI gaps | ${stats.contextualGaps} |`);
  sections.push(`| Public booking gaps | ${stats.publicGap} |`);
  sections.push(`| Portal gaps | ${stats.portalGap} |`);
  sections.push(`| Backend-ready / UI-missing | ${stats.backendReadyUiMissing} |`);
  sections.push(`| UI-present / backend-missing | ${stats.uiPresentBackendGap} |`);
  sections.push(`| Provider-blocked | ${stats.provider} |`);
  sections.push(`| V2 deferred | ${stats.v2defer} |`);
  sections.push(`| Unassigned | ${stats.unassigned} |`);
  sections.push("");

  sections.push("---");
  sections.push("");
  sections.push("*End of Batch 8A absorption audit. Do not implement until explicit Batch 8B+ directive.*");

  return sections.join("\n");
}

function computePageStats(audited) {
  const pageGaps = groupBy(
    audited.filter((r) => r.v1 === "V1" && !["COMPLETE_CURRENT_UI", "RUNTIME_ONLY_COMPLETE", "V2_DEFERRED", "PROVIDER_BLOCKED"].includes(r.implState)),
    "finalPage"
  );
  let pagesNoChange = 0, pagesSmall = 0, pagesMedium = 0, pagesMajor = 0;
  for (const [page, items] of pageGaps) {
    if (["PUBLIC_BOOKING", "CUSTOMER_PORTAL", "RUNTIME_ONLY", "SHELL_RUNTIME"].includes(page)) continue;
    const gapCount = items.length;
    if (gapCount === 0) pagesNoChange++;
    else if (gapCount <= 3) pagesSmall++;
    else if (gapCount <= 10) pagesMedium++;
    else pagesMajor++;
  }
  const completePages = new Set(audited.filter((r) => r.implState === "COMPLETE_CURRENT_UI").map((r) => r.finalPage));
  for (const p of completePages) {
    if (!pageGaps.has(p)) pagesNoChange++;
  }
  return { pagesNoChange, pagesSmall, pagesMedium, pagesMajor };
}

function main() {
  const md = readFileSync(INVENTORY, "utf8");
  const rows = parseInventory(md);
  const audited = rows.map((row) => ({ ...row, ...classifyRow(row) }));

  const headers = [
    "FEATURE_ID", "FEATURE_NAME", "V1_V2", "CURRENT_IMPL_STATUS", "CURRENT_UI_LOCATION", "CURRENT_ROUTE",
    "BACKEND_LOCATION", "FINAL_USER_NAME", "FINAL_PARENT_DOMAIN", "FINAL_CANONICAL_PAGE", "FINAL_SECTION",
    "FINAL_SURFACE_TYPE", "FINAL_CONTEXTUAL_ENTRY", "PAGE_CLASSIFICATION", "UI_PRESENT", "UI_COMPLETE",
    "BACKEND_PRESENT", "BACKEND_COMPLETE", "PUBLIC_PRESENT", "PUBLIC_COMPLETE", "PORTAL_PRESENT", "PORTAL_COMPLETE",
    "PROVIDER_DEPENDENCY", "DUPLICATE_UI", "TEMP_PARITY_EXISTS", "IMPL_STATE", "MISSING_UI", "MISSING_BACKEND",
    "NEXT_ACTION", "UAT_STATUS", "NOTES",
  ];

  const csvLines = [headers.join(",")];
  for (const r of audited) {
    csvLines.push([
      r.id, r.feature, r.v1, r.uatStatus, r.routeUi, r.routeUi, r.implementation,
      r.feature, r.finalParent, r.finalPage, r.finalSection, r.surfaceType, "",
      r.pageClass, r.uiPresent, r.uiComplete, r.backendPresent, r.backendComplete,
      r.publicPresent, r.publicComplete, r.portalPresent, r.portalComplete,
      r.providerDep, r.duplicate, r.tempLocation, r.implState, r.missingUi, r.missingBackend,
      r.nextAction, r.uatStatus, r.notes,
    ].map(csvEscape).join(","));
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv"), csvLines.join("\n"));

  const pageStats = computePageStats(audited);
  const stats = {
    total: audited.length,
    v1: audited.filter((r) => r.v1 === "V1").length,
    v2: audited.filter((r) => r.v1 === "V2").length,
    unassigned: audited.filter((r) => r.finalPage === "UNASSIGNED_ERROR").length,
    complete: audited.filter((r) => r.implState === "COMPLETE_CURRENT_UI").length,
    extend: audited.filter((r) => r.implState === "EXTEND_EXISTING_PAGE").length,
    move: audited.filter((r) => r.implState === "MOVE_INTO_EXISTING_PAGE").length,
    backendReadyUiMissing: audited.filter((r) => r.v1 === "V1" && r.backendPresent === "YES" && (r.uiPresent === "NO" || r.uiComplete === "PARTIAL") && !["RUNTIME_ONLY_COMPLETE", "PUBLIC_BOOKING", "CUSTOMER_PORTAL"].includes(r.implState)).length,
    publicGap: audited.filter((r) => r.implState === "PUBLIC_FLOW_MISSING" || (r.sectionNum === 5 && r.publicComplete !== "LIKELY")).length,
    portalGap: audited.filter((r) => r.implState === "PORTAL_FLOW_MISSING" || (r.sectionNum === 7 && r.portalComplete !== "LIKELY")).length,
    provider: audited.filter((r) => r.implState === "PROVIDER_BLOCKED").length,
    runtime: audited.filter((r) => r.implState === "RUNTIME_ONLY_COMPLETE").length,
    v2defer: audited.filter((r) => r.implState === "V2_DEFERRED").length,
    tempUnique: audited.filter((r) => r.tempLocation === "YES" && r.v1 === "V1").length,
    uiPresentBackendGap: audited.filter((r) => r.uiPresent === "YES" && r.backendComplete !== "LIKELY" && r.v1 === "V1").length,
    contextualGaps: 13,
    newSplitGaps: audited.filter((r) => /\/appointments\/types\//.test(r.finalPage) && r.implState !== "COMPLETE_CURRENT_UI").length,
    ...pageStats,
  };

  writeFileSync(join(OUT_DIR, "APPOINTMENTS-FEATURE-ABSORPTION-STATS.json"), JSON.stringify(stats, null, 2));
  writeFileSync(join(OUT_DIR, "APPOINTMENTS-FEATURE-ABSORPTION-AUDIT.md"), buildAuditMarkdown(audited, stats));
  writeFileSync(join(OUT_DIR, "APPOINTMENTS-EXISTING-PAGE-GAP-QUEUE.md"), buildGapQueue(audited));

  console.log(JSON.stringify(stats, null, 2));
  console.log(`Wrote ${audited.length} rows`);
  return { audited, stats };
}

main();
