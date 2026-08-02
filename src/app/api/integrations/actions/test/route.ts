import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  buildActionPreview,
  classifyActionRisk,
} from "@/lib/integrations/framework/ai-policy";
import {
  getActionCapabilityTruth,
  isExternalProvider,
} from "@/lib/integrations/framework";
import type {
  ExternalProviderId,
  IntegrationActionId,
} from "@/lib/integrations/framework";
import {
  CRM_AUTOMATION_ACTIONS,
  isCrmAutomationProvider,
} from "@/lib/crm/automation-actions";
import { isFeatureSupported } from "@/lib/crm/feature-matrix";

/**
 * Dry-run validator for an `integration_action` step. Never calls the provider
 * or mutates data — it only resolves whether the provider/action pair is
 * supported and returns a preview of what would be sent. Safe to call from the
 * automation builder "Test action" button.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      provider?: string;
      actionId?: string;
      params?: Record<string, unknown>;
      paramsJson?: string;
      contactId?: string;
    };

    const provider = String(body.provider || "").trim();
    const actionId = String(body.actionId || "").trim();
    if (!provider || !actionId) {
      return NextResponse.json(
        { error: "provider and actionId are required" },
        { status: 400 },
      );
    }

    let params: Record<string, unknown> = {};
    if (body.params && typeof body.params === "object") {
      params = body.params;
    } else if (typeof body.paramsJson === "string" && body.paramsJson.trim()) {
      try {
        const parsed = JSON.parse(body.paramsJson);
        if (parsed && typeof parsed === "object") {
          params = parsed as Record<string, unknown>;
        }
      } catch {
        return NextResponse.json(
          { error: "params JSON is not valid" },
          { status: 400 },
        );
      }
    }

    const contactId = body.contactId ? String(body.contactId) : null;

    let supported = false;
    let reason: string | null = null;

    if (isCrmAutomationProvider(provider)) {
      const def = CRM_AUTOMATION_ACTIONS.find((a) => a.id === actionId);
      if (!def) {
        reason = `Action ${actionId} is not available`;
      } else if (!def.providers.includes(provider)) {
        reason = `${provider} does not support ${actionId}`;
      } else if (!isFeatureSupported(provider, def.requiredFeature)) {
        reason = `${def.requiredFeature} not supported for ${provider}`;
      } else {
        supported = true;
      }
    } else if (isExternalProvider(provider)) {
      const truth = getActionCapabilityTruth(
        provider as ExternalProviderId,
        actionId as IntegrationActionId,
      );
      supported = truth.supported;
      reason = truth.supported ? null : truth.reason || "Unsupported";
    } else {
      reason = `Unknown provider ${provider}`;
    }

    const riskLevel = classifyActionRisk(actionId);
    const preview = buildActionPreview({
      actionId,
      provider,
      params,
      contactId,
      riskLevel,
    });

    return NextResponse.json({
      data: {
        dryRun: true,
        provider,
        actionId,
        supported,
        reason,
        riskLevel,
        preview,
        params,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
