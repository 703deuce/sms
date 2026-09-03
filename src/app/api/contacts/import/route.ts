import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { assignContactToLists, resolveOrCreateListIdsByName } from "@/lib/contacts/list-assignment";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

type ImportRow = {
  phone?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  tags?: string[];
  listName?: string;
  status?: string;
};

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      rows?: ImportRow[];
      listName?: string;
      listNames?: string[];
      listId?: string;
      listIds?: string[];
      consentSource?: string;
      marketingImport?: boolean;
      attestationId?: string;
    };
    if (!body.rows?.length) {
      return NextResponse.json({ error: "rows required" }, { status: 400 });
    }

    if (body.marketingImport || (await import("@/lib/mass-texting/access").then((m) => m.isMassTextingWorkspace(auth.workspaceId)))) {
      if (!body.attestationId) {
        return NextResponse.json(
          { error: "List consent attestation is required for marketing imports." },
          { status: 400 },
        );
      }
      const attestation = await getPrisma().listImportAttestation.findFirst({
        where: { id: body.attestationId, workspaceId: auth.workspaceId },
      });
      if (!attestation) {
        return NextResponse.json({ error: "Invalid import attestation." }, { status: 400 });
      }
    }

    const prisma = getPrisma();
    let created = 0;
    let updated = 0;
    let suppressedSkipped = 0;
    const errors: Array<{ row: number; error: string }> = [];

    let targetListIds: string[] = [];
    if (body.listIds?.length) {
      targetListIds.push(...body.listIds);
    }
    if (body.listId) {
      targetListIds.push(body.listId);
    }
    const listNames = [
      ...(body.listName ? [body.listName] : []),
      ...(body.listNames || []),
    ];
    if (listNames.length) {
      targetListIds.push(...(await resolveOrCreateListIdsByName(auth.workspaceId, listNames)));
    }
    targetListIds = [...new Set(targetListIds)];

    if (targetListIds.length) {
      const valid = await prisma.contactList.findMany({
        where: { workspaceId: auth.workspaceId, id: { in: targetListIds } },
        select: { id: true },
      });
      targetListIds = valid.map((l) => l.id);
    }

    const listNameCache = new Map<string, string>();
    const resolveRowListNames = async (names: string[]): Promise<string[]> => {
      const uniqueNames = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
      const uncached = uniqueNames.filter((name) => !listNameCache.has(name));
      if (uncached.length) {
        const resolved = await resolveOrCreateListIdsByName(auth.workspaceId, uncached);
        uncached.forEach((name, idx) => {
          const id = resolved[idx];
          if (id) listNameCache.set(name, id);
        });
      }
      return [
        ...new Set(
          uniqueNames.map((name) => listNameCache.get(name)).filter((id): id is string => Boolean(id)),
        ),
      ];
    };

    for (let i = 0; i < body.rows.length; i += 1) {
      const row = body.rows[i];
      try {
        if (!row.phone) throw new Error("phone required");
        const phone = normalizeE164(row.phone);
        const suppressed = await prisma.suppression.findFirst({
          where: { workspaceId: auth.workspaceId, phone },
        });
        if (suppressed) {
          suppressedSkipped += 1;
          continue;
        }

        const existing = await prisma.contact.findUnique({
          where: {
            workspaceId_phone: { workspaceId: auth.workspaceId, phone },
          },
        });
        if (existing && (existing.status === "UNSUBSCRIBED" || existing.status === "BLOCKED")) {
          suppressedSkipped += 1;
          continue;
        }
        const contact = await prisma.contact.upsert({
          where: {
            workspaceId_phone: { workspaceId: auth.workspaceId, phone },
          },
          create: {
            workspaceId: auth.workspaceId,
            phone,
            firstName: row.firstName || null,
            lastName: row.lastName || null,
            email: row.email || null,
            status: row.status || "SUBSCRIBED",
            consentSource: body.consentSource || "import",
            consentDate: new Date(),
          },
          update: {
            firstName: row.firstName || undefined,
            lastName: row.lastName || undefined,
            email: row.email || undefined,
            status: row.status || undefined,
          },
        });
        if (existing) updated += 1;
        else created += 1;

        if (targetListIds.length || row.listName?.trim()) {
          const rowListIds = [
            ...targetListIds,
            ...(row.listName?.trim()
              ? await resolveRowListNames([row.listName.trim()])
              : []),
          ];
          const uniqueRowListIds = [...new Set(rowListIds)];
          if (uniqueRowListIds.length) {
            await assignContactToLists(auth.workspaceId, contact.id, uniqueRowListIds);
          }
        }

        for (const tagName of row.tags || []) {
          const name = tagName.trim().toLowerCase();
          if (!name) continue;
          const tag = await prisma.tag.upsert({
            where: {
              workspaceId_name: { workspaceId: auth.workspaceId, name },
            },
            create: { workspaceId: auth.workspaceId, name },
            update: {},
          });
          await prisma.contactTag.upsert({
            where: { tagId_contactId: { tagId: tag.id, contactId: contact.id } },
            create: { tagId: tag.id, contactId: contact.id },
            update: {},
          });
        }
      } catch (err) {
        errors.push({
          row: i,
          error: err instanceof Error ? err.message : "import failed",
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        workspaceId: auth.workspaceId,
        userId: auth.session.userId,
        event: "contacts.import",
        detail: `created=${created} updated=${updated} suppressedSkipped=${suppressedSkipped} errors=${errors.length}`,
      },
    });

    return NextResponse.json({
      data: { created, updated, suppressedSkipped, errors, listIds: targetListIds },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
