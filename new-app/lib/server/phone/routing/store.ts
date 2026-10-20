import { getPrisma } from "@/lib/server/db";
import { validateDestinationE164, validateMenuDigit } from "./validation";

export async function listForwardingDestinations(workspaceId: string) {
  return getPrisma().forwardingDestination.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

export async function createForwardingDestination(
  workspaceId: string,
  input: {
    name: string;
    phoneE164: string;
    enabled?: boolean;
    screeningEnabled?: boolean;
    press1Required?: boolean;
    privateAnnouncement?: string | null;
    ringTimeoutSec?: number;
    callerIdPolicy?: string;
    hostedE164?: string;
  },
) {
  const { getForwardingEntitlements } = await import("./forwarding-entitlements");
  const ent = await getForwardingEntitlements(workspaceId);
  if (ent.destinations.atLimit) {
    throw new Error(
      `Destination limit reached (${ent.destinations.max}). Upgrade your plan to add more forwarding numbers.`,
    );
  }
  const phoneE164 = validateDestinationE164(input.phoneE164, input.hostedE164);
  return getPrisma().forwardingDestination.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      phoneE164,
      enabled: input.enabled ?? true,
      screeningEnabled: input.screeningEnabled ?? false,
      press1Required: input.press1Required ?? false,
      privateAnnouncement: input.privateAnnouncement ?? null,
      ringTimeoutSec: input.ringTimeoutSec ?? 25,
      callerIdPolicy: input.callerIdPolicy ?? "original",
    },
  });
}

export async function updateForwardingDestination(
  workspaceId: string,
  id: string,
  patch: Partial<{
    name: string;
    phoneE164: string;
    enabled: boolean;
    screeningEnabled: boolean;
    press1Required: boolean;
    privateAnnouncement: string | null;
    ringTimeoutSec: number;
    callerIdPolicy: string;
  }>,
) {
  const existing = await getPrisma().forwardingDestination.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Destination not found");
  const phoneE164 = patch.phoneE164 ? validateDestinationE164(patch.phoneE164) : undefined;
  return getPrisma().forwardingDestination.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(phoneE164 ? { phoneE164 } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.screeningEnabled !== undefined ? { screeningEnabled: patch.screeningEnabled } : {}),
      ...(patch.press1Required !== undefined ? { press1Required: patch.press1Required } : {}),
      ...(patch.privateAnnouncement !== undefined ? { privateAnnouncement: patch.privateAnnouncement } : {}),
      ...(patch.ringTimeoutSec !== undefined ? { ringTimeoutSec: patch.ringTimeoutSec } : {}),
      ...(patch.callerIdPolicy !== undefined ? { callerIdPolicy: patch.callerIdPolicy } : {}),
    },
  });
}

export async function deleteForwardingDestination(workspaceId: string, id: string) {
  const existing = await getPrisma().forwardingDestination.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Destination not found");
  await getPrisma().forwardingGroupMember.deleteMany({ where: { destinationId: id } });
  await getPrisma().forwardingDestination.delete({ where: { id } });
}

