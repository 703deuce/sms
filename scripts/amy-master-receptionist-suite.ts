#!/usr/bin/env npx tsx
/**
 * Master receptionist E2E suite — mirrors the phone test script (CALL 1–5).
 *
 * Uses the real LLM tool loop + frontend wizard field config (no STT/TTS).
 * Sequential calls share the same tenant/phone for book → reschedule → cancel.
 *
 * Run: npm run test:amy-master-receptionist
 */
import { getPrisma } from "../src/lib/db";
import {
  createPreprodTenant,
  cleanupPreprodTenant,
  type PreprodContext,
} from "../src/lib/voice/testing/preprod-harness";
import {
  resetRealtimeSessionStoreForTests,
  InMemoryRealtimeSessionStore,
} from "../src/lib/voice/realtime-session";
import { seedAgentViaFrontendWizard } from "../src/lib/voice/testing/frontend-agent-seed";
import { runConversationScenario } from "../src/lib/voice/testing/conversation-runner";
import {
  getMasterScenario,
  MASTER_RECEPTIONIST_OPTIONAL_SCENARIOS,
  MASTER_RECEPTIONIST_SUITE_ORDER,
} from "../src/lib/voice/testing/master-receptionist-scenarios";
import { seedConfirmedAppointment } from "../src/lib/voice/testing/appointment-fixtures";
import { hasLlmConfigured } from "../src/lib/ai/llm-providers";

type SuiteReport = {
  passed: boolean;
  results: Array<{
    scenario: string;
    passed: boolean;
    turns: number;
    failures: string[];
    bookingId: string | null;
  }>;
};

async function runCoreJourney(
  ctx: PreprodContext,
  callerPhone: string,
  serviceName: string,
  useLlmCaller: boolean,
) {
  const results: SuiteReport["results"] = [];
  let priorAppointmentId: string | undefined;
  let priorStartsAt: Date | undefined;

  for (const scenarioId of MASTER_RECEPTIONIST_SUITE_ORDER) {
    const scenario = getMasterScenario(scenarioId);

    if (scenario.requiresPriorAppointment) {
      if (!priorAppointmentId) {
        const placeholderCallId = `seed-${Date.now()}`;
        const seeded = await seedConfirmedAppointment({
          workspaceId: ctx.workspaceId,
          agentId: ctx.agentId,
          callId: placeholderCallId,
          callerPhone,
          contactName: "John Smith",
          serviceName,
        });
        priorAppointmentId = seeded.appointmentId;
        priorStartsAt = seeded.startsAt;
      }
    }

    const report = await runConversationScenario({
      scenario,
      ctx,
      callerPhone,
      serviceName,
      llmCaller: useLlmCaller,
      maxTurns: scenarioId === "call-2-reschedule" || scenarioId === "call-3-cancel" ? 15 : 25,
      priorAppointmentId,
      priorStartsAt,
    });

    if (scenarioId === "call-1-hvac-booking" && report.bookingId) {
      const prisma = getPrisma();
      const appt = await prisma.voiceAppointment.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          callId: { in: ctx.callIds },
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

    results.push({
      scenario: scenarioId,
      passed: report.passed,
      turns: report.turns,
      failures: report.failures,
      bookingId: report.bookingId,
    });

    if (!report.passed) break;
  }

  return results;
}

async function runOptionalScenario(
  ctx: PreprodContext,
  scenarioId: string,
  callerPhone: string,
  serviceName: string,
  useLlmCaller: boolean,
) {
  const scenario = getMasterScenario(scenarioId);
  return runConversationScenario({
    scenario,
    ctx,
    callerPhone,
    serviceName,
    llmCaller: useLlmCaller,
    maxTurns: 15,
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (!hasLlmConfigured()) {
    console.error("OPENAI_API_KEY or DEEPSEEK_API_KEY is required for master receptionist suite");
    process.exit(1);
  }

  process.env.VOICE_RUNTIME_PROVIDER = "livekit";
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());

  const includeOptional = process.argv.includes("--all");
  const useLlmCaller = process.argv.includes("--llm-caller");
  const ctx = await createPreprodTenant();
  const callerPhone = `+1571555${String(Date.now()).slice(-4)}`;

  console.log("Amy master receptionist E2E suite");
  console.log(`Caller phone: ${callerPhone}`);
  console.log(`Optional scenarios: ${includeOptional ? "yes" : "no (pass --all)"}`);
  console.log(`Caller mode: ${useLlmCaller ? "LLM" : "scripted (phone script lines)"}\n`);

  const suite: SuiteReport = { passed: true, results: [] };

  try {
    const scenario = getMasterScenario("call-1-hvac-booking");
    const { serviceName } = await seedAgentViaFrontendWizard({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      phoneNumberE164: callerPhone,
      scenario,
    });

    const coreResults = await runCoreJourney(ctx, callerPhone, serviceName, useLlmCaller);
    suite.results.push(...coreResults);

    if (includeOptional) {
      for (const scenarioId of MASTER_RECEPTIONIST_OPTIONAL_SCENARIOS) {
        const optPhone = `+1571556${String(Date.now()).slice(-4)}`;
        const optCtx = await createPreprodTenant();
        try {
          const optScenario = getMasterScenario(scenarioId);
          await seedAgentViaFrontendWizard({
            workspaceId: optCtx.workspaceId,
            agentId: optCtx.agentId,
            phoneNumberE164: optPhone,
            scenario: optScenario,
          });
          const report = await runOptionalScenario(
            optCtx,
            scenarioId,
            optPhone,
            serviceName,
            useLlmCaller,
          );
          suite.results.push({
            scenario: scenarioId,
            passed: report.passed,
            turns: report.turns,
            failures: report.failures,
            bookingId: report.bookingId,
          });
        } finally {
          await cleanupPreprodTenant(optCtx);
        }
      }
    }

    suite.passed = suite.results.every((r) => r.passed);

    console.log("\n══ Master Receptionist Suite Summary ══");
    for (const result of suite.results) {
      const status = result.passed ? "PASS" : "FAIL";
      console.log(
        `${status}  ${result.scenario} (${result.turns} turns)${result.bookingId ? ` booking=${result.bookingId}` : ""}`,
      );
      for (const failure of result.failures) {
        console.error(`       - ${failure}`);
      }
    }

    if (!suite.passed) process.exit(1);
    console.log("\nAll master receptionist scenarios passed.");
  } finally {
    await cleanupPreprodTenant(ctx);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
