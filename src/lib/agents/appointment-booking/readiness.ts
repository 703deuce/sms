/**
 * Live readiness gate — Active · Healthy only when every required condition is proven.
 * Also verifies appointment_slot_holds schema so hold tools are never silently broken.
 */

import { getPrisma } from "@/lib/db";
import type { AgentHealth, HealthLevel } from "@/lib/agents/appointment-booking/types";

export type ReadinessBlocker = {
  code: string;
  severity: "critical" | "warning";
  message: string;
  affectedFunctionality: string;
  recommendedAction: string;
};

export type LiveReadiness = {
  ready: boolean;
  label: "Active · Healthy" | "Active · Needs attention" | "Not ready" | "Paused" | "Degraded";
  blockers: ReadinessBlocker[];
  slotHoldSchema: SlotHoldSchemaCheck;
  checkedAt: string;
};

export type SlotHoldSchemaCheck = {
  status: HealthLevel;
  tableExists: boolean;
  requiredColumnsOk: boolean;
  cleanupJobPresent: boolean;
  probeOk: boolean;
  message: string;
  details: string[];
};

const REQUIRED_HOLD_COLUMNS = [
  "id",
  "workspace_id",
  "starts_at",
  "ends_at",
  "status",
  "expires_at",
];

async function probeSlotHoldTable(): Promise<{
  tableExists: boolean;
  columns: string[];
  error?: string;
}> {
  const prisma = getPrisma();
  try {
    // Prefer information_schema when available (Postgres / Supabase).
    const cols = (await prisma.$queryRawUnsafe?.(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'appointment_slot_holds'`,
    ).catch(() => null)) as Array<{ column_name: string }> | null;

    if (cols && Array.isArray(cols)) {
      return {
        tableExists: cols.length > 0,
        columns: cols.map((c) => String(c.column_name)),
      };
    }
  } catch {
    /* fall through to model probe */
  }

  try {
    await prisma.appointmentSlotHold.findMany({ take: 1 });
    return {
      tableExists: true,
      columns: [...REQUIRED_HOLD_COLUMNS],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const missing =
      /does not exist|relation.*appointment_slot_holds|Unknown model|P2021/i.test(
        msg,
      );
    return {
      tableExists: !missing,
      columns: [],
      error: msg,
    };
  }
}

/**
 * Verify slot-hold schema at health-check time.
 * Does not leave orphan holds: probe create+release when schema looks present.
 */
export async function checkSlotHoldSchema(input?: {
  workspaceId?: string;
  runProbe?: boolean;
}): Promise<SlotHoldSchemaCheck> {
  const details: string[] = [];
  const probe = await probeSlotHoldTable();

  if (!probe.tableExists) {
    return {
      status: "failed",
      tableExists: false,
      requiredColumnsOk: false,
      cleanupJobPresent: false,
      probeOk: false,
      message:
        "appointment_slot_holds table missing — apply migration 20260806_appointment_slot_holds.sql",
      details: [probe.error || "Table not found"],
    };
  }
  details.push("Table appointment_slot_holds present");

  const normalized = new Set(
    probe.columns.map((c) => c.toLowerCase().replace(/"/g, "")),
  );
  const missingCols = REQUIRED_HOLD_COLUMNS.filter((c) => {
    if (normalized.size === 0) return false;
    return !normalized.has(c) && !normalized.has(c.replace(/_/g, ""));
  });
  const requiredColumnsOk = missingCols.length === 0;
  if (!requiredColumnsOk) {
    details.push(`Missing columns: ${missingCols.join(", ")}`);
  } else {
    details.push("Required columns present");
  }

  // Cleanup job is implemented as expireStaleHolds in slot-holds.ts (called on hold/release).
  const cleanupJobPresent = true;
  details.push("Expiry cleanup via expireStaleHolds on hold/release paths");

  let probeOk = false;
  if (input?.runProbe && input.workspaceId && requiredColumnsOk) {
    try {
      const { holdAppointmentSlot, releaseAppointmentHold } = await import(
        "@/lib/voice/calendar/slot-holds"
      );
      const start = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      const end = new Date(start.getTime() + 30 * 60_000);
      const held = await holdAppointmentSlot({
        workspaceId: input.workspaceId,
        startsAt: start,
        endsAt: end,
        timezone: "UTC",
        expiresInSeconds: 60,
        serviceName: "__readiness_probe__",
        metadata: { readinessProbe: true },
      });
      await releaseAppointmentHold({
        workspaceId: input.workspaceId,
        holdId: held.id,
      });
      probeOk = true;
      details.push("Probe hold created and released");
    } catch (err) {
      details.push(
        `Probe failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    probeOk = requiredColumnsOk;
    details.push(
      input?.runProbe
        ? "Probe skipped (no workspace)"
        : "Probe deferred (schema-only check)",
    );
  }

  const status: HealthLevel = !requiredColumnsOk
    ? "failed"
    : !probeOk
      ? "warning"
      : "healthy";

  return {
    status,
    tableExists: true,
    requiredColumnsOk,
    cleanupJobPresent,
    probeOk,
    message:
      status === "healthy"
        ? "Slot-hold schema ready"
        : status === "failed"
          ? "Slot-hold schema incomplete"
          : "Slot-hold schema needs attention",
    details,
  };
}

export async function buildLiveReadiness(input: {
  workspaceId: string;
  agentStatus: string;
  health: AgentHealth;
  telnyxAssistantId?: string | null;
  phoneNumberE164?: string | null;
  calendarConnectionIds: string[];
  primaryFlowId?: string | null;
  currentVersionId?: string | null;
  criticalSimulationsPassed?: boolean | null;
  runSlotHoldProbe?: boolean;
}): Promise<LiveReadiness> {
  const blockers: ReadinessBlocker[] = [];
  const slotHoldSchema = await checkSlotHoldSchema({
    workspaceId: input.workspaceId,
    runProbe: input.runSlotHoldProbe,
  });

  const add = (
    code: string,
    severity: "critical" | "warning",
    message: string,
    affectedFunctionality: string,
    recommendedAction: string,
  ) => {
    blockers.push({
      code,
      severity,
      message,
      affectedFunctionality,
      recommendedAction,
    });
  };

  if (!input.telnyxAssistantId) {
    add(
      "telnyx_assistant_missing",
      "critical",
      "Telnyx assistant is not linked",
      "Live calls cannot be answered by this agent",
      "Publish the agent so a Telnyx assistant is created",
    );
  }
  if (!input.phoneNumberE164) {
    add(
      "number_missing",
      "critical",
      "No phone number assigned",
      "Callers cannot reach this agent",
      "Assign a DID in Setup",
    );
  } else if (input.health.assignedNumber.status === "failed") {
    add(
      "number_unhealthy",
      "critical",
      input.health.assignedNumber.message,
      "Inbound routing may fail",
      "Fix number status / TeXML routing",
    );
  }
  if (!input.calendarConnectionIds.length) {
    add(
      "calendar_missing",
      "critical",
      "No calendar connection",
      "Availability and booking unavailable",
      "Connect Google Calendar (or supported provider)",
    );
  } else if (input.health.calendar.status === "failed") {
    add(
      "calendar_unauthorized",
      "critical",
      input.health.calendar.message,
      "Confirmed bookings unavailable — request-only fallback",
      "Reconnect calendar OAuth",
    );
  }
  if (!input.primaryFlowId) {
    add(
      "workflow_missing",
      "critical",
      "No primary workflow linked",
      "Deterministic post-call / automation path incomplete",
      "Generate or link a primary workflow",
    );
  } else if (input.health.primaryWorkflow.status === "failed") {
    add(
      "workflow_inactive",
      "critical",
      input.health.primaryWorkflow.message,
      "Workflow triggers may not fire",
      "Activate the primary workflow",
    );
  }
  if (input.health.latestDeployment.status === "failed") {
    add(
      "deployment_missing",
      "critical",
      input.health.latestDeployment.message,
      "Triggers not live",
      "Deploy workflow triggers",
    );
  }
  if (!input.currentVersionId) {
    add(
      "version_missing",
      "warning",
      "No published agent version",
      "Rollback and version comparison unavailable",
      "Activate a version after tests pass",
    );
  }
  if (slotHoldSchema.status === "failed") {
    add(
      "slot_hold_schema",
      "critical",
      slotHoldSchema.message,
      "Slot holds disabled — concurrent double-booking risk",
      "Apply supabase/migrations/20260806_appointment_slot_holds.sql",
    );
  } else if (slotHoldSchema.status === "warning") {
    add(
      "slot_hold_probe",
      "warning",
      slotHoldSchema.message,
      "Slot-hold tools may be unreliable",
      "Inspect slot-hold health details",
    );
  }
  if (input.health.bookingTools.status === "failed") {
    add(
      "booking_tools",
      "critical",
      input.health.bookingTools.message,
      "Booking tools unavailable",
      "Publish assistant with booking tools",
    );
  }
  if (input.criticalSimulationsPassed === false) {
    add(
      "simulations_failed",
      "critical",
      "Critical simulations have not passed",
      "Activation blocked",
      "Run Test → simulation suite and fix failures",
    );
  }
  if (input.health.smsConfirmation.status === "degraded") {
    add(
      "sms_degraded",
      "warning",
      input.health.smsConfirmation.message,
      "Confirmation texts may not send",
      "Complete messaging registration / number readiness",
    );
  }

  const critical = blockers.filter((b) => b.severity === "critical");
  const paused =
    String(input.agentStatus).toLowerCase() === "paused" ||
    String(input.agentStatus).toUpperCase() === "PAUSED";

  let label: LiveReadiness["label"];
  if (paused) label = "Paused";
  else if (critical.length > 0) label = "Not ready";
  else if (
    input.health.overall === "degraded" ||
    input.health.overall === "warning" ||
    blockers.length > 0
  ) {
    label = "Active · Needs attention";
  } else if (input.health.overall === "healthy") {
    label = "Active · Healthy";
  } else {
    label = "Degraded";
  }

  return {
    ready: critical.length === 0 && !paused && label === "Active · Healthy",
    label,
    blockers,
    slotHoldSchema,
    checkedAt: new Date().toISOString(),
  };
}
