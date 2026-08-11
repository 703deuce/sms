import type { RealtorProductConfig } from "@/lib/realtor/types";
import { compileFrontDeskFromProductConfig } from "./compile-front-desk";
import { compileSpeedToLeadFromProductConfig } from "./compile-speed-to-lead";
import { validateRealtorProductConfig } from "./validate-config";
import type { AgentInstanceStatus, CompiledRealtorAgents } from "./types";

export function compileRealtorAgents(
  config: RealtorProductConfig,
  input?: { status?: AgentInstanceStatus; outboundAgentId?: string },
): CompiledRealtorAgents {
  const validation = validateRealtorProductConfig(config);
  const configVersion = (config.compiledVersion ?? 0) + 1;
  const status = input?.status ?? config.status ?? "draft";

  let frontDesk = null;
  if (config.amyMode === "front_desk" || config.amyMode === "both") {
    frontDesk = compileFrontDeskFromProductConfig(config, { status, configVersion });
  }

  let speedToLead = null;
  if (config.amyMode === "speed_to_lead" || config.amyMode === "both") {
    speedToLead = compileSpeedToLeadFromProductConfig(config, {
      status,
      configVersion,
      agentId: input?.outboundAgentId,
    });
  }

  return {
    frontDesk,
    speedToLead,
    validation,
    compiledVersion: configVersion,
  };
}

export * from "./types";
export * from "./compile-front-desk";
export * from "./compile-speed-to-lead";
export * from "./compile-workflow-visual";
export * from "./field-manifest";
export * from "./validate-config";
