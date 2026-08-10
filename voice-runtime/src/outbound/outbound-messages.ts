import type { QualificationDefinition } from "@/lib/voice/outbound/types";

const DEFAULT_CLOSE =
  "Perfect, I've got everything I need. I'll pass this along to the team at {businessName} so someone can follow up with you. Thanks for your time!";

export function renderOutboundTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

export function buildOutboundIntroLine(
  definition: QualificationDefinition,
  leadName?: string | null,
): string {
  const name = leadName?.trim() || "there";
  const template =
    definition.introTemplate?.trim() ||
    "Hi, is this {leadName}? This is {agentDisplayName} with {businessName}. {reason} Do you have a minute for a few quick questions?";
  return renderOutboundTemplate(template, {
    leadName: name,
    businessName: definition.businessName,
    reason: definition.reasonForContact,
    agentDisplayName: definition.agentDisplayName?.trim() || "Amy",
  });
}

export function buildQualificationCloseLine(
  definition: QualificationDefinition,
  leadName?: string | null,
): string {
  const template = definition.closeTemplate?.trim() || DEFAULT_CLOSE;
  return renderOutboundTemplate(template, {
    leadName: leadName?.trim() || "there",
    businessName: definition.businessName,
    agentDisplayName: definition.agentDisplayName?.trim() || "Amy",
  });
}
