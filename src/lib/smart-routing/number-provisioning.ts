import "server-only";

import { getPrisma } from "@/lib/db";
import {
  ensureSmartRoutingWorkspaceSettings,
  loadSmartRoutingWorkspaceSettings,
  updateSmartRoutingWorkspaceSettings,
  type SmartRoutingWorkspaceSettingsRecord,
} from "./workspace-settings";
import { transitionNumberService } from "@/lib/numbers/state-service";
import {
  readCallHandlingMode,
  isFrozenMctbSipIngress,
} from "@/lib/numbers/call-handling-mode-shared";
import { customerSmartRoutingFlowWhere } from "@/lib/smart-routing/flow-kind";

function readRoutingOwner(settingsJson: unknown): string | null {
  if (!settingsJson || typeof settingsJson !== "object") return null;
  const owner = (settingsJson as Record<string, unknown>).routingOwner;
  return typeof owner === "string" ? owner : null;
}

/** Drop workspace routing/callback pointers that reference released or missing numbers. */
export async function sanitizeSmartRoutingWorkspaceNumberAssignments(workspaceId: string) {
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  if (!settings) return settings;

  const prisma = getPrisma();
  const patch: {
    assignedPhoneNumberId?: null;
    routingNumberE164?: null;
    assignedCallbackPhoneNumberId?: null;
    callbackNumberE164?: null;
  } = {};

  if (settings.assignedPhoneNumberId) {
    const routingPn = await prisma.phoneNumber.findFirst({
      where: {
        id: settings.assignedPhoneNumberId,
        workspaceId,
        releasedAt: null,
        status: { not: "Released" },
      },
      select: { id: true },
    });
    if (!routingPn) {
      patch.assignedPhoneNumberId = null;
      patch.routingNumberE164 = null;
    }
  }

  if (settings.assignedCallbackPhoneNumberId) {
    const callbackPn = await prisma.phoneNumber.findFirst({
      where: {
        id: settings.assignedCallbackPhoneNumberId,
        workspaceId,
        releasedAt: null,
        status: { not: "Released" },
      },
      select: { id: true },
    });
    if (!callbackPn) {
      patch.assignedCallbackPhoneNumberId = null;
      patch.callbackNumberE164 = null;
    }
  }

  if (Object.keys(patch).length === 0) return settings;
  return (await updateSmartRoutingWorkspaceSettings(workspaceId, patch)) as SmartRoutingWorkspaceSettingsRecord;
}

/** Only one workspace callback number — release prior assignment before assigning another. */
async function releasePriorWorkspaceCallbackNumber(
  workspaceId: string,
  nextPhoneNumberId: string,
) {
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  const priorId = settings?.assignedCallbackPhoneNumberId;
  if (!priorId || priorId === nextPhoneNumberId) return;

  const prisma = getPrisma();
  const prior = await prisma.phoneNumber.findFirst({
    where: { id: priorId, workspaceId, releasedAt: null, status: { not: "Released" } },
    select: { id: true },
  });
  if (!prior) return;

  await transitionNumberService(workspaceId, priorId, "clear_smart_routing_callback_owner");
}

/** Only one workspace routing number — release prior assignment before assigning another. */
async function releasePriorWorkspaceRoutingNumber(
  workspaceId: string,
  nextPhoneNumberId: string,
) {
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  const priorId = settings?.assignedPhoneNumberId;
  if (!priorId || priorId === nextPhoneNumberId) return;

  const prisma = getPrisma();
  const prior = await prisma.phoneNumber.findFirst({
    where: { id: priorId, workspaceId, releasedAt: null, status: { not: "Released" } },
    select: { settingsJson: true },
  });
  if (!prior) return;

  await transitionNumberService(workspaceId, priorId, "clear_smart_routing_owner");

  await prisma.smartRoutingFlow.updateMany({
    where: {
      workspaceId,
      assignedPhoneNumberId: priorId,
      status: "active",
      ...customerSmartRoutingFlowWhere,
    },
    data: { status: "paused" },
  });
}

