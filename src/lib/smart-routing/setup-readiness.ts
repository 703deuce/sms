import type { SmartRoutingWorkspaceSettingsRecord } from "./workspace-settings";

export type SetupStepKey =
  | "business_number"
  | "caller_id_verified"
  | "routing_number"
  | "forwarding_detected"
  | "main_route_published"
  | "business_hours"
  | "destinations"
  | "incoming_tested"
  | "callback_users"
  | "callback_tested";

export type SetupStep = {
  key: SetupStepKey;
  label: string;
  complete: boolean;
  optional?: boolean;
  href?: string;
};

export type SetupReadiness = {
  steps: SetupStep[];
  completedCount: number;
  requiredCount: number;
  ready: boolean;
  routingStatus: "live" | "setup_incomplete" | "paused" | "after_hours" | "temporary_closure";
};

export function computeSetupReadiness(input: {
  settings: SmartRoutingWorkspaceSettingsRecord | null;
  callerIdStatus: string;
  flows: Array<{ id: string; status: string; scheduleJson?: unknown }>;
  destinations: Array<{ active: boolean }>;
  authorizedCallers: Array<{ active: boolean; outboundEnabled: boolean }>;
  forwardingDetected: boolean;
  inboundTestDetected: boolean;
  outboundTestDetected: boolean;
  scheduleBranch?: "open" | "closed" | "holiday" | "temporary_closure";
}): SetupReadiness {
  const settings = input.settings;
  const hasBusinessNumber = Boolean(settings?.publicBusinessE164?.trim());
  const callerVerified = input.callerIdStatus === "verified";
  const hasRoutingNumber = Boolean(settings?.routingNumberE164?.trim());
  const activeFlows = input.flows.filter((f) => f.status === "active");
  const hasPublishedRoute = activeFlows.length > 0;
  const pausedOnly =
    input.flows.length > 0 && activeFlows.length === 0 && input.flows.every((f) => f.status === "paused");
  const activeDestinations = input.destinations.filter((d) => d.active).length;
  const activeCallbackUsers = input.authorizedCallers.filter(
    (c) => c.active && c.outboundEnabled,
  ).length;

  const hasHours =
    input.flows.some((f) => {
      const schedule = (f.scheduleJson as Record<string, unknown>) ?? {};
      return Boolean(schedule.windows) || Boolean(schedule.forwarding);
    }) || Boolean(settings?.scheduleOverrideJson);

  const steps: SetupStep[] = [
    {
      key: "business_number",
      label: "Business number added",
      complete: hasBusinessNumber,
      href: "/smart-routing/setup#business-number",
    },
    {
      key: "caller_id_verified",
      label: "Caller ID verified",
      complete: callerVerified,
      href: "/smart-routing/setup#verify-caller-id",
    },
    {
      key: "routing_number",
      label: "Routing number assigned",
      complete: hasRoutingNumber,
      href: "/smart-routing/setup#routing-number",
    },
    {
      key: "forwarding_detected",
      label: "Forwarding configured",
      complete: input.forwardingDetected,
      href: "/smart-routing/setup#forwarding",
    },
    {
      key: "main_route_published",
      label: "Main route published",
      complete: hasPublishedRoute,
      href: "/smart-routing/new",
    },
    {
      key: "business_hours",
      label: "Business hours configured",
      complete: hasHours,
      optional: true,
      href: activeFlows[0] ? `/smart-routing/${activeFlows[0].id}` : "/smart-routing/new",
    },
    {
      key: "destinations",
      label: "At least one destination",
      complete: activeDestinations > 0,
      href: "/smart-routing/setup#destinations",
    },
    {
      key: "incoming_tested",
      label: "Incoming call tested",
      complete: input.inboundTestDetected,
      optional: true,
      href: activeFlows[0] ? `/smart-routing/${activeFlows[0].id}/test` : "/smart-routing/setup#test",
    },
    {
      key: "callback_users",
      label: "Callback users configured",
      complete: activeCallbackUsers > 0,
      optional: true,
      href: "/smart-routing/setup#business-callback",
    },
    {
      key: "callback_tested",
      label: "Business callback tested",
      complete: input.outboundTestDetected,
      optional: true,
      href: "/smart-routing/setup#test-callback",
    },
  ];

  const required = steps.filter((s) => !s.optional);
  const completedRequired = required.filter((s) => s.complete).length;

  let routingStatus: SetupReadiness["routingStatus"] = "setup_incomplete";
  if (input.scheduleBranch === "temporary_closure") {
    routingStatus = "temporary_closure";
  } else if (input.scheduleBranch === "closed" || input.scheduleBranch === "holiday") {
    routingStatus = "after_hours";
  } else if (pausedOnly) {
    routingStatus = "paused";
  } else if (hasPublishedRoute && hasRoutingNumber) {
    routingStatus = "live";
  }

  return {
    steps,
    completedCount: steps.filter((s) => s.complete).length,
    requiredCount: required.length,
    ready: completedRequired >= required.length - 1 && hasPublishedRoute && hasRoutingNumber,
    routingStatus,
  };
}
