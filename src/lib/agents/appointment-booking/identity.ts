/**
 * Data-driven agent identity — never hard-code a personal name or pronouns.
 */

export type AgentPronouns = {
  subject: string;
  object: string;
  possessive: string;
};

export type AgentDisplayIdentity = {
  name: string;
  pronouns?: AgentPronouns;
  roleLabel: string;
  customerFacingName?: string;
  avatarId?: string;
};

export const DEFAULT_APPOINTMENT_AGENT_NAME = "Amy";
export const DEFAULT_APPOINTMENT_ROLE_LABEL = "Appointment Booking Agent";
export const DEFAULT_APPOINTMENT_AGENT_DESCRIPTION =
  "Answers calls, checks real availability, and books appointments using your calendar.";

export const DEFAULT_APPOINTMENT_PRONOUNS: AgentPronouns = {
  subject: "she",
  object: "her",
  possessive: "her",
};

/** @deprecated Use DEFAULT_APPOINTMENT_AGENT_NAME — kept for import compatibility during rename. */
export const DEFAULT_RANDY_NAME = DEFAULT_APPOINTMENT_AGENT_NAME;
/** @deprecated */
export const DEFAULT_RANDY_DISPLAY = `${DEFAULT_APPOINTMENT_AGENT_NAME} — ${DEFAULT_APPOINTMENT_ROLE_LABEL}`;
/** @deprecated */
export const DEFAULT_RANDY_DESCRIPTION = DEFAULT_APPOINTMENT_AGENT_DESCRIPTION;

export function buildDisplayName(
  name: string,
  roleLabel: string = DEFAULT_APPOINTMENT_ROLE_LABEL,
): string {
  const n = name.trim() || DEFAULT_APPOINTMENT_AGENT_NAME;
  if (n.toLowerCase().includes("appointment")) return n;
  return `${n} — ${roleLabel}`;
}

export function resolveAgentIdentity(input: {
  name?: string | null;
  displayName?: string | null;
  description?: string | null;
  purpose?: string | null;
  customerFacingName?: string | null;
  pronouns?: Partial<AgentPronouns> | null;
  avatarId?: string | null;
  roleLabel?: string | null;
}): AgentDisplayIdentity & {
  displayName: string;
  description: string;
} {
  const name =
    String(input.name || "").trim() || DEFAULT_APPOINTMENT_AGENT_NAME;
  const roleLabel =
    String(input.roleLabel || "").trim() || DEFAULT_APPOINTMENT_ROLE_LABEL;
  const displayName =
    String(input.displayName || "").trim() || buildDisplayName(name, roleLabel);
  const customerFacingName =
    String(input.customerFacingName || "").trim() || name;
  const pronouns: AgentPronouns = {
    subject:
      String(input.pronouns?.subject || "").trim() ||
      DEFAULT_APPOINTMENT_PRONOUNS.subject,
    object:
      String(input.pronouns?.object || "").trim() ||
      DEFAULT_APPOINTMENT_PRONOUNS.object,
    possessive:
      String(input.pronouns?.possessive || "").trim() ||
      DEFAULT_APPOINTMENT_PRONOUNS.possessive,
  };
  return {
    name,
    roleLabel,
    customerFacingName,
    pronouns,
    avatarId: input.avatarId || undefined,
    displayName,
    description:
      String(input.description || input.purpose || "").trim() ||
      DEFAULT_APPOINTMENT_AGENT_DESCRIPTION,
  };
}

/** Replace legacy temporary name in free text when migrating copy. */
export function stripHardcodedIdentityCopy(text: string): string {
  return text
    .replace(/\bRandy\b/g, DEFAULT_APPOINTMENT_AGENT_NAME)
    .replace(/\brandy\b/g, DEFAULT_APPOINTMENT_AGENT_NAME.toLowerCase());
}
