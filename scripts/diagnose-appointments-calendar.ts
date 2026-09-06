#!/usr/bin/env tsx
/**
 * Backend diagnostic for appointment booking + calendar visibility.
 * Run: npx tsx scripts/diagnose-appointments-calendar.ts
 * Live book: DRY_RUN=0 WORKSPACE_ID=... npx tsx scripts/diagnose-appointments-calendar.ts
 */
import Module from "node:module";

// Allow importing server-only app modules from scripts.
const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

import { getPrisma } from "../src/lib/db";
import { resolveWeeklyHours } from "../src/lib/appointments/availability-engine-policy";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim();
const DRY_RUN = process.env.DRY_RUN !== "0";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function warn(msg: string) {
  console.log(`  ⚠ ${msg}`);
}

function fail(msg: string) {
  console.log(`  ✗ ${msg}`);
}

async function resolveWorkspaceId() {
  const prisma = getPrisma();
  if (WORKSPACE_ID) {
    const ws = await prisma.workspace.findUnique({ where: { id: WORKSPACE_ID } });
    if (!ws) throw new Error(`WORKSPACE_ID not found: ${WORKSPACE_ID}`);
    return ws;
  }

  const withMicrosoft = await prisma.voiceCalendarConnection.findMany({
    where: { provider: "microsoft", status: "connected" },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });
  if (withMicrosoft.length === 1) {
    const ws = await prisma.workspace.findUnique({ where: { id: withMicrosoft[0].workspaceId } });
    if (ws) {
      ok(`Auto-selected workspace with connected Microsoft calendar: ${ws.id}`);
      return ws;
    }
  }

  const candidates = await prisma.workspace.findMany({
    where: {
      OR: [
        { slug: { contains: "transovo", mode: "insensitive" } },
        { name: { contains: "transovo", mode: "insensitive" } },
        { displayName: { contains: "transovo", mode: "insensitive" } },
      ],
    },
    take: 10,
  });
  if (candidates.length >= 1) {
    if (candidates.length > 1) {
      console.log("Multiple candidate workspaces:");
      for (const ws of candidates) {
        console.log(`  - ${ws.id} slug=${ws.slug}`);
      }
    }
    return candidates[0];
  }

  const fallback = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!fallback) throw new Error("No workspaces in database");
  warn(`Using first workspace: ${fallback.id}`);
  return fallback;
}