export async function assignRoutingPhoneNumber(
  workspaceId: string,
  phoneNumberId: string,
) {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!pn) throw new Error("Routing number not found");
  if (pn.status === "Released" || pn.releasedAt) {
    throw new Error("Number has been released");
  }
  if (isFrozenMctbSipIngress(pn.settingsJson)) {
    throw new Error("This number uses the dedicated MCTB SIP path and cannot be the routing number");
  }
  if (readCallHandlingMode(pn.settingsJson) === "mctb") {
    throw new Error(
      "This number uses Missed Call Text Back. Switch call-handling mode to Smart Routing first.",
    );
  }
  const routingOwner = readRoutingOwner(pn.settingsJson);
  if (routingOwner === "smart_routing_callback") {
    throw new Error("Cannot use the Business Callback Number as the Routing Number");
  }

  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  if (settings?.assignedCallbackPhoneNumberId === phoneNumberId) {
    throw new Error("Cannot use the Business Callback Number as the Routing Number");
  }

  await releasePriorWorkspaceRoutingNumber(workspaceId, phoneNumberId);
  await transitionNumberService(workspaceId, phoneNumberId, "set_smart_routing_owner");
  await updateSmartRoutingWorkspaceSettings(workspaceId, {
    assignedPhoneNumberId: phoneNumberId,
    routingNumberE164: pn.e164,
  });
  return pn;
}

export async function assignCallbackPhoneNumber(
  workspaceId: string,
  phoneNumberId: string,
) {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!pn) throw new Error("Callback number not found");
  if (pn.status === "Released" || pn.releasedAt) {
    throw new Error("Number has been released");
  }
  if (isFrozenMctbSipIngress(pn.settingsJson)) {
    throw new Error("This number cannot be used as the Business Callback Number");
  }
  if (readCallHandlingMode(pn.settingsJson) === "mctb") {
    throw new Error("Cannot use a Missed Call Text Back number as the Business Callback Number");
  }
  if (readCallHandlingMode(pn.settingsJson) === "smart_routing") {
    throw new Error("Cannot use the Smart Routing number as the Business Callback Number");
  }

  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  if (settings?.assignedPhoneNumberId === phoneNumberId) {
    throw new Error("Cannot use the Routing Number as the Business Callback Number");
  }
  if (settings?.routingNumberE164 && settings.routingNumberE164 === pn.e164) {
    throw new Error("Cannot use the Routing Number as the Business Callback Number");
  }

  await releasePriorWorkspaceCallbackNumber(workspaceId, phoneNumberId);
  await transitionNumberService(workspaceId, phoneNumberId, "set_smart_routing_callback_owner");
  await updateSmartRoutingWorkspaceSettings(workspaceId, {
    assignedCallbackPhoneNumberId: phoneNumberId,
    callbackNumberE164: pn.e164,
  });
  return pn;
}

/**
 * When routing is assigned but callback is missing, auto-pick another workspace number.
 */
export async function ensureCallbackNumberAssigned(workspaceId: string) {
  await sanitizeSmartRoutingWorkspaceNumberAssignments(workspaceId);
  const settings = await ensureSmartRoutingWorkspaceSettings(workspaceId);
  if (settings.callbackNumberE164 && settings.assignedCallbackPhoneNumberId) {
    return settings;
  }

  const prisma = getPrisma();
  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId, releasedAt: null, status: { not: "Released" } },
    orderBy: { createdAt: "asc" },
  });

  const routingId = settings.assignedPhoneNumberId;
  const routingE164 = settings.routingNumberE164;

  const candidate = numbers.find((n: { id: string; e164: string; settingsJson: unknown }) => {
    if (routingId && n.id === routingId) return false;
    if (routingE164 && n.e164 === routingE164) return false;
    if (isFrozenMctbSipIngress(n.settingsJson)) return false;
    const owner = readRoutingOwner(n.settingsJson);
    if (owner === "smart_routing" || owner === "smart_routing_callback") return false;
    const mode = readCallHandlingMode(n.settingsJson);
    if (mode === "smart_routing" || mode === "mctb") return false;
    return true;
  });

  if (!candidate) return settings;

  await assignCallbackPhoneNumber(workspaceId, candidate.id);
  return (await loadSmartRoutingWorkspaceSettings(workspaceId)) as SmartRoutingWorkspaceSettingsRecord;
}
