import { randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { buildClickToTextHref } from "@/lib/growth/click-to-text";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type TapToJoinRecord = {
  id: string;
  workspaceId: string;
  name: string;
  keywordId: string | null;
  phoneNumberId: string | null;
  phoneE164: string;
  body: string;
  href: string;
  publicSlug: string | null;
  buttonText: string;
  clicks: number;
  joinCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  keyword?: string | null;
  listName?: string | null;
  phoneLabel?: string | null;
};

export function generateListGrowthPublicSlug(prefix: string) {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

/** sms: URI with URL-encoded body — works on iOS and Android. */
export function buildTapToJoinSmsHref(phoneE164: string, keyword: string) {
  return buildClickToTextHref(normalizeE164(phoneE164), keyword.trim());
}

export function buildTapToJoinPublicUrl(publicSlug: string) {
  return `${getAppBaseUrl()}/j/${publicSlug}`;
}

export function buildTapToJoinButtonHtml(publicUrl: string, buttonText: string) {
  const label = buttonText.trim() || "Join our text list";
  return `<a href="${publicUrl}">${label}</a>`;
}

function mapRow(row: {
  id: string;
  workspaceId: string;
  name: string;
  keywordId: string | null;
  phoneNumberId: string | null;
  phoneE164: string;
  body: string;
  href: string;
  publicSlug: string | null;
  buttonText: string;
  clicks: number;
  joinCount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): TapToJoinRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    keywordId: row.keywordId,
    phoneNumberId: row.phoneNumberId,
    phoneE164: row.phoneE164,
    body: row.body,
    href: row.href,
    publicSlug: row.publicSlug,
    buttonText: row.buttonText,
    clicks: row.clicks,
    joinCount: row.joinCount,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function hydrateTapToJoinRows(
  workspaceId: string,
  rows: TapToJoinRecord[],
): Promise<TapToJoinRecord[]> {
  const prisma = getPrisma();
  const keywordIds = [...new Set(rows.map((r) => r.keywordId).filter(Boolean))] as string[];
  const phoneIds = [...new Set(rows.map((r) => r.phoneNumberId).filter(Boolean))] as string[];

  const keywords =
    keywordIds.length > 0
      ? await prisma.keyword.findMany({
          where: { workspaceId, id: { in: keywordIds } },
          select: { id: true, keyword: true, listName: true },
        })
      : [];
  const phones =
    phoneIds.length > 0
      ? await prisma.phoneNumber.findMany({
          where: { workspaceId, id: { in: phoneIds } },
          select: { id: true, e164: true, friendlyName: true },
        })
      : [];

  const kwById = new Map(keywords.map((k) => [k.id, k]));
  const phoneById = new Map(phones.map((p) => [p.id, p]));

  return rows.map((row) => {
    const kw = row.keywordId ? kwById.get(row.keywordId) : undefined;
    const pn = row.phoneNumberId ? phoneById.get(row.phoneNumberId) : undefined;
    return {
      ...row,
      keyword: kw?.keyword ?? row.body,
      listName: kw?.listName ?? null,
      phoneLabel: pn?.friendlyName || pn?.e164 || row.phoneE164,
    };
  });
}

export async function listTapToJoinLinks(workspaceId: string) {
  const rows = await getPrisma().clickToTextLink.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  return hydrateTapToJoinRows(workspaceId, rows.map(mapRow));
}

export async function getTapToJoinLink(workspaceId: string, id: string) {
  const row = await getPrisma().clickToTextLink.findFirst({
    where: { id, workspaceId },
  });
  if (!row) return null;
  const [hydrated] = await hydrateTapToJoinRows(workspaceId, [mapRow(row)]);
  return hydrated;
}

export async function createTapToJoinLink(
  workspaceId: string,
  input: {
    name: string;
    keywordId: string;
    phoneNumberId?: string | null;
    phoneE164?: string;
    buttonText?: string;
    status?: string;
  },
) {
  const prisma = getPrisma();
  const keyword = await prisma.keyword.findFirst({
    where: { id: input.keywordId, workspaceId },
  });
  if (!keyword) throw new Error("Keyword not found");

  let phoneE164 = input.phoneE164?.trim();
  let phoneNumberId = input.phoneNumberId || null;

  if (phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId, status: "Active" },
      select: { e164: true },
    });
    if (!pn) throw new Error("Sending number not found");
    phoneE164 = pn.e164;
  } else if (phoneE164) {
    phoneE164 = normalizeE164(phoneE164);
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164: phoneE164, status: "Active" },
      select: { id: true },
    });
    phoneNumberId = pn?.id ?? null;
  } else if (keyword.phoneNumber && keyword.phoneNumber !== "*") {
    phoneE164 = normalizeE164(keyword.phoneNumber);
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164: phoneE164, status: "Active" },
      select: { id: true },
    });
    phoneNumberId = pn?.id ?? null;
  } else {
    const reg = await prisma.messagingRegistration.findUnique({
      where: { workspaceId },
      select: { phoneE164: true },
    });
    if (!reg?.phoneE164) throw new Error("No SMS sending number configured");
    phoneE164 = reg.phoneE164;
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164: phoneE164, status: "Active" },
      select: { id: true },
    });
    phoneNumberId = pn?.id ?? null;
  }

  const body = keyword.keyword.trim().toUpperCase();
  const href = buildTapToJoinSmsHref(phoneE164, body);
  const publicSlug = generateListGrowthPublicSlug("j");

  const row = await prisma.clickToTextLink.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      keywordId: keyword.id,
      phoneNumberId,
      phoneE164,
      body,
      href,
      publicSlug,
      buttonText: input.buttonText?.trim() || "Join our text list",
      status: input.status === "Paused" ? "Paused" : "Active",
    },
  });

  return getTapToJoinLink(workspaceId, row.id);
}

