import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { DraftConfig, DraftNode } from "./types";
import { isBlockedCallbackDestination } from "./callback-destination-policy";

export type RoutingLoopIssue = {
  code: string;
  message: string;
  nodeId?: string;
  destination?: string;
};

function extractPhoneFromNode(node: DraftNode): string | null {
  const cfg = node.config || {};
  const candidates = [
    cfg.phoneNumber,
    cfg.destinationE164,
    cfg.transferTo,
    cfg.e164,
    cfg.number,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      try {
        return normalizeE164(c.trim());
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function validateRoutingDestinationLoop(input: {
  destinationE164: string;
  routingNumberE164?: string | null;
  callbackNumberE164?: string | null;
}): RoutingLoopIssue | null {
  const blocked = isBlockedCallbackDestination(input.destinationE164, {
    routingNumberE164: input.routingNumberE164,
    callbackNumberE164: input.callbackNumberE164,
  });
  if (!blocked) return null;
  return {
    code: "ROUTING_LOOP",
    message: `Destination ${input.destinationE164} would route back to your Smart Routing or callback number`,
    destination: input.destinationE164,
  };
}

export function validateSmartRoutingFlowDestinations(input: {
  draft: DraftConfig;
  routingNumberE164?: string | null;
  callbackNumberE164?: string | null;
}): { valid: boolean; issues: RoutingLoopIssue[] } {
  const issues: RoutingLoopIssue[] = [];
  const nodes = input.draft.nodes || [];

  for (const node of nodes) {
    if (!["TRANSFER_EXTERNAL", "RING_GROUP", "CALL_WHISPER", "CALLBACK"].includes(node.type)) {
      continue;
    }
    const phone = extractPhoneFromNode(node);
    if (!phone) continue;
    const loop = validateRoutingDestinationLoop({
      destinationE164: phone,
      routingNumberE164: input.routingNumberE164,
      callbackNumberE164: input.callbackNumberE164,
    });
    if (loop) {
      issues.push({ ...loop, nodeId: node.id });
    }
  }

  for (const opt of input.draft.menuOptions || []) {
    if (!opt.phoneNumber) continue;
    try {
      const phone = normalizeE164(opt.phoneNumber);
      const loop = validateRoutingDestinationLoop({
        destinationE164: phone,
        routingNumberE164: input.routingNumberE164,
        callbackNumberE164: input.callbackNumberE164,
      });
      if (loop) {
        issues.push({
          ...loop,
          message: `Menu option ${opt.digit} (${opt.label}) ${loop.message}`,
        });
      }
    } catch {
      // invalid phone handled elsewhere
    }
  }

  return { valid: issues.length === 0, issues };
}