async function diagnoseWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  const { loadAppointmentPlatformConfig } = await import("../src/lib/appointments/settings");
  const { listAppointmentTypes, createPlatformAppointment } = await import(
    "../src/lib/appointments/booking-platform"
  );
  const { listAppointments } = await import("../src/lib/appointments/appointments-service");
  const { listWorkspaceCalendarEvents } = await import("../src/lib/calendar/workspace-calendar-events");
  const { generateNativeSlots } = await import("../src/lib/appointments/availability-engine");

  section("Workspace");
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  console.log(`  id=${workspaceId} slug=${ws?.slug} name=${ws?.displayName || ws?.name}`);

  section("Appointment types (voiceService)");
  const types = await listAppointmentTypes(workspaceId);
  if (!types.length) {
    fail("No appointment types in DB — admin New Appointment form has empty service dropdown");
    return;
  }
  for (const t of types) {
    const cfg = t.config || {};
    console.log(
      `  - ${t.name} (${t.id}) ${t.durationMinutes}min active=${t.active} calendarId=${t.calendarId || "none"} bookingPermission=${cfg.bookingPermission || "book_directly"}`,
    );
  }

  const activeTypes = types.filter((t) => t.active);
  if (!activeTypes.length) fail("All types disabled — nothing bookable");

  section("Platform / availability config");
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const weekly = resolveWeeklyHours(platform);
  const openDays = Object.entries(weekly).filter(([, w]) => w.length > 0).map(([d]) => d);
  console.log(`  bookingEnabled (public page)=${platform.bookingEnabled}`);
  console.log(`  timezone=${platform.timezone}`);
  console.log(`  minNotice=${platform.minimumBookingNoticeMinutes ?? 60}min maxDays=${platform.maximumBookingDaysAhead ?? 14}`);
  console.log(`  openDays=${openDays.join(", ") || "NONE"}`);
  console.log(`  confirmationSms=${platform.reminders?.confirmation?.enabled ?? true}`);
  if (!openDays.length) fail("No weekly hours — zero slots generated");

  section("Calendar connections");
  const calendars = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
  for (const c of calendars) {
    const cfg = (c.config || {}) as Record<string, unknown>;
    console.log(
      `  - ${c.provider} status=${c.status} name=${c.name} write=${String(cfg.writeCalendarId || cfg.calendarId || "—")}`,
    );
  }
  if (!calendars.length) warn("No OAuth calendar — bookings save to Transovo only");

  const linkedTypes = activeTypes.filter((t) => t.calendarId);
  for (const t of linkedTypes) {
    const cal = calendars.find((c) => c.id === t.calendarId);
    if (!cal) fail(`Type "${t.name}" links to missing calendar ${t.calendarId}`);
    else if (cal.status !== "connected") fail(`Type "${t.name}" calendar ${cal.id} status=${cal.status}`);
  }

  const testType = activeTypes[0];
  section(`Availability: "${testType.name}"`);
  let availability: { slots: Array<{ startsAt: string; endsAt: string }> };
  try {
    availability = await generateNativeSlots(workspaceId, {
      serviceName: testType.name,
      daysAhead: 14,
    });
  } catch (err) {
    fail(`Availability engine threw: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  console.log(`  slots=${availability.slots.length}`);
  if (availability.slots.length === 0) {
    fail("ZERO slots — Create appointment button disabled until user picks startsAt");
    fail("Likely causes: external calendar blocking all times, weekly hours empty, type disabled, or min notice");
  } else {
    ok(`sample: ${availability.slots[0].startsAt}`);
  }

  section("Recent appointments");
  const recent = await listAppointments(workspaceId, { take: 15 });
  console.log(`  count (latest 15)=${recent.length}`);
  for (const a of recent.slice(0, 8)) {
    console.log(`  - ${a.startsAt} ${a.serviceName} status=${a.status} ext=${a.externalId ? "yes" : "no"}`);
  }

  section("Calendar feed (next 14 days)");
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 14);
  const events = await listWorkspaceCalendarEvents(workspaceId, { from, to });
  console.log(`  events=${events.length}`);
  for (const e of events.slice(0, 5)) {
    console.log(`  - ${e.startsAt} ${e.serviceName} (${e.status})`);
  }

  if (availability.slots.length === 0) return;

  section("Booking test");
  if (DRY_RUN) {
    warn("DRY_RUN=1 — run with DRY_RUN=0 to attempt live create + SMS");
    return;
  }

  const slot = availability.slots[Math.min(2, availability.slots.length - 1)];
  try {
    const result = await createPlatformAppointment(workspaceId, {
      serviceId: testType.id,
      serviceName: testType.name,
      startsAt: slot.startsAt,
      firstName: "Diag",
      lastName: "Test",
      phone: process.env.TEST_PHONE || "+15555550199",
      smsConsent: true,
      source: "admin",
      status: "scheduled",
      skipSms: process.env.SKIP_SMS === "1",
      notes: "diagnose script — delete me",
    });
    ok(`created ${result.appointmentId}`);

    const listed = await listAppointments(workspaceId, { from: new Date(slot.startsAt) });
    if (listed.some((a) => a.id === result.appointmentId)) ok("visible in appointments list API");
    else fail("NOT in appointments list after create");

    const cal = await listWorkspaceCalendarEvents(workspaceId, {
      from: new Date(slot.startsAt),
      to: new Date(slot.endsAt),
    });
    if (cal.some((e) => e.id === result.appointmentId)) ok("visible in calendar events API");
    else fail("NOT in calendar feed after create");
  } catch (err) {
    fail(`createPlatformAppointment failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  console.log("Appointments + calendar diagnostic");
  const ws = await resolveWorkspaceId();
  await diagnoseWorkspace(ws.id);
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
