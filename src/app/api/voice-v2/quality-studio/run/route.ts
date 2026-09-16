import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveVoiceV2BookingStrategy } from "@/lib/voice-v2/booking-strategy";
import { resolveAfterHoursHandlingFromAgentAdvanced } from "@/lib/voice-v2/after-hours-handling-config";
import { resolveOperatingMaturityFromAgentAdvanced } from "@/lib/voice-v2/operating-maturity/wizard-config";
import { runQualityStudioHeadless } from "@/lib/voice-v2/operating-maturity/quality-studio";
import { compileVoiceV2IntakeSchema } from "@/lib/voice-v2/intake/compile-schema";

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth || !auth.workspaceId) {
    return ("error" in auth && auth.error) || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const agentId = String(body.agentId || "").trim();
  if (!agentId) {
    return NextResponse.json({ error: "agent_id_required" }, { status: 400 });
  }

  const runtime = await loadVoiceAgentRuntimeConfig(auth.workspaceId, agentId);
  const config = parseVoiceAgentConfig(runtime);
  const maturity = resolveOperatingMaturityFromAgentAdvanced(
    config.advanced as Record<string, unknown>,
  );
  const afterHours = resolveAfterHoursHandlingFromAgentAdvanced(
    config.advanced as Record<string, unknown>,
  );
  const schema = compileVoiceV2IntakeSchema(config);
  const customKeys = schema.fields
    .map((f) => f.key)
    .filter((k) => !["name", "phone", "email", "address", "service_reason"].includes(k));

  const result = runQualityStudioHeadless({
    config: maturity,
    bookingStrategy: resolveVoiceV2BookingStrategy(config),
    transferEnabled: afterHours?.transferEnabled === true,
    customFieldKeys: customKeys,
  });

  return NextResponse.json({ ok: true, ...result });
}
