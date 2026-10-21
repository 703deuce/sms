import "server-only";

import { getPrisma } from "@/lib/server/db";
import { MCTB_FIRST_TEXT_TEMPLATE_ORDER, getMctbFirstTextTemplate } from "@/lib/mctb/first-text-templates/registry";
import { renderMctbFirstTextPreviewExample } from "@/lib/mctb/first-text-templates/render";
import { writeMctbFirstTextTemplateConfig } from "@/lib/mctb/first-text-templates/persistence";
import type { MctbFirstTextTemplateId } from "@/lib/mctb/first-text-templates/types";
import { MCTB_CONSENT_MODE_EXISTING, normalizeMctbConsentMode } from "@/lib/mctb/consent-mode";
import {
  loadMctbConsentMode,
  readExistingConsentAttestation,
  recordWorkspaceExistingConsentAttestation,
} from "@/lib/server/mctb/attestation";
import { loadMctbRecoveryConfig, updateMctbRecoveryConfig } from "@/lib/server/mctb/config";
import { mergePhoneMctbInbound, readPhoneMctbInbound } from "@/lib/server/mctb/phone-line-config";

export async function getPhoneMctbSettings(workspaceId: string) {
  const prisma = getPrisma();
  const [numbers, config, consentMode, ws] = await Promise.all([
    prisma.phoneNumber.findMany({
      where: { workspaceId, status: "Active" },
      select: { id: true, e164: true, friendlyName: true, settingsJson: true },
      orderBy: { createdAt: "asc" },
    }),
    loadMctbRecoveryConfig(workspaceId),
    loadMctbConsentMode(workspaceId),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, customFieldsConfig: true },
    }),
  ]);

  const attestation = readExistingConsentAttestation(ws?.customFieldsConfig);
  const templates = MCTB_FIRST_TEXT_TEMPLATE_ORDER.map((id) => {
    const def = getMctbFirstTextTemplate(id);
    return {
      id,
      name: def.name,
      purpose: def.purpose,
      preview: renderMctbFirstTextPreviewExample(id, ws?.name || "Your business"),
    };
  });

  const recent = await prisma.missedCallEvent.findMany({
    where: { workspaceId },
    orderBy: { detectedAt: "desc" },
    take: 10,
    select: {
      id: true,
      humanCallId: true,
      callerE164: true,
      status: true,
      suppressionReason: true,
      smsSentAt: true,
      detectedAt: true,
      phoneNumberId: true,
    },
  });

  const exclusions = await prisma.suppression.findMany({
    where: { workspaceId },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: { id: true, phone: true, reason: true, createdAt: true },
  });

  return {
    numbers: numbers.map((n) => ({
      id: n.id,
      e164: n.e164,
      label: n.friendlyName || n.e164,
      mctb: readPhoneMctbInbound(n.settingsJson),
    })),
    recovery: {
      enabled: config.masterEnabled,
      active: config.enabled,
      delaySeconds: config.delaySeconds,
      cooldownMinutes: config.cooldownMinutes,
      triggers: {
        noAnswer: config.sendAfterNoAnswer,
        busy: config.sendAfterBusy,
        rejected: config.sendAfterRejected,
        unreachable: config.sendAfterTimeout,
        voicemail: config.sendAfterVoicemail,
      },
      manuallyPaused: config.manuallyPaused,
      pauseUntil: config.pauseUntil,
    },
    consent: {
      mode: consentMode,
      defaultMode: MCTB_CONSENT_MODE_EXISTING,
      attestation,
    },
    template: {
      selectedId: config.firstTextTemplate.templateId,
      templates,
    },
    recentActivity: recent,
    exclusions,
  };
}

export async function patchPhoneMctbSettings(
  workspaceId: string,
  body: Record<string, unknown>,
  actorUserId: string,
) {
  const prisma = getPrisma();

  if (body.numberId && typeof body.numberId === "string") {
    const patch = body.line as Record<string, unknown> | undefined;
    if (patch) {
      const row = await prisma.phoneNumber.findFirst({
        where: { id: body.numberId, workspaceId },
        select: { settingsJson: true },
      });
      if (!row) throw new Error("number_not_found");
      const next = mergePhoneMctbInbound(row.settingsJson, {
        enabled: patch.enabled === true,
        consentMode: patch.consentMode
          ? normalizeMctbConsentMode(patch.consentMode)
          : undefined,
      });
      await prisma.phoneNumber.update({
        where: { id: body.numberId },
        data: { settingsJson: next },
      });
    }
  }

  const recovery = body.recovery as Record<string, unknown> | undefined;
  if (recovery) {
    const triggers = recovery.triggers as Record<string, boolean> | undefined;
    await updateMctbRecoveryConfig(workspaceId, {
      enabled: recovery.enabled === true,
      delaySeconds: typeof recovery.delaySeconds === "number" ? recovery.delaySeconds : undefined,
      cooldownMinutes:
        typeof recovery.cooldownMinutes === "number" ? recovery.cooldownMinutes : undefined,
      manuallyPaused: recovery.manuallyPaused === true ? true : recovery.manuallyPaused === false ? false : undefined,
      pauseUntil:
        recovery.pauseUntil === null
          ? null
          : typeof recovery.pauseUntil === "string"
            ? recovery.pauseUntil
            : undefined,
      sendAfterNoAnswer: triggers?.noAnswer,
      sendAfterBusy: triggers?.busy,
      sendAfterRejected: triggers?.rejected,
      sendAfterTimeout: triggers?.unreachable,
      sendAfterVoicemail: triggers?.voicemail,
    });
  }

  const consent = body.consent as Record<string, unknown> | undefined;
  if (consent?.certifyExistingConsent === true) {
    await recordWorkspaceExistingConsentAttestation({
      workspaceId,
      attestedByUserId: actorUserId,
    });
  }
  if (consent?.mode) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customFieldsConfig: true },
    });
    const cfg =
      ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
        ? (ws.customFieldsConfig as Record<string, unknown>)
        : {};
    const mctb =
      cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        customFieldsConfig: {
          ...cfg,
          mctb: { ...mctb, consentMode: normalizeMctbConsentMode(consent.mode) },
        },
      },
    });
  }

  const templateId = body.templateId;
  if (typeof templateId === "string") {
    const config = await loadMctbRecoveryConfig(workspaceId);
    await writeMctbFirstTextTemplateConfig(workspaceId, {
      ...config.firstTextTemplate,
      templateId: templateId as MctbFirstTextTemplateId,
    });
  }

  if (body.addExclusion && typeof body.addExclusion === "string") {
    const phone = body.addExclusion.trim();
    await prisma.suppression.create({
      data: {
        workspaceId,
        phone,
        reason: "mctb_exclusion",
        suppressionKey: `${workspaceId}:p:${phone}`,
      },
    });
  }

  if (body.removeExclusionId && typeof body.removeExclusionId === "string") {
    await prisma.suppression.deleteMany({
      where: { id: body.removeExclusionId, workspaceId },
    });
  }

  return getPhoneMctbSettings(workspaceId);
}
