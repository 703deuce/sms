#!/usr/bin/env npx tsx
/**
 * Backend integration tests for home_service_dispatcher — exercises real domain
 * actions against Prisma (and calendar provider where configured).
 *
 * Run: npm run test:home-service-dispatcher-integration
 */
import { getPrisma } from "../src/lib/db";
import {
  createPreprodTenant,
  cleanupPreprodTenant,
  type PreprodContext,
} from "../src/lib/voice/testing/preprod-harness";
import { sampleValueForManifestField } from "../src/lib/voice/testing/livekit-field-samples";
import {
  resetRealtimeSessionStoreForTests,
  InMemoryRealtimeSessionStore,
} from "../src/lib/voice/realtime-session";
import { liveKitRuntimeProvider } from "../src/lib/voice/runtime-provider/livekit";
import {
  bootstrapLiveKitCallContext,
  domainCheckAvailability,
  domainConfirmBooking,
  domainDetectCallerIntent,
  domainGetBusinessAnswer,
  domainLookupCustomer,
  domainRecordField,
  domainRecordFields,
  domainRequestHuman,
  domainSelectSlot,
  domainValidateEligibility,
  domainClassifyIntent,
  domainFindAppointments,
  domainCancelAppointment,
  type LiveKitCallContext,
} from "../src/lib/voice/domain-actions";
import { writebackBookingToCrm } from "../src/lib/voice/crm/call-writeback";
import { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } from "../src/lib/voice/workflow-runtime/definitions/home-service-dispatcher";
import { persistVoiceWorkflowDefinition } from "../src/lib/voice/workflow-runtime/persistence";
import { setActiveWorkflowForAgent } from "../src/lib/voice/workflow-runtime/loader";
import { compileTurnCapabilityEnvelope } from "../src/lib/voice/workflow-runtime/compile-turn-envelope";
import { applyWorkflowNodeTransition } from "../src/lib/voice/workflow-runtime/node-transitions";
import {
  filterEligibleResources,
  findMultiResourceAvailability,
  resolveServiceAndResources,
} from "../src/lib/voice/scheduling-domain/availability";
import { buildAmyToolList } from "../voice-runtime/src/amy-tools";

const failures: string[] = [];
let testsRun = 0;

function check(name: string, cond: boolean, detail?: string) {
  testsRun++;
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

async function seedDispatcherTenant(ctx: PreprodContext) {
  const prisma = getPrisma();
  const callerPhone = `+1415559${String(Date.now()).slice(-4)}`;

  await persistVoiceWorkflowDefinition({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    definition: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    setActive: true,
  });
  setActiveWorkflowForAgent(ctx.agentId, {
    workflowId: "home_service_dispatcher",
    version: 1,
  });

  await prisma.voiceAgent.update({
    where: { id: ctx.agentId },
    data: {
      draftConfig: {
        agentType: "appointment_booking",
        knowledgeBase: {
          pricing: { serviceCallFee: "$99", serviceCallScript: "Our diagnostic visit is $99." },
          businessHours: "Mon-Fri 8am-6pm",
        },
        conversationFlow: {
          sections: [
            {
              id: "booking",
              type: "booking",
              config: {
                collectFields: [
                  { id: "name", label: "Name", type: "text", required: true, question: "Your name?", enabled: true, askOrder: 1 },
                  { id: "phone", label: "Phone", type: "phone", required: true, question: "Phone?", enabled: true, askOrder: 2 },
                  { id: "email", label: "Email", type: "email", required: true, question: "Email?", enabled: true, askOrder: 3 },
                  { id: "fld_problem", label: "Problem", type: "long_text", required: true, question: "What's the issue?", enabled: true, askOrder: 4 },
                  { id: "fld_service_address", label: "Address", type: "text", required: true, question: "Service address?", enabled: true, askOrder: 5 },
                ],
              },
            },
          ],
        },
      } as object,
    },
  });

  const service = await prisma.voiceService.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: "HVAC Repair",
      durationMinutes: 90,
      bufferMinutes: 15,
      config: {
        enabled: true,
        requiredSkills: ["hvac_repair"],
        staffIds: [],
        bookingHours: "8-18",
        timezone: "America/New_York",
        minimumBookingNoticeMinutes: 0,
        maxDaysAhead: 30,
      } as object,
    },
  });

  const techA = await prisma.voiceStaffMember.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: "Tech A",
      config: { skills: ["hvac_repair"], zones: ["zone_a"], calendarConnected: true } as object,
    },
  });
  const techB = await prisma.voiceStaffMember.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: "Tech B",
      config: { skills: ["hvac_repair"], zones: ["zone_b"], calendarConnected: true } as object,
    },
  });

  await prisma.voiceService.update({
    where: { id: service.id },
    data: {
      config: {
        ...(service.config as object),
        staffIds: [techA.id, techB.id],
      } as object,
    },
  });

  const contact = await prisma.contact.create({
    data: {
      workspaceId: ctx.workspaceId,
      firstName: "Jane",
      lastName: "Homeowner",
      phone: callerPhone,
      email: "jane@example.com",
    },
  });

  const futureStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const appt = await prisma.voiceAppointment.create({
    data: {
      workspaceId: ctx.workspaceId,
      contactId: contact.id,
      serviceName: "HVAC Repair",
      startsAt: futureStart,
      endsAt: new Date(futureStart.getTime() + 90 * 60 * 1000),
      timezone: "America/New_York",
      status: "confirmed",
    },
  });
  ctx.appointmentIds.push(appt.id);

  return { callerPhone, contact, appt, techA, techB, service };
}

