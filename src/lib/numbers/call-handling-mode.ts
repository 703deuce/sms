import "server-only";

import { getPrisma } from "@/lib/db";
import { mapPhoneNumber } from "@/lib/mappers";
import { transitionNumberService } from "@/lib/numbers/state-service";
import { assignRoutingPhoneNumber } from "@/lib/smart-routing/number-provisioning";
import { createFlow, updateFlowDraft } from "@/lib/smart-routing/flow-service";
import { MCTB_CONSENT_FLOW_NAME } from "@/lib/mctb/consent-prompt/types";
import { sameSmartRoutingE164 } from "@/lib/smart-routing/internal-numbers";
import {
  type CallHandlingMode,
  type CallHandlingModePurchaseOption,
  parseCallHandlingModePurchase,
} from "@/lib/numbers/call-handling-mode-shared";

export type { CallHandlingMode, CallHandlingModePurchaseOption };
export {
  readCallHandlingMode,
  isSmartRoutingCallHandlingActive,
  isFrozenMctbSipIngress,
  parseCallHandlingModePurchase,
} from "@/lib/numbers/call-handling-mode-shared";

function readSettings(settingsJson: unknown): Record<string, unknown> {
  return settingsJson && typeof settingsJson === "object"
    ? (settingsJson as Record<string, unknown>)
    : {};
}

async function getOwned(workspaceId: string, numberId: string) {
  const row = await getPrisma().phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) throw new Error("Number not found");
  if (row.status === "Released" || row.releasedAt) {
    throw new Error("Number has been released");
  }
  return row;
}

async function clearWorkspaceRoutingIfThisNumber(
  workspaceId: string,
  numberId: string,
  e164: string,
) {
  const { loadSmartRoutingWorkspaceSettings, updateSmartRoutingWorkspaceSettings } = await import(
    "@/lib/smart-routing/workspace-settings"
  );
  const ws = await loadSmartRoutingWorkspaceSettings(workspaceId);
  if (
    ws?.assignedPhoneNumberId === numberId ||
    (ws?.routingNumberE164 && sameSmartRoutingE164(ws.routingNumberE164, e164))
  ) {
    await updateSmartRoutingWorkspaceSettings(workspaceId, {
      assignedPhoneNumberId: null,
      routingNumberE164: null,
    });
  }
}

async function clearCallbackRoleOnNumber(workspaceId: string, numberId: string) {
  const row = await getPrisma().phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
    select: { settingsJson: true },
  });
  if (!row) return;
  const settings = readSettings(row.settingsJson);
  if (settings.routingOwner === "smart_routing_callback") {
    await transitionNumberService(workspaceId, numberId, "clear_smart_routing_callback_owner");
  }
}

async function clearWorkspaceCallbackIfThisNumber(
  workspaceId: string,
  numberId: string,
  e164: string,
) {
  const { loadSmartRoutingWorkspaceSettings, updateSmartRoutingWorkspaceSettings } = await import(
    "@/lib/smart-routing/workspace-settings"
  );
  const ws = await loadSmartRoutingWorkspaceSettings(workspaceId);
  if (
    ws?.assignedCallbackPhoneNumberId === numberId ||
    (ws?.callbackNumberE164 && sameSmartRoutingE164(ws.callbackNumberE164, e164))
  ) {
    await updateSmartRoutingWorkspaceSettings(workspaceId, {
      assignedCallbackPhoneNumberId: null,
      callbackNumberE164: null,
    });
    await clearCallbackRoleOnNumber(workspaceId, numberId);
  }
}

async function clearWorkspaceCallForwardingIfThisNumber(
  workspaceId: string,
  numberId: string,
) {
  const { loadCallForwardingWorkspaceSettings, updateCallForwardingWorkspaceSettings } = await import(
    "@/lib/call-forwarding/workspace-settings"
  );
  const ws = await loadCallForwardingWorkspaceSettings(workspaceId);
  if (!ws) return;
  const patch: Partial<{
    assignedPhoneNumberId: string | null;
    businessNumberE164: string | null;
    controlPhoneNumberId: string | null;
    controlNumberE164: string | null;
  }> = {};
  if (ws.assignedPhoneNumberId === numberId) {
    patch.assignedPhoneNumberId = null;
    patch.businessNumberE164 = null;
  }
  if (ws.controlPhoneNumberId === numberId) {
    patch.controlPhoneNumberId = null;
    patch.controlNumberE164 = null;
  }
  if (Object.keys(patch).length > 0) {
    await updateCallForwardingWorkspaceSettings(workspaceId, patch);
  }
}

