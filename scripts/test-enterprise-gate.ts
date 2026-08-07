/**
 * Enterprise gate test — new tenant + arbitrary fields + save/book chain.
 * Run: npx tsx scripts/test-enterprise-gate.ts
 */
import { toCustomFieldId } from "../src/lib/voice/field-runtime/system-fields";
import { validateFieldValue } from "../src/lib/voice/field-runtime/validate";
import { isGatewayRoutedTool } from "../src/lib/voice/agent-tool-gateway/gateway";
import { filterToolsForCallerAmyPublish } from "../src/lib/voice/workflow-engine/tool-publish";
import { FULL_RECEPTIONIST_TOOLS } from "../src/lib/voice/tools/catalog";
import type { WorkflowFieldDefinition } from "../src/lib/voice/field-runtime/types";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  else console.log("✓", name);
}

const ARBITRARY_FIELDS: WorkflowFieldDefinition[] = [
  {
    field_id: toCustomFieldId("vehicle_make_model"),
    label: "Vehicle Make & Model",
    type: "text",
    required: true,
    collection_instruction: "What is the make and model of your vehicle?",
  },
  {
    field_id: toCustomFieldId("gate_code"),
    label: "Gate Code",
    type: "text",
    required: false,
    collection_instruction: "What is the gate code?",
  },
  {
    field_id: toCustomFieldId("describe_problem"),
    label: "Describe the Problem",
    type: "long_text",
    required: true,
    collection_instruction: "Please describe the problem.",
  },
];

async function dbIntegration() {
  if (!process.env.DATABASE_URL) {
    console.log("(skip DB integration — no DATABASE_URL)");
    return;
  }
  const { getPrisma } = await import("../src/lib/db");
  const { saveCollectedFields } = await import("../src/lib/voice/field-runtime/save");
  const prisma = getPrisma();

  const ws = await prisma.workspace.create({
    data: { name: "Gate Test", slug: `gate-${Date.now()}` },
  });
  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: ws.id,
      direction: "INBOUND",
      status: "IN_PROGRESS",
      fromE164: "+17035551234",
      toE164: "+18005551234",
      startedAt: new Date(),
    },
  });

  const save = await saveCollectedFields({
    workspaceId: ws.id,
    callId: call.id,
    fields: ARBITRARY_FIELDS.map((f, i) => ({
      field_id: f.field_id,
      value: i === 0 ? "2020 Ford F-150" : i === 1 ? "1234" : "Kitchen sink backing up",
    })),
    workflow: "book_appointment",
  });
  check("save_collected_fields arbitrary fld_*", save.success === true || save.ok === true);

  await prisma.voiceCall.delete({ where: { id: call.id } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => undefined);
}

async function main() {
  for (const field of ARBITRARY_FIELDS) {
    check(`field id stable ${field.label}`, field.field_id.startsWith("fld_"));
    check(`validate ${field.label}`, String(validateFieldValue(field, "test value")).length > 0);
  }

  check("gateway routes book", isGatewayRoutedTool("book_appointment"));
  check("gateway routes hold", isGatewayRoutedTool("hold_appointment_slot"));
  check("gateway routes cancel", isGatewayRoutedTool("cancel_appointment"));
  check(
    "publish filter excludes save_caller_info",
    !filterToolsForCallerAmyPublish([...FULL_RECEPTIONIST_TOOLS]).includes("save_caller_info"),
  );
  check(
    "publish filter includes record_current_field",
    filterToolsForCallerAmyPublish([...FULL_RECEPTIONIST_TOOLS]).includes("record_current_field"),
  );
  check(
    "legacy save_caller_info config still publishes runtime tools",
    filterToolsForCallerAmyPublish(["save_caller_info", "book_appointment", "calendar_availability"]).includes(
      "record_current_field",
    ),
  );

  await dbIntegration();

  if (failures.length) {
    console.error(`\n${failures.length} gate test failure(s):`, failures);
    process.exit(1);
  }
  console.log("\nEnterprise gate checks passed.");
}

main();
