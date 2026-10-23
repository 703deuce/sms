import { getPrisma } from "@/lib/server/db";

export type InboundContactRules = {
  enabled?: boolean;
  minConnectedSeconds?: number;
  createOnMissed?: boolean;
  updateLastCallOnExisting?: boolean;
};

export type TeamPermissionScopes = {
  contactsRead?: "all" | "owned";
  contactsWrite?: "all" | "owned";
};

export async function getOrCreateWorkspaceCrmSettings(workspaceId: string) {
  const prisma = getPrisma();
  const row = await prisma.workspaceCrmSettings.upsert({
    where: { workspaceId },
    create: { workspaceId },
    update: {},
  });
  const prefs =
    row.prefsJson && typeof row.prefsJson === "object"
      ? (row.prefsJson as Record<string, unknown>)
      : {};
  const inbound =
    row.inboundContactRules && typeof row.inboundContactRules === "object"
      ? (row.inboundContactRules as InboundContactRules)
      : {};
  return {
    ...row,
    teamScopes: (prefs.teamScopes as TeamPermissionScopes) || {
      contactsRead: "all",
      contactsWrite: "owned",
    },
    inboundContactRules: {
      enabled: inbound.enabled ?? false,
      minConnectedSeconds: inbound.minConnectedSeconds ?? 15,
      createOnMissed: inbound.createOnMissed ?? true,
      updateLastCallOnExisting: inbound.updateLastCallOnExisting ?? true,
    },
  };
}

export async function patchWorkspaceCrmSettings(
  workspaceId: string,
  patch: {
    defaultCountryCode?: string;
    allowedCountries?: string[];
    blockedCountries?: string[];
    phoneFallthroughMode?: "next_number" | "next_contact";
    inboundContactRules?: InboundContactRules;
    teamScopes?: TeamPermissionScopes;
    dialPolicyJson?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const existing = await getOrCreateWorkspaceCrmSettings(workspaceId);
  const prefs = { ...(existing.prefsJson as object), teamScopes: patch.teamScopes ?? existing.teamScopes };
  return prisma.workspaceCrmSettings.update({
    where: { workspaceId },
    data: {
      ...(patch.defaultCountryCode ? { defaultCountryCode: patch.defaultCountryCode } : {}),
      ...(patch.allowedCountries ? { allowedCountries: patch.allowedCountries } : {}),
      ...(patch.blockedCountries ? { blockedCountries: patch.blockedCountries } : {}),
      ...(patch.phoneFallthroughMode ? { phoneFallthroughMode: patch.phoneFallthroughMode } : {}),
      ...(patch.inboundContactRules
        ? { inboundContactRules: patch.inboundContactRules as import("@prisma/client").Prisma.InputJsonValue }
        : {}),
      prefsJson: prefs as import("@prisma/client").Prisma.InputJsonValue,
      ...(patch.dialPolicyJson !== undefined
        ? { dialPolicyJson: patch.dialPolicyJson as import("@prisma/client").Prisma.InputJsonValue }
        : {}),
    },
  });
}
