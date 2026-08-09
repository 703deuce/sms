import { getPrisma } from "@/lib/db";
import type { PreprodContext } from "./preprod-harness";
import { seedConfirmedAppointment } from "./appointment-fixtures";
import { runConversationScenario, type SimulationReport } from "./conversation-runner";
import {
  getMasterScenario,
  MASTER_RECEPTIONIST_SUITE_ORDER,
} from "./master-receptionist-scenarios";

export const COMBINED_LIFECYCLE_SCENARIO_ID = "call-combined-lifecycle" as const;

export type LifecycleStepResult = {
  scenarioId: string;
  passed: boolean;
  turns: number;
  failures: string[];
  bookingId: string | null;
};

export type LifecycleJourneyResult = {
  id: typeof COMBINED_LIFECYCLE_SCENARIO_ID;
  description: string;
  passed: boolean;
  callerPhone: string;
  steps: LifecycleStepResult[];
  appointmentId: string | null;
};

/**
 * Book → reschedule → cancel on one tenant/phone. Each step is a separate simulated call
 * sharing appointment state — mirrors the real phone test script lifecycle.
 */
export async function runBookRescheduleCancelLifecycle(input: {
  ctx: PreprodContext;
  callerPhone: string;
  serviceName: string;
  llmCaller?: boolean;
  scenarioIds?: readonly string[];
  seedAppointmentIfMissing?: boolean;
}): Promise<LifecycleJourneyResult> {
  const scenarioIds = input.scenarioIds ?? MASTER_RECEPTIONIST_SUITE_ORDER;
  const steps: LifecycleStepResult[] = [];
  let priorAppointmentId: string | undefined;
  let priorStartsAt: Date | undefined;
  let passed = true;

  for (const scenarioId of scenarioIds) {
    const scenario = getMasterScenario(scenarioId);

    if (scenario.requiresPriorAppointment && !priorAppointmentId && input.seedAppointmentIfMissing) {
      const seeded = await seedConfirmedAppointment({
        workspaceId: input.ctx.workspaceId,
        agentId: input.ctx.agentId,
        callId: `seed-${Date.now()}`,
        callerPhone: input.callerPhone,
        contactName: "John Smith",
        serviceName: input.serviceName,
      });
      priorAppointmentId = seeded.appointmentId;
      priorStartsAt = seeded.startsAt;
    }

    const report = await runConversationScenario({
      scenario,
      ctx: input.ctx,
      callerPhone: input.callerPhone,
      serviceName: input.serviceName,
      llmCaller: input.llmCaller,
      maxTurns: scenarioId.includes("reschedule") || scenarioId.includes("cancel") ? 15 : 25,
      priorAppointmentId,
      priorStartsAt,
    });

    if (scenarioId === "call-1-hvac-booking" && report.bookingId) {
      const prisma = getPrisma();
      const appt = await prisma.voiceAppointment.findFirst({
        where: {
          workspaceId: input.ctx.workspaceId,
          callId: { in: input.ctx.callIds },
          status: { notIn: ["cancelled", "canceled"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (appt) {
        priorAppointmentId = appt.id;
        priorStartsAt = appt.startsAt;
      }
    }

    if (scenarioId === "call-2-reschedule" && priorAppointmentId) {
      const prisma = getPrisma();
      const appt = await prisma.voiceAppointment.findUnique({
        where: { id: priorAppointmentId },
        select: { startsAt: true },
      });
      if (appt) priorStartsAt = appt.startsAt;
    }

    steps.push({
      scenarioId,
      passed: report.passed,
      turns: report.turns,
      failures: report.failures,
      bookingId: report.bookingId,
    });

    if (!report.passed) {
      passed = false;
      break;
    }
  }

  return {
    id: COMBINED_LIFECYCLE_SCENARIO_ID,
    description:
      "Combined lifecycle — book appointment, reschedule same customer, cancel same appointment (3 separate calls, one tenant).",
    passed,
    callerPhone: input.callerPhone,
    steps,
    appointmentId: priorAppointmentId || null,
  };
}

export function lifecycleResultToSuiteRows(
  result: LifecycleJourneyResult,
): Array<{ scenario: string; passed: boolean; turns: number; failures: string[]; bookingId: string | null }> {
  const rows = result.steps.map((step) => ({
    scenario: step.scenarioId,
    passed: step.passed,
    turns: step.turns,
    failures: step.failures,
    bookingId: step.bookingId,
  }));
  rows.push({
    scenario: result.id,
    passed: result.passed,
    turns: result.steps.reduce((sum, s) => sum + s.turns, 0),
    failures: result.passed ? [] : result.steps.flatMap((s) => s.failures),
    bookingId: result.appointmentId,
  });
  return rows;
}

export function summarizeLifecycleReport(report: SimulationReport[]): boolean {
  return report.every((r) => r.passed);
}
