import "server-only";

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { loadMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import {
  applyIngressConsentToRoutingProfile,
  resolveIngressConsentAuthority,
  type MctbIngressConsentAuthority,
  type MctbIngressConsentAuthoritySource,
} from "@/lib/mctb/consent-mode-authority-core";
import type { MctbInboundRoutingProfile } from "@/lib/mctb/texml-ingress/routing-profile";

export type { MctbIngressConsentAuthority, MctbIngressConsentAuthoritySource };
export {
  applyIngressConsentToRoutingProfile,
  resolveIngressConsentAuthority,
} from "@/lib/mctb/consent-mode-authority-core";

export function newConsentConfigRevision(): string {
  return `ccfg_${Date.now()}`;
}

async function loadSolutionConsentMode(workspaceId: string): Promise<unknown> {
  const solution = await loadMissedCallTextBack(workspaceId).catch(() => null);
  if (!solution?.config || typeof solution.config !== "object") return undefined;
  return (solution.config as Record<string, unknown>).consentMode;
}

export async function readIngressConsentAuthorityForPhone(input: {
  workspaceId: string;
  phoneNumberId: string;
  phoneSettingsJson: unknown;
  workspaceCustomFieldsConfig: unknown;
}): Promise<MctbIngressConsentAuthority> {
  const solutionConsentMode = await loadSolutionConsentMode(input.workspaceId);
  return resolveIngressConsentAuthority({
    phoneSettingsJson: input.phoneSettingsJson,
    workspaceCustomFieldsConfig: input.workspaceCustomFieldsConfig,
    solutionConsentMode,
  });
}

export async function readIngressConsentAuthorityByE164(
  e164: string,
): Promise<
  | (MctbIngressConsentAuthority & {
      workspaceId: string;
      phoneNumberId: string;
      e164: string;
    })
  | null
> {
  const { resolveMctbTexmlIngressConfig } = await import("@/lib/mctb/texml-ingress/config-cache");
  const ingress = await resolveMctbTexmlIngressConfig(e164);
  if (!ingress) return null;

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: ingress.phoneNumberId, workspaceId: ingress.workspaceId },
    select: { id: true, e164: true, settingsJson: true, workspaceId: true },
  });
  if (!phone?.e164) return null;

  const ws = await prisma.workspace.findUnique({
    where: { id: ingress.workspaceId },
    select: { customFieldsConfig: true },
  });

  const authority = await readIngressConsentAuthorityForPhone({
    workspaceId: ingress.workspaceId,
    phoneNumberId: phone.id,
    phoneSettingsJson: phone.settingsJson,
    workspaceCustomFieldsConfig: ws?.customFieldsConfig,
  });

  return {
    ...authority,
    workspaceId: ingress.workspaceId,
    phoneNumberId: phone.id,
    e164: phone.e164,
  };
}

/**
 * Persist customer consent selection durably (workspace + every MCTB ingress phone).
 * Cache warm/invalidation must happen after this succeeds.
 */
export async function persistAuthoritativeConsentMode(input: {
  workspaceId: string;
  consentMode: MctbConsentMode;
  configRevision?: string;
}): Promise<{ configRevision: string }> {
  const prisma = getPrisma();
  const revision = input.configRevision?.trim() || newConsentConfigRevision();

  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  const cfg =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
  const onboardingRaw =
    cfg.mctbOnboarding && typeof cfg.mctbOnboarding === "object"
      ? (cfg.mctbOnboarding as Record<string, unknown>)
      : {};

  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId: input.workspaceId, status: { not: "Released" } },
    select: { id: true, e164: true, settingsJson: true },
  });

  const ingressPhoneIds = new Set<string>();
  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const runtime = await loadMissedCallTextConfig(input.workspaceId);
  if (runtime.phoneNumberId) ingressPhoneIds.add(runtime.phoneNumberId);

  for (const phone of phones) {
    const settings = (phone.settingsJson || {}) as Record<string, unknown>;
    const telephony = (settings.telephony || {}) as Record<string, unknown>;
    const mctbInbound = settings.mctbInbound as Record<string, unknown> | undefined;
    if (
      telephony.routingMode === "mctb_texml" ||
      settings.routingOwner === "mctb_texml" ||
      mctbInbound?.texmlHandlerMode ||
      mctbInbound?.routingToken
    ) {
      ingressPhoneIds.add(phone.id);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspace.update({
      where: { id: input.workspaceId },
      data: {
        customFieldsConfig: {
          ...cfg,
          ...(onboardingRaw.version != null
            ? {
                mctbOnboarding: {
                  ...onboardingRaw,
                  consentMode: input.consentMode,
                },
              }
            : {}),
          mctb: {
            ...mctb,
            consentMode: input.consentMode,
            consentConfigRevision: revision,
          },
        } as Prisma.InputJsonValue,
      },
    });

    for (const phoneId of ingressPhoneIds) {
      const phone = phones.find((p) => p.id === phoneId);
      if (!phone) continue;
      const settings = (phone.settingsJson || {}) as Record<string, unknown>;
      const inbound = (settings.mctbInbound || {}) as Record<string, unknown>;
      await tx.phoneNumber.update({
        where: { id: phoneId },
        data: {
          settingsJson: {
            ...settings,
            mctbInbound: {
              ...inbound,
              consentMode: input.consentMode,
              consentConfigRevision: revision,
            },
          } as Prisma.InputJsonValue,
        },
      });
    }
  });

  return { configRevision: revision };
}