export async function updateTapToJoinLink(
  workspaceId: string,
  id: string,
  input: {
    name?: string;
    keywordId?: string;
    phoneNumberId?: string | null;
    buttonText?: string;
    status?: string;
  },
) {
  const prisma = getPrisma();
  const existing = await prisma.clickToTextLink.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Tap-to-Join link not found");

  const keywordId = input.keywordId ?? existing.keywordId;
  if (!keywordId) throw new Error("keywordId is required");

  const keyword = await prisma.keyword.findFirst({ where: { id: keywordId, workspaceId } });
  if (!keyword) throw new Error("Keyword not found");

  let phoneNumberId =
    input.phoneNumberId !== undefined ? input.phoneNumberId : existing.phoneNumberId;
  let phoneE164 = existing.phoneE164;

  if (phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId, status: "Active" },
      select: { e164: true },
    });
    if (!pn) throw new Error("Sending number not found");
    phoneE164 = pn.e164;
  }

  const body = keyword.keyword.trim().toUpperCase();
  const href = buildTapToJoinSmsHref(phoneE164, body);

  await prisma.clickToTextLink.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      keywordId: keyword.id,
      phoneNumberId,
      phoneE164,
      body,
      href,
      ...(input.buttonText != null ? { buttonText: input.buttonText.trim() } : {}),
      ...(input.status != null ? { status: input.status === "Paused" ? "Paused" : "Active" } : {}),
    },
  });

  return getTapToJoinLink(workspaceId, id);
}

export async function recordTapToJoinClick(publicSlug: string) {
  const prisma = getPrisma();
  const link = await prisma.clickToTextLink.findFirst({
    where: { publicSlug, status: "Active" },
  });
  if (!link) return null;
  await prisma.clickToTextLink.update({
    where: { id: link.id },
    data: { clicks: { increment: 1 } },
  });
  return link;
}

export async function recordTapToJoinJoin(workspaceId: string, keywordId: string) {
  await getPrisma().clickToTextLink.updateMany({
    where: { workspaceId, keywordId, status: "Active" },
    data: { joinCount: { increment: 1 } },
  });
}
