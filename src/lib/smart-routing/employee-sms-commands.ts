import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { findAuthorizedCallerForWorkspace } from "./access-detection";
import { findLastRoutedCallerForEmployee } from "./last-caller-for-employee";
import { fmtPhoneDisplay } from "./display";

const COMMAND_RE = /^(LAST|CALL)(?:\s+(.+))?$/i;

export async function tryHandleEmployeeSmsCommand(input: {
  workspaceId: string;
  fromE164: string;
  body: string;
}): Promise<{ handled: true; replyText: string } | { handled: false }> {
  const trimmed = input.body.trim();
  const match = trimmed.match(COMMAND_RE);
  if (!match) return { handled: false };

  const caller = await findAuthorizedCallerForWorkspace({
    workspaceId: input.workspaceId,
    callerE164: input.fromE164,
  });
  if (!caller) return { handled: false };

  const command = match[1].toUpperCase();
  const arg = match[2]?.trim();

  const prisma = getPrisma();
  const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { callbackNumberE164: true, outboundEnabled: true },
  });
  if (!settings?.outboundEnabled) {
    return {
      handled: true,
      replyText: "Business call back is not enabled for this workspace.",
    };
  }

  const callbackNum = settings.callbackNumberE164?.trim();
  const callbackHint = callbackNum ? fmtPhoneDisplay(callbackNum) : "your callback access number";

  if (command === "LAST") {
    const last = await findLastRoutedCallerForEmployee({
      workspaceId: input.workspaceId,
      employeePhoneE164: caller.phoneE164,
      authorizedCallerId: caller.id,
    });
    if (!last?.callerE164) {
      return {
        handled: true,
        replyText: "No recent routed callers found for your line.",
      };
    }
    return {
      handled: true,
      replyText: `Your last caller: ${fmtPhoneDisplay(last.callerE164)}. Dial ${callbackHint} and press 1 to call back.`,
    };
  }

  if (command === "CALL") {
    if (arg) {
      const digits = arg.replace(/\D/g, "");
      if (digits.length < 10) {
        return { handled: true, replyText: "Invalid number. Use CALL followed by a 10-digit US number." };
      }
      const dest = normalizeE164(digits.length === 10 ? `+1${digits}` : `+${digits}`);
      return {
        handled: true,
        replyText: `To call ${fmtPhoneDisplay(dest)}, dial ${callbackHint}, enter your PIN, press 2, and enter the number.`,
      };
    }

    const last = await findLastRoutedCallerForEmployee({
      workspaceId: input.workspaceId,
      employeePhoneE164: caller.phoneE164,
      authorizedCallerId: caller.id,
    });
    if (!last?.callerE164) {
      return {
        handled: true,
        replyText: "No recent caller to dial. Use CALL followed by a number, or dial your callback number and press 1.",
      };
    }
    return {
      handled: true,
      replyText: `To call your last caller (${fmtPhoneDisplay(last.callerE164)}), dial ${callbackHint} and press 1.`,
    };
  }

  return { handled: false };
}
