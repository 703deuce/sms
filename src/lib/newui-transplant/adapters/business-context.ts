import type { BusinessContext } from "@/newui-transplant/lib/view-models";

import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";

export function businessContextFromWorkspace(input: {
  name: string;
  businessLineE164?: string | null;
  forwardingIngressE164?: string | null;
  forwardingIngressState?: "ready" | "provisioning" | "missing";
  senderMode?: "PLATFORM" | "WORKSPACE";
  senderLabel?: string | null;
  senderDetail?: string | null;
  senderE164?: string | null;
  timezone?: string | null;
  website?: string | null;
}): BusinessContext {
  const forwardingState = input.forwardingIngressState ?? (input.forwardingIngressE164 ? "ready" : "missing");
  let forwardingLine = "—";
  if (forwardingState === "provisioning") {
    forwardingLine = "Setting up forwarding number…";
  } else if (forwardingState === "ready" && input.forwardingIngressE164?.trim()) {
    forwardingLine = formatMctbPhoneLabel(input.forwardingIngressE164);
  }

  const senderMode = input.senderMode === "PLATFORM" ? "PLATFORM" : "WORKSPACE";
  const sender =
    input.senderLabel?.trim() ||
    (senderMode === "PLATFORM"
      ? "Transovo Platform"
      : input.senderE164?.trim()
        ? formatMctbPhoneLabel(input.senderE164)
        : "—");

  return {
    name: input.name,
    line: input.businessLineE164?.trim() ? formatMctbPhoneLabel(input.businessLineE164) : "—",
    forwardingLine,
    forwardingLineState: forwardingState,
    sender,
    senderDetail: input.senderDetail?.trim() || sender,
    senderMode,
    timezone: input.timezone?.trim() || "America/Chicago",
    website: input.website?.trim() || "",
  };
}
