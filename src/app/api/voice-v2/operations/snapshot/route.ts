import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveOperatingMaturityFromAgentAdvanced } from "@/lib/voice-v2/operating-maturity/wizard-config";
import { resolveVoiceV2OperatingState } from "@/lib/voice-v2/operating-maturity/operating-state";
import { resolveActiveOnCallTarget } from "@/lib/voice-v2/operating-maturity/on-call";
import {
  loadLiveOnCallOverride,
  loadLiveTemporaryClosure,
} from "@/lib/voice-v2/operating-maturity/operational-store";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("error" in auth || !auth.workspaceId) {
    return ("error" in auth && auth.error) || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspace = { id: auth.workspaceId };
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId")?.trim() || "";
  if (!agentId) {
    return NextResponse.json({ error: "agent_id_required" }, { status: 400 });
  }

  const runtime = await loadVoiceAgentRuntimeConfig(workspace.id, agentId);
  const config = parseVoiceAgentConfig(runtime);
  const maturity = resolveOperatingMaturityFromAgentAdvanced(
    config.advanced as Record<string, unknown>,
  );

  const [liveClosure, onCallOverride] = await Promise.all([
    loadLiveTemporaryClosure({ workspaceId: workspace.id, agentId }),
    loadLiveOnCallOverride({ workspaceId: workspace.id, agentId }),
  ]);

  const operating = resolveVoiceV2OperatingState({
    schedule: maturity.businessSchedule,
    liveTemporaryClosure: liveClosure,
  });
  const onCall = resolveActiveOnCallTarget({
    schedule: maturity.onCallSchedule,
    operationalOverride: onCallOverride,
    operatingState: operating.state,
  });

  return NextResponse.json({
    ok: true,
    operating,
    onCall,
    callbackSla: maturity.callbackSla,
    afterHoursBehavior: maturity.afterHoursBehavior,
  });
}
