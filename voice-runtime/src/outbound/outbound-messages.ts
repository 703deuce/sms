import type { QualificationDefinition } from "@/lib/voice/outbound/types";

export function buildOutboundIntroLine(
  definition: QualificationDefinition,
  leadName?: string | null,
): string {
  const name = leadName?.trim() || "there";
  const template =
    definition.introTemplate?.trim() ||
    "Hi, is this {leadName}? This is Amy calling on behalf of {businessName}. {reason}";
  return template
    .replace(/\{leadName\}/g, name)
    .replace(/\{businessName\}/g, definition.businessName)
    .replace(/\{reason\}/g, definition.reasonForContact);
}

export function buildQualificationCloseLine(businessName: string): string {
  return (
    `Perfect, I've got everything I need. I'll pass this along to one of our realtors at ${businessName} ` +
    "so they can follow up with you. Thanks for your time!"
  );
}