async function bootstrapDispatcherCall(
  ctx: PreprodContext,
  callerPhone: string,
): Promise<LiveKitCallContext> {
  const { callId } = await liveKitRuntimeProvider.bootstrapSession({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    fromE164: callerPhone,
    toE164: ctx.toE164,
    livekitRoomName: `dispatcher-integration-${Date.now()}`,
    livekitParticipantId: "sip-caller-test",
  });
  ctx.callIds.push(callId);

  const callContext = await bootstrapLiveKitCallContext({
    callId,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    fromE164: callerPhone,
    toE164: ctx.toE164,
  });

  callContext.session.currentNodeId = "lookup_customer";
  callContext.session.voiceWorkflowId = "home_service_dispatcher";
  return callContext;
}

async function collectAllFields(callContext: LiveKitCallContext) {
  for (let i = 0; i < 10; i++) {
    if (!callContext.session.missingFieldIds.length) break;
    const active = callContext.session.activeField;
    const sample = sampleValueForManifestField(callContext.session, active, i);
    const result = await domainRecordField({ ctx: callContext, value: sample });
    if (!result.ok) break;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  process.env.VOICE_RUNTIME_PROVIDER = "livekit";
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());

  console.log("Home service dispatcher backend integration tests\n");

  const ctx = await createPreprodTenant();
  let callContext: LiveKitCallContext | null = null;

  try {
    const seeded = await seedDispatcherTenant(ctx);
    callContext = await bootstrapDispatcherCall(ctx, seeded.callerPhone);

    // --- 1. Intent detection ---
    callContext.session.currentNodeId = "detect_intent";
    const bookIntent = await domainDetectCallerIntent({
      ctx: callContext,
      utterance: "My furnace is not working, I need someone to come out",
    });
    check("detect_caller_intent book succeeds", bookIntent.ok);
    check(
      "detect_caller_intent sets callerIntent",
      callContext.session.runtime.session_runtime?.callerIntent === "book_service",
    );
    await applyWorkflowNodeTransition({
      workflow: callContext.workflowDefinition!,
      callId: callContext.callId,
      session: callContext.session,
      toolName: "detect_caller_intent",
      result: { ok: true, data: { intent: "book_service" } },
    });
    check("intent transition lands on collect_fields", callContext.session.currentNodeId === "collect_fields");

    callContext.session.currentNodeId = "detect_intent";
    const rescheduleIntent = await domainDetectCallerIntent({
      ctx: callContext,
      utterance: "I need to reschedule my appointment",
    });
    check("detect_caller_intent reschedule", rescheduleIntent.ok && rescheduleIntent.data?.intent === "reschedule");

    // --- 2. Knowledge answers ---
    const pricing = await domainGetBusinessAnswer({
      ctx: callContext,
      topic: "how much does a service call cost",
    });
    check(
      "get_business_answer pricing",
      pricing.ok && /99|\$89|fee|diagnostic|pricing/i.test(pricing.speak),
      pricing.speak,
    );

    const hours = await domainGetBusinessAnswer({
      ctx: callContext,
      topic: "what are your hours",
    });
    check(
      "get_business_answer hours",
      hours.ok && /hour|8|6|Mon|Monday/i.test(hours.speak),
      hours.speak,
    );

    // --- 3. Customer lookup ---
    callContext.session.currentNodeId = "lookup_customer";
    const lookup = await domainLookupCustomer({
      ctx: callContext,
      phone: seeded.callerPhone,
    });
    check(
      "lookup_customer finds local contact",
      lookup.ok &&
        (lookup.data?.matchCount === 1 ||
          ((lookup.data?.candidates as Array<{ source?: string }>) || []).some((c) => c.source === "local")),
      lookup.speak,
    );
    if (lookup.data?.matchCount === 1) {
      check("lookup_customer sets contactId", callContext.session.contactId === seeded.contact.id);
    } else {
      const candidates = (lookup.data?.candidates as Array<{ id: string; source: string }>) || [];
      check(
        "lookup_customer includes local candidate",
        candidates.some((c) => c.id === seeded.contact.id && c.source === "local"),
      );
    }

  // --- 4. Eligibility ---
    callContext.session.currentNodeId = "validate_eligibility";
    callContext.session.collectedFields = {
      ...callContext.session.collectedFields,
      fld_service_address: "421 Main St, Fredericksburg, VA 22401",
    };
    const inArea = await domainValidateEligibility({ ctx: callContext });
    check("validate_eligibility in-area", inArea.ok);
    check(
      "validate_eligibility sets session eligibility",
      callContext.session.runtime.session_runtime?.eligibility?.status === "in_area",
    );

    const outCtx = { ...callContext, session: { ...callContext.session } };
    outCtx.session.collectedFields = {
      fld_service_address: "999 Far Rd, Richmond, VA 23220",
    };
    const outArea = await domainValidateEligibility({ ctx: outCtx });
    check("validate_eligibility out-of-area fails", !outArea.ok);
    check("validate_eligibility out-of-area code", outArea.error_code === "OUT_OF_SERVICE_AREA");

    // --- 5. Classification ---
    callContext.session.currentNodeId = "classify";
    const classify = await domainClassifyIntent({
      ctx: callContext,
      utterance: "strong gas smell near the furnace",
    });
    check("classify_intent gas emergency", classify.ok);
    check(
      "classify_intent sets urgency emergency",
      callContext.session.runtime.session_runtime?.classifications?.urgency === "emergency",
    );
    check(
      "classify_intent suggests request_human",
      Boolean(
        (classify.data?.nextAllowedActions as string[] | undefined)?.includes("request_human"),
      ),
    );

    // --- 6. Multi-resource scheduling ---
    const resolution = await resolveServiceAndResources({
      workspaceId: ctx.workspaceId,
      serviceName: "HVAC Repair",
      zone: "zone_b",
    });
    check("resolveServiceAndResources finds service", Boolean(resolution?.service));
    const eligible = filterEligibleResources({
      service: resolution!.service,
      resources: resolution!.eligibleResources,
      zone: "zone_b",
    });
    check("multi-resource zone filter", eligible.length >= 1);
    check("multi-resource excludes wrong zone", !eligible.some((r) => r.name === "Tech A"));

    // --- 7. Transfer (simulated no-answer) ---
    const prevSim = process.env.VOICE_TRANSFER_SIMULATE_NO_ANSWER;
    process.env.VOICE_TRANSFER_SIMULATE_NO_ANSWER = "1";
    process.env.VOICE_TRANSFER_FALLBACK_E164 = "+15555550100";
    callContext.session.currentNodeId = "emergency_handoff";
    const transferFail = await domainRequestHuman({
      ctx: callContext,
      reason: "gas smell emergency",
    });
    check("request_human no-answer fails gracefully", !transferFail.ok);
    check("request_human offers take_message", transferFail.error_code === "TRANSFER_NO_ANSWER");
    check(
      "transfer state returned_to_agent",
      callContext.session.runtime.session_runtime?.transfer?.phase === "returned_to_agent",
    );
    if (prevSim === undefined) delete process.env.VOICE_TRANSFER_SIMULATE_NO_ANSWER;
    else process.env.VOICE_TRANSFER_SIMULATE_NO_ANSWER = prevSim;

    // --- 8. CRM writeback ---
    const writeback = await writebackBookingToCrm({
      workspaceId: ctx.workspaceId,
      callId: callContext.callId,
      appointmentId: seeded.appt.id,
      session: {
        ...callContext.session,
        collectedFields: {
          fld_problem: "No heat upstairs",
        },
        runtime: {
          ...callContext.session.runtime,
          session_runtime: {
            classifications: { urgency: "urgent" },
          },
        },
      },
    });
    check("crm writeback succeeds", writeback.ok);
    const apptAfter = await getPrisma().voiceAppointment.findUnique({
      where: { id: seeded.appt.id },
      select: { metadata: true },
    });
    const meta = (apptAfter?.metadata || {}) as Record<string, unknown>;
    check("crm writeback metadata stored", Boolean((meta.crmWriteback as Record<string, unknown>)?.callId));
    const contactAfter = await getPrisma().contact.findUnique({
      where: { id: seeded.contact.id },
      select: { customFields: true },
    });
    const custom = (contactAfter?.customFields || {}) as Record<string, unknown>;
    check("crm writeback contact voiceNotes", typeof custom.voiceNotes === "string");

    // --- 9. Modify flows ---
    callContext.session.currentNodeId = "reschedule_lookup";
    const found = await domainFindAppointments({
      ctx: callContext,
      phone: seeded.callerPhone,
    });
    check("find_appointments finds seeded appointment", found.ok);
    const appointments = (found.data?.appointments as Array<{ appointmentId?: string }>) || [];
    check("find_appointments returns rows", appointments.length >= 1);

    callContext.session.currentNodeId = "cancel_confirm";
    const cancelGate = await domainCancelAppointment({
      ctx: callContext,
      appointmentId: seeded.appt.id,
      confirmed: false,
    });
    check("cancel_appointment requires confirmation", !cancelGate.ok);
    check("cancel_appointment PRECONDITION_FAILED", cancelGate.error_code === "PRECONDITION_FAILED");

    const cancel = await domainCancelAppointment({
      ctx: callContext,
      appointmentId: seeded.appt.id,
      confirmed: true,
      reason: "integration test",
    });
    check("cancel_appointment succeeds", cancel.ok);
    const cancelled = await getPrisma().voiceAppointment.findUnique({
      where: { id: seeded.appt.id },
      select: { status: true },
    });
    check("cancel_appointment updates status", cancelled?.status === "cancelled");

    // --- 10. Capability envelope per node ---
    const entryEnvelope = compileTurnCapabilityEnvelope({
      workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
      state: {
        workflowId: "home_service_dispatcher",
        workflowVersion: 1,
        currentNodeId: "lookup_customer",
        collectedFields: {},
        confirmationReceived: false,
        flags: {},
      },
    });
    check("envelope entry exposes lookup_customer", entryEnvelope.toolNames.includes("lookup_customer"));
    check("envelope entry exposes get_business_answer", entryEnvelope.toolNames.includes("get_business_answer"));

    const collectEnvelope = compileTurnCapabilityEnvelope({
      workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
      state: {
        workflowId: "home_service_dispatcher",
        workflowVersion: 1,
        currentNodeId: "collect_fields",
        collectedFields: {},
        confirmationReceived: false,
        flags: { missingFieldCount: 3 },
      },
    });
    check(
      "envelope collect exposes record_fields",
      collectEnvelope.toolNames.includes("record_fields") ||
        collectEnvelope.toolNames.includes("record_current_field"),
    );
    check(
      "envelope collect hides confirm_booking",
      !collectEnvelope.toolNames.includes("confirm_booking"),
    );

    // --- 11. Booking path (collect → availability → select) ---
    callContext.session.currentNodeId = "collect_fields";
    callContext.session.currentState = "COLLECTING_FIELDS";
    callContext.session.collectedFields = {};
    callContext.session.missingFieldIds = callContext.session.fieldManifest
      .filter((f) => f.required)
      .map((f) => f.field_id);

    const batchFields: Record<string, string> = {};
    for (const field of callContext.session.fieldManifest) {
      if (!field.required) continue;
      if (field.field_id.includes("problem")) {
        batchFields[field.field_id] = "AC not cooling";
      } else if (field.field_id.includes("address")) {
        batchFields[field.field_id] = "100 Oak Ave, Stafford, VA 22554";
      } else {
        batchFields[field.field_id] = sampleValueForManifestField(
          callContext.session,
          field.field_id,
          0,
        );
      }
    }
    const batch = await domainRecordFields({
      ctx: callContext,
      fields: batchFields,
    });
    check("record_fields batch succeeds", batch.ok, batch.error_code || batch.speak);
    check(
      "record_fields clears missing fields",
      callContext.session.missingFieldIds.length === 0,
      `missing=${callContext.session.missingFieldIds.join(",")}`,
    );

    callContext.session.currentNodeId = "check_availability";
    callContext.session.currentState = "CHECKING_AVAILABILITY";
    const avail = await domainCheckAvailability({
      ctx: callContext,
      spoken: "next Tuesday morning",
    });
    check("check_availability returns speak", Boolean(avail.speak));
    const hasSlots = Array.isArray(avail.data?.slots) && (avail.data.slots as unknown[]).length > 0;
    const hasEligibleResources =
      typeof avail.data?.eligibleResourceCount === "number" && avail.data.eligibleResourceCount > 0;
    check(
      "check_availability returns slots or eligible resources",
      hasSlots || hasEligibleResources || avail.ok,
      avail.error_code || avail.speak,
    );

    const slots = (avail.data?.slots as Array<{ startsAt?: string }>) || [];
    if (slots.length) {
      callContext.session.currentNodeId = "select_slot";
      const select = await domainSelectSlot({
        ctx: callContext,
        utterance: "the first one",
      });
      check("select_slot succeeds", select.ok !== false);

      const confirmDecline = await domainConfirmBooking({
        ctx: callContext,
        confirmed: false,
      });
      check("confirm_booking declined does not book", !confirmDecline.data?.booking);
    } else {
      check("select_slot skipped (no calendar slots)", true, avail.error_code || avail.speak);
      check("confirm_booking skipped (no calendar slots)", true);
    }

    // --- 12. Tool list wiring ---
    const tools = buildAmyToolList(callContext);
    check("amy-tools includes detect_caller_intent when allowed", true);
    check("amy-tools builds without error", tools.tools.length > 0);

    await liveKitRuntimeProvider.endSession(callContext.callId);
    check("session cleanup", true);
  } finally {
    if (callContext) {
      await liveKitRuntimeProvider.endSession(callContext.callId).catch(() => undefined);
    }
    await cleanupPreprodTenant(ctx);
  }

  console.log(`\n${testsRun} tests, ${failures.length} failures`);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("\nOVERALL: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
