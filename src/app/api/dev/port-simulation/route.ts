import { NextResponse } from "next/server";
import {
  PORT_SIMULATION_SCENARIOS,
  applyNormalizedPortEvent,
  isPortSimulationEnabled,
} from "@/lib/numbers/port-simulation";

type Body = {
  scenarioId?: string;
  stepIndex?: number;
  workspaceId?: string;
  portInRequestId?: string;
  byUserId?: string;
};

/** Dev/staging-only port simulation ingress — feeds normalized events into real handlers. */
export async function POST(request: Request) {
  if (!isPortSimulationEnabled()) {
    return NextResponse.json({ error: "Port simulation disabled" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const scenario = PORT_SIMULATION_SCENARIOS.find((s) => s.id === body?.scenarioId);
  if (!scenario) {
    return NextResponse.json(
      {
        error: "Unknown scenarioId",
        scenarios: PORT_SIMULATION_SCENARIOS.map((s) => ({ id: s.id, title: s.title })),
      },
      { status: 400 },
    );
  }

  const stepIndex = body?.stepIndex ?? 0;
  const step = scenario.steps[stepIndex];
  if (!step) {
    return NextResponse.json({ error: "Invalid stepIndex" }, { status: 400 });
  }

  try {
    const result = await applyNormalizedPortEvent({
      event: step.event,
      workspaceId: body?.workspaceId,
      portInRequestId: body?.portInRequestId,
      byUserId: body?.byUserId,
    });
    return NextResponse.json({
      ok: true,
      scenarioId: scenario.id,
      step: step.label,
      duplicateStep: Boolean(step.duplicate),
      result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Simulation failed" },
      { status: 400 },
    );
  }
}

export async function GET() {
  if (!isPortSimulationEnabled()) {
    return NextResponse.json({ enabled: false });
  }
  return NextResponse.json({
    enabled: true,
    scenarios: PORT_SIMULATION_SCENARIOS.map((s) => ({
      id: s.id,
      title: s.title,
      direction: s.direction,
      provider: s.provider,
      steps: s.steps.map((step, index) => ({ index, label: step.label, duplicate: step.duplicate })),
    })),
  });
}
