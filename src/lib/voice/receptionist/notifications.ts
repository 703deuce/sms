import { getPrisma } from "@/lib/db";
import type { ReceptionistCompiledSnapshot } from "./types";

export type ReceptionistNotificationEvent =
  | "call_summary"
  | "urgent"
  | "new_customer"
  | "transfer_failed";

function prefsFromSnapshot(snapshot?: ReceptionistCompiledSnapshot | null) {
  return (snapshot?.notifications || {}) as {
    sendCallSummary?: boolean;
    notifyUrgent?: boolean;
    notifyNewCustomers?: boolean;
    notifyTransferFail?: boolean;
    summaryDetail?: string;
  };
}

function eventAllowed(
  event: ReceptionistNotificationEvent,
  prefs: ReturnType<typeof prefsFromSnapshot>,
): boolean {
  if (event === "call_summary" && prefs.sendCallSummary === false) return false;
  if (event === "urgent" && prefs.notifyUrgent === false) return false;
  if (event === "new_customer" && prefs.notifyNewCustomers === false) return false;
  if (event === "transfer_failed" && prefs.notifyTransferFail === false) return false;
  return true;
}

/**
 * Staff notifications for generic receptionist agents — audit log + platform hooks.
 */
export async function notifyReceptionistStaff(input: {
  workspaceId: string;
  callId: string;
  event: ReceptionistNotificationEvent;
  businessName?: string;
  callerE164?: string | null;
  detail?: string;
  snapshot?: ReceptionistCompiledSnapshot | null;
}): Promise<void> {
  const prefs = prefsFromSnapshot(input.snapshot);
  if (!eventAllowed(input.event, prefs)) return;

  const prisma = getPrisma();
  const titleByEvent: Record<ReceptionistNotificationEvent, string> = {
    call_summary: "Call summary ready",
    urgent: "Urgent call",
    new_customer: "New customer call",
    transfer_failed: "Transfer failed",
  };

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      event: `voice.receptionist.${input.event}`,
      detail: JSON.stringify({
        callId: input.callId,
        title: titleByEvent[input.event],
        businessName: input.businessName || null,
        callerE164: input.callerE164 || null,
        detail: input.detail || null,
        summaryDetail: prefs.summaryDetail || "standard",
      }),
    },
  });
}
