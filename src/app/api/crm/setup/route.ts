import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { humanizeCrmError } from "@/lib/crm/human-errors";
import { isCrmProvider } from "@/lib/crm/registry";
import {
  discoverCrmSetup,
  getOnboardingState,
  setOnboardingStep,
} from "@/lib/crm/setup";
import { timedCrmMetric } from "@/lib/crm/metrics";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const provider = new URL(request.url).searchParams.get("provider")?.trim();
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "Unsupported CRM provider" }, { status: 400 });
    }
    const onboarding = await getOnboardingState(auth.workspaceId, provider);
    return NextResponse.json({ data: { onboarding } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      provider?: string;
      action?: "discover" | "set_step";
      applyDefaults?: boolean;
      step?: string;
      completed?: boolean;
    };
    const provider = body.provider?.trim();
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "Unsupported CRM provider" }, { status: 400 });
    }

    if (body.action === "set_step" && body.step) {
      await setOnboardingStep(
        auth.workspaceId,
        provider,
        body.step,
        Boolean(body.completed),
      );
      return NextResponse.json({ data: { ok: true, step: body.step } });
    }

    const discovery = await timedCrmMetric(
      auth.workspaceId,
      provider,
      "setup_discovery",
      () =>
        discoverCrmSetup(auth.workspaceId, provider, {
          applyDefaults: body.applyDefaults !== false,
          actorUserId: auth.session.userId,
        }),
    );
    return NextResponse.json({ data: discovery });
  } catch (err) {
    return NextResponse.json(
      { error: humanizeCrmError(err, "CRM setup"), technical: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