async function unpausePublishedFlowsOnNumber(workspaceId: string, numberId: string) {
  await getPrisma().smartRoutingFlow.updateMany({
    where: {
      workspaceId,
      assignedPhoneNumberId: numberId,
      status: "paused",
      publishedVersionId: { not: null },
      type: { not: "missed_call_recovery" },
      name: { not: MCTB_CONSENT_FLOW_NAME },
    },
    data: { status: "active" },
  });
}

async function pauseActiveSmartRoutingFlowsOnNumber(workspaceId: string, numberId: string) {
  const { customerSmartRoutingFlowWhere } = await import("@/lib/smart-routing/flow-kind");
  await getPrisma().smartRoutingFlow.updateMany({
    where: {
      workspaceId,
      assignedPhoneNumberId: numberId,
      status: "active",
      ...customerSmartRoutingFlowWhere,
    },
    data: { status: "paused" },
  });
}

export async function applySmartRoutingOnPurchasedNumber(
  workspaceId: string,
  phoneNumberId: string,
) {
  const { grantWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
  await grantWorkspaceProductFeature(workspaceId, "smart_routing", "trial");

  const row = await getOwned(workspaceId, phoneNumberId);
  await assignRoutingPhoneNumber(workspaceId, phoneNumberId);

  const prisma = getPrisma();
  const existingFlow = await prisma.smartRoutingFlow.findFirst({
    where: { workspaceId, assignedPhoneNumberId: phoneNumberId },
    select: { id: true },
  });
  if (existingFlow) {
    await unpausePublishedFlowsOnNumber(workspaceId, phoneNumberId);
    const { ensureCallbackNumberAssigned } = await import(
      "@/lib/smart-routing/number-provisioning"
    );
    await ensureCallbackNumberAssigned(workspaceId);
    return { phoneNumberId, flowId: existingFlow.id };
  }

  const flow = await createFlow(workspaceId, { name: "Main menu", type: "phone_menu" });
  const { purchasedNumberPhoneMenuDraft } = await import("@/lib/smart-routing/templates");
  await updateFlowDraft(workspaceId, flow.id, {
    assignedPhoneNumberId: phoneNumberId,
    routingNumberE164: row.e164,
    numberMode: "transovo_number",
    draftConfig: purchasedNumberPhoneMenuDraft(),
  });
  const { ensureCallbackNumberAssigned } = await import(
    "@/lib/smart-routing/number-provisioning"
  );
  await ensureCallbackNumberAssigned(workspaceId);
  return { phoneNumberId, flowId: flow.id };
}

export async function applyCallForwardingOnPurchasedNumber(
  workspaceId: string,
  phoneNumberId: string,
) {
  const { grantWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
  await grantWorkspaceProductFeature(workspaceId, "call_forwarding", "trial");

  const row = await getOwned(workspaceId, phoneNumberId);
  await transitionNumberService(workspaceId, phoneNumberId, "set_call_forwarding_owner");
  const { updateCallForwardingWorkspaceSettings } = await import(
    "@/lib/call-forwarding/workspace-settings"
  );
  await updateCallForwardingWorkspaceSettings(workspaceId, {
    assignedPhoneNumberId: phoneNumberId,
    businessNumberE164: row.e164,
  });
  return { phoneNumberId };
}

async function assignMctbPhoneNumber(workspaceId: string, phoneNumberId: string) {
  const { updateMissedCallTextConfig } = await import(
    "@/lib/agents/missed-call-text-back/config"
  );
  await updateMissedCallTextConfig({
    workspaceId,
    patch: { phone_number_id: phoneNumberId },
    source: "call_handling_mode",
  });
}

export async function setCallHandlingMode(
  workspaceId: string,
  numberId: string,
  mode: CallHandlingMode,
) {
  const row = await getOwned(workspaceId, numberId);
  const { isFrozenMctbSipIngress } = await import("@/lib/numbers/call-handling-mode-shared");
  if (isFrozenMctbSipIngress(row.settingsJson)) {
    throw new Error(
      "This number uses the dedicated MCTB SIP path and cannot change call-handling mode here.",
    );
  }

  const priorMode = readCallHandlingMode(row.settingsJson);
  if (priorMode === "call_forwarding" && mode !== "call_forwarding") {
    await transitionNumberService(workspaceId, numberId, "clear_call_forwarding_owner");
    await clearWorkspaceCallForwardingIfThisNumber(workspaceId, numberId);
  }

  if (mode === "smart_routing") {
    const { grantWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
    await grantWorkspaceProductFeature(workspaceId, "smart_routing", "trial");
    const { loadSmartRoutingWorkspaceSettings } = await import(
      "@/lib/smart-routing/workspace-settings"
    );
    const ws = await loadSmartRoutingWorkspaceSettings(workspaceId);
    if (ws?.assignedCallbackPhoneNumberId === numberId) {
      throw new Error("Cannot use the Business Callback Number for Smart Routing");
    }
    await assignRoutingPhoneNumber(workspaceId, numberId);
    await unpausePublishedFlowsOnNumber(workspaceId, numberId);
  } else if (mode === "call_forwarding") {
    const { grantWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
    await grantWorkspaceProductFeature(workspaceId, "call_forwarding", "trial");
    const { updateCallForwardingWorkspaceSettings } = await import(
      "@/lib/call-forwarding/workspace-settings"
    );
    await pauseActiveSmartRoutingFlowsOnNumber(workspaceId, numberId);
    await clearWorkspaceRoutingIfThisNumber(workspaceId, numberId, row.e164);
    await clearWorkspaceCallbackIfThisNumber(workspaceId, numberId, row.e164);
    await transitionNumberService(workspaceId, numberId, "set_call_forwarding_owner");
    await updateCallForwardingWorkspaceSettings(workspaceId, {
      assignedPhoneNumberId: numberId,
      businessNumberE164: row.e164,
    });
  } else if (mode === "mctb") {
    const { grantWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
    await grantWorkspaceProductFeature(workspaceId, "mctb", "trial");
    const { ensureMctbWorkspaceSeeded } = await import("@/lib/mctb/provisioning/seed-workspace");
    await ensureMctbWorkspaceSeeded(workspaceId);
    await transitionNumberService(workspaceId, numberId, "set_mctb_owner");
    await pauseActiveSmartRoutingFlowsOnNumber(workspaceId, numberId);
    await assignMctbPhoneNumber(workspaceId, numberId);
    await clearWorkspaceRoutingIfThisNumber(workspaceId, numberId, row.e164);
    await clearWorkspaceCallbackIfThisNumber(workspaceId, numberId, row.e164);
  } else {
    const settingsBefore = readSettings(row.settingsJson);
    if (settingsBefore.routingOwner === "smart_routing_callback") {
      await transitionNumberService(workspaceId, numberId, "clear_smart_routing_callback_owner");
    }
    await transitionNumberService(workspaceId, numberId, "clear_smart_routing_owner");
    await pauseActiveSmartRoutingFlowsOnNumber(workspaceId, numberId);
    await clearWorkspaceRoutingIfThisNumber(workspaceId, numberId, row.e164);
    await clearWorkspaceCallbackIfThisNumber(workspaceId, numberId, row.e164);
    const current = await getPrisma().phoneNumber.findFirst({
      where: { id: numberId, workspaceId },
    });
    if (!current) throw new Error("Number not found");
    const settings = readSettings(current.settingsJson);
    await getPrisma().phoneNumber.update({
      where: { id: numberId },
      data: {
        settingsJson: {
          ...settings,
          routingOwner: null,
          callHandlingMode: null,
        },
      },
    });
  }

  const updated = await getPrisma().phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!updated) throw new Error("Number not found");
  return mapPhoneNumber(updated as Parameters<typeof mapPhoneNumber>[0]);
}

export async function applyCallHandlingAfterPurchase(
  workspaceId: string,
  phoneNumberId: string,
  mode: CallHandlingModePurchaseOption | null,
) {
  if (mode === "smart_routing") {
    return applySmartRoutingOnPurchasedNumber(workspaceId, phoneNumberId);
  }
  if (mode === "call_forwarding") {
    return applyCallForwardingOnPurchasedNumber(workspaceId, phoneNumberId);
  }
  if (mode === "mctb") {
    await setCallHandlingMode(workspaceId, phoneNumberId, "mctb");
    return { phoneNumberId };
  }
  return { phoneNumberId };
}