export async function getForwardingConfig(workspaceId: string) {
  const prisma = getPrisma();
  const [destinations, groups, policies, usage] = await Promise.all([
    prisma.forwardingDestination.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
    prisma.forwardingGroup.findMany({
      where: { workspaceId },
      include: {
        members: {
          include: { destination: true },
          orderBy: { priority: "asc" },
        },
      },
    }),
    prisma.phoneNumberAnsweringPolicy.findMany({ where: { workspaceId } }),
    prisma.forwardingUsageMonthly.findFirst({
      where: { workspaceId, yearMonth: currentYearMonth() },
    }),
  ]);
  return { destinations, groups, policies, usage };
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getAnsweringPolicyForNumber(workspaceId: string, phoneNumberId: string) {
  return getPrisma().phoneNumberAnsweringPolicy.findFirst({
    where: { workspaceId, phoneNumberId },
    include: {
      forwardingGroup: {
        include: {
          members: { include: { destination: true }, orderBy: { priority: "asc" } },
        },
      },
      autoAttendantMenu: { include: { options: { orderBy: { sortOrder: "asc" } } } },
    },
  });
}

export async function upsertAnsweringPolicy(
  workspaceId: string,
  phoneNumberId: string,
  data: {
    answeringMode?: string;
    forwardingGroupId?: string | null;
    primaryDestinationId?: string | null;
    autoAttendantMenuId?: string | null;
    paused?: boolean;
    greetingBeforeForward?: boolean;
    greetingText?: string | null;
    scheduleJson?: unknown;
    holidayExceptionsJson?: unknown;
  },
) {
  const prisma = getPrisma();
  const existing = await prisma.phoneNumberAnsweringPolicy.findUnique({ where: { phoneNumberId } });
  const version = (existing?.version ?? 0) + 1;
  return prisma.phoneNumberAnsweringPolicy.upsert({
    where: { phoneNumberId },
    create: {
      workspaceId,
      phoneNumberId,
      version,
      ...data,
    },
    update: {
      ...data,
      version,
    },
  });
}

export async function listAutoAttendantMenus(workspaceId: string) {
  return getPrisma().autoAttendantMenu.findMany({
    where: { workspaceId },
    include: { options: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getAutoAttendantMenu(workspaceId: string, id: string) {
  const row = await getPrisma().autoAttendantMenu.findFirst({
    where: { id, workspaceId },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  if (!row) throw new Error("Menu not found");
  return row;
}

export async function createAutoAttendantMenu(workspaceId: string, name: string) {
  const { getForwardingEntitlements } = await import("./forwarding-entitlements");
  const ent = await getForwardingEntitlements(workspaceId);
  if (ent.ivrMenus.atLimit) {
    throw new Error(`IVR menu limit reached (${ent.ivrMenus.max}). Upgrade to add more menus.`);
  }
  return getPrisma().autoAttendantMenu.create({
    data: { workspaceId, name: name.trim() },
  });
}

export async function saveAutoAttendantMenu(
  workspaceId: string,
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    greetingMode?: string;
    greetingText?: string | null;
    greetingAudioUrl?: string | null;
    voice?: string | null;
    language?: string | null;
    inputTimeoutMs?: number;
    maxRetries?: number;
    noInputActionJson?: unknown;
    invalidInputActionJson?: unknown;
    options?: Array<{
      id?: string;
      digit: string;
      label: string;
      actionType: string;
      actionConfigJson?: unknown;
      sortOrder?: number;
    }>;
  },
) {
  const menu = await getAutoAttendantMenu(workspaceId, id);
  await getPrisma().autoAttendantMenu.update({
    where: { id: menu.id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.greetingMode !== undefined ? { greetingMode: patch.greetingMode } : {}),
      ...(patch.greetingText !== undefined ? { greetingText: patch.greetingText } : {}),
      ...(patch.greetingAudioUrl !== undefined ? { greetingAudioUrl: patch.greetingAudioUrl } : {}),
      ...(patch.voice !== undefined ? { voice: patch.voice } : {}),
      ...(patch.language !== undefined ? { language: patch.language } : {}),
      ...(patch.inputTimeoutMs !== undefined ? { inputTimeoutMs: patch.inputTimeoutMs } : {}),
      ...(patch.maxRetries !== undefined ? { maxRetries: patch.maxRetries } : {}),
      ...(patch.noInputActionJson !== undefined
        ? { noInputActionJson: patch.noInputActionJson as object }
        : {}),
      ...(patch.invalidInputActionJson !== undefined
        ? { invalidInputActionJson: patch.invalidInputActionJson as object }
        : {}),
    },
  });
  if (patch.options) {
    for (const opt of patch.options) {
      validateMenuDigit(opt.digit);
    }
    await getPrisma().autoAttendantMenuOption.deleteMany({ where: { menuId: menu.id } });
    await getPrisma().autoAttendantMenuOption.createMany({
      data: patch.options.map((o, i) => ({
        menuId: menu.id,
        digit: o.digit,
        label: o.label.trim(),
        actionType: o.actionType,
        actionConfigJson: (o.actionConfigJson || {}) as object,
        sortOrder: o.sortOrder ?? i,
      })),
    });
  }
  return getAutoAttendantMenu(workspaceId, id);
}

export async function publishAutoAttendantMenu(workspaceId: string, id: string) {
  const menu = await getAutoAttendantMenu(workspaceId, id);
  if (!menu.greetingText && !menu.greetingAudioUrl) {
    throw new Error("Add a greeting before publishing");
  }
  if (!menu.options.length) {
    throw new Error("Add at least one menu option before publishing");
  }
  return getPrisma().autoAttendantMenu.update({
    where: { id },
    data: { status: "published", publishedVersion: menu.publishedVersion + 1 },
  });
}

export async function duplicateAutoAttendantMenu(workspaceId: string, id: string) {
  const menu = await getAutoAttendantMenu(workspaceId, id);
  const copy = await getPrisma().autoAttendantMenu.create({
    data: {
      workspaceId,
      name: `${menu.name} (copy)`,
      description: menu.description,
      status: "draft",
      greetingMode: menu.greetingMode,
      greetingText: menu.greetingText,
      greetingAudioUrl: menu.greetingAudioUrl,
      voice: menu.voice,
      language: menu.language,
      inputTimeoutMs: menu.inputTimeoutMs,
      maxRetries: menu.maxRetries,
      noInputActionJson: menu.noInputActionJson,
      invalidInputActionJson: menu.invalidInputActionJson,
    },
  });
  if (menu.options.length) {
    await getPrisma().autoAttendantMenuOption.createMany({
      data: menu.options.map((o) => ({
        menuId: copy.id,
        digit: o.digit,
        label: o.label,
        actionType: o.actionType,
        actionConfigJson: o.actionConfigJson as object,
        sortOrder: o.sortOrder,
      })),
    });
  }
  return copy;
}

export async function upsertForwardingGroup(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    strategy: "sequential" | "simultaneous";
    enabled?: boolean;
    memberDestinationIds?: string[];
  },
) {
  const prisma = getPrisma();
  if (input.id) {
    const existing = await prisma.forwardingGroup.findFirst({
      where: { id: input.id, workspaceId },
    });
    if (!existing) throw new Error("Group not found");
    await prisma.forwardingGroup.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        strategy: input.strategy,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
    if (input.memberDestinationIds) {
      await prisma.forwardingGroupMember.deleteMany({ where: { groupId: input.id } });
      await prisma.forwardingGroupMember.createMany({
        data: input.memberDestinationIds.map((destinationId, i) => ({
          groupId: input.id!,
          destinationId,
          priority: i,
          enabled: true,
        })),
      });
    }
    return prisma.forwardingGroup.findFirst({
      where: { id: input.id },
      include: { members: { include: { destination: true }, orderBy: { priority: "asc" } } },
    });
  }
  const group = await prisma.forwardingGroup.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      strategy: input.strategy,
      enabled: input.enabled ?? true,
    },
  });
  if (input.memberDestinationIds?.length) {
    await prisma.forwardingGroupMember.createMany({
      data: input.memberDestinationIds.map((destinationId, i) => ({
        groupId: group.id,
        destinationId,
        priority: i,
        enabled: true,
      })),
    });
  }
  return prisma.forwardingGroup.findFirst({
    where: { id: group.id },
    include: { members: { include: { destination: true }, orderBy: { priority: "asc" } } },
  });
}

export async function deleteForwardingGroup(workspaceId: string, id: string) {
  const existing = await getPrisma().forwardingGroup.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Group not found");
  await getPrisma().phoneNumberAnsweringPolicy.updateMany({
    where: { forwardingGroupId: id },
    data: { forwardingGroupId: null },
  });
  await getPrisma().forwardingGroup.delete({ where: { id } });
}

export async function validateAutoAttendantMenu(workspaceId: string, id: string) {
  const menu = await getAutoAttendantMenu(workspaceId, id);
  const issues: string[] = [];
  if (!menu.greetingText && !menu.greetingAudioUrl) {
    issues.push("missing_greeting");
  }
  if (!menu.options.length) issues.push("missing_options");
  const digits = new Set<string>();
  for (const o of menu.options) {
    if (digits.has(o.digit)) issues.push(`duplicate_digit_${o.digit}`);
    digits.add(o.digit);
    if (o.actionType === "forward_phone") {
      const cfg = (o.actionConfigJson || {}) as Record<string, unknown>;
      const dest = String(cfg.destinationE164 || cfg.phoneE164 || "");
      if (!dest) issues.push(`option_${o.digit}_missing_destination`);
    }
  }
  return { ok: issues.length === 0, issues };
}

export async function getForwardingSetupDraft(workspaceId: string) {
  return getPrisma().forwardingSetupDraft.findUnique({ where: { workspaceId } });
}

export async function saveForwardingSetupDraft(workspaceId: string, step: number, draftJson: unknown) {
  return getPrisma().forwardingSetupDraft.upsert({
    where: { workspaceId },
    create: { workspaceId, step, draftJson: draftJson as object },
    update: { step, draftJson: draftJson as object },
  });
}

export async function listVoicemailBoxes(workspaceId: string) {
  return getPrisma().voicemailBox.findMany({
    where: { workspaceId },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { name: "asc" },
  });
}

export async function upsertVoicemailBox(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    greetingText?: string | null;
    emailNotify?: string | null;
    phoneNumberId?: string | null;
    transcriptionEnabled?: boolean;
  },
) {
  const prisma = getPrisma();
  if (input.id) {
    const existing = await prisma.voicemailBox.findFirst({ where: { id: input.id, workspaceId } });
    if (!existing) throw new Error("Voicemail box not found");
    return prisma.voicemailBox.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        ...(input.greetingText !== undefined ? { greetingText: input.greetingText } : {}),
        ...(input.emailNotify !== undefined ? { emailNotify: input.emailNotify } : {}),
        ...(input.transcriptionEnabled !== undefined
          ? { transcriptionEnabled: input.transcriptionEnabled }
          : {}),
      },
    });
  }
  return prisma.voicemailBox.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      greetingText: input.greetingText ?? "Please leave a message after the tone.",
      emailNotify: input.emailNotify ?? null,
      phoneNumberId: input.phoneNumberId ?? null,
      transcriptionEnabled: input.transcriptionEnabled ?? true,
      active: true,
    },
  });
}