/** Converge legacy duplicates onto workspace + phone authority (idempotent). */
export async function backfillIngressConsentAuthorityForWorkspace(
  workspaceId: string,
): Promise<MctbConsentMode | null> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  if (!ws) return null;

  const solutionConsentMode = await loadSolutionConsentMode(workspaceId);
  const workspaceOnly = resolveIngressConsentAuthority({
    phoneSettingsJson: {},
    workspaceCustomFieldsConfig: ws.customFieldsConfig,
    solutionConsentMode,
  });

  if (workspaceOnly.source === "unconfigured") return null;

  const { configRevision } = await persistAuthoritativeConsentMode({
    workspaceId,
    consentMode: workspaceOnly.consentMode,
  });

  void configRevision;
  return workspaceOnly.consentMode;
}

export type MctbIngressRoutingObservability = {
  workspaceId: string | null;
  phoneNumberId: string | null;
  profileSource: "cache" | "persisted_load" | "unresolved";
  effectiveConsentMode: MctbConsentMode | null;
  authoritySource: MctbIngressConsentAuthoritySource | null;
  configRevision: string | null;
  legacyFallbackUsed: boolean;
};

export function logMctbIngressConsentRouting(obs: MctbIngressRoutingObservability): void {
  console.log(
    JSON.stringify({
      source: "mctb-ingress-consent",
      ...obs,
    }),
  );
}

/**
 * Resolve routing profile for TeXML: optional cache shell + always authoritative consent from DB.
 */
export async function resolveInboundRoutingProfileWithAuthoritativeConsent(input: {
  e164: string;
  routingTokenParam?: string | null;
  cachedProfile: MctbInboundRoutingProfile | null;
  profileSource: "cache" | "persisted_load";
}): Promise<
  | { profile: MctbInboundRoutingProfile; authority: MctbIngressConsentAuthority; observability: MctbIngressRoutingObservability }
  | { profile: null; observability: MctbIngressRoutingObservability }
> {
  const authorityRow = await readIngressConsentAuthorityByE164(input.e164);
  if (!authorityRow) {
    const obs: MctbIngressRoutingObservability = {
      workspaceId: null,
      phoneNumberId: null,
      profileSource: "unresolved",
      effectiveConsentMode: null,
      authoritySource: null,
      configRevision: null,
      legacyFallbackUsed: false,
    };
    logMctbIngressConsentRouting(obs);
    return { profile: null, observability: obs };
  }

  let shell = input.cachedProfile;
  if (!shell) {
    const { warmMctbInboundRoutingProfileForE164 } = await import(
      "@/lib/mctb/texml-ingress/routing-profile"
    );
    shell = await warmMctbInboundRoutingProfileForE164(input.e164);
  }

  if (!shell) {
    const obs: MctbIngressRoutingObservability = {
      workspaceId: authorityRow.workspaceId,
      phoneNumberId: authorityRow.phoneNumberId,
      profileSource: "unresolved",
      effectiveConsentMode: authorityRow.consentMode,
      authoritySource: authorityRow.source,
      configRevision: authorityRow.configRevision,
      legacyFallbackUsed: authorityRow.legacyFallbackUsed,
    };
    logMctbIngressConsentRouting(obs);
    return { profile: null, observability: obs };
  }

  const authority: MctbIngressConsentAuthority = {
    consentMode: authorityRow.consentMode,
    source: authorityRow.source,
    configRevision: authorityRow.configRevision,
    legacyFallbackUsed: authorityRow.legacyFallbackUsed,
  };

  const profile = applyIngressConsentToRoutingProfile(shell, authority);
  const obs: MctbIngressRoutingObservability = {
    workspaceId: authorityRow.workspaceId,
    phoneNumberId: authorityRow.phoneNumberId,
    profileSource: input.profileSource,
    effectiveConsentMode: profile.consentMode,
    authoritySource: authority.source,
    configRevision: authority.configRevision,
    legacyFallbackUsed: authority.legacyFallbackUsed,
  };
  logMctbIngressConsentRouting(obs);

  if (authority.legacyFallbackUsed) {
    void backfillIngressConsentAuthorityForWorkspace(authorityRow.workspaceId).catch(() => undefined);
  }

  return { profile, authority, observability: obs };
}
