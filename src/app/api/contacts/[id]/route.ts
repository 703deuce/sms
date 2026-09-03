import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { filterWorkspaceListIds } from "@/lib/contacts/workspace-membership";
import { assignContactToLists } from "@/lib/contacts/list-assignment";
import { getPrisma } from "@/lib/db";
import { loadContactById } from "@/lib/workspace-data";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await loadContactById(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      status?: string;
      assignedUser?: string | null;
      company?: string;
      tagNames?: string[];
      listIds?: string[];
      addListIds?: string[];
      removeListIds?: string[];
      customFields?: Record<string, string>;
    };

    const existing = await getPrisma().contact.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let phoneUpdate: string | undefined;
    if (body.phone?.trim()) {
      const normalized = normalizeE164(body.phone.trim());
      if (normalized !== existing.phone) {
        const conflict = await getPrisma().contact.findFirst({
          where: { workspaceId: auth.workspaceId, phone: normalized, NOT: { id } },
        });
        if (conflict) {
          return NextResponse.json({ error: "Phone number already in use" }, { status: 409 });
        }
        phoneUpdate = normalized;
      }
    }

    const contactPatch: Record<string, unknown> = {};
    if (body.firstName !== undefined) contactPatch.firstName = body.firstName;
    if (body.lastName !== undefined) contactPatch.lastName = body.lastName;
    if (body.email !== undefined) contactPatch.email = body.email;
    if (phoneUpdate !== undefined) contactPatch.phone = phoneUpdate;
    if (body.status) {
      contactPatch.status = body.status.toUpperCase() as
        | "SUBSCRIBED"
        | "UNSUBSCRIBED"
        | "BLOCKED"
        | "INVALID";
    }
    if (body.assignedUser !== undefined) contactPatch.assignedUser = body.assignedUser;
    if (body.company !== undefined) contactPatch.company = body.company;
    if (body.customFields !== undefined) {
      const prior =
        existing.customFields && typeof existing.customFields === "object"
          ? (existing.customFields as Record<string, string>)
          : {};
      contactPatch.customFields = { ...prior, ...body.customFields };
    }

    if (Object.keys(contactPatch).length > 0) {
      await getPrisma().contact.update({
        where: { id },
        data: contactPatch,
      });
    }

    if (body.tagNames) {
      const priorTags = await getPrisma().contactTag.findMany({
        where: { contactId: id },
        include: { tag: true },
      });
      const priorTagIds = new Set(priorTags.map((t) => t.tagId));

      await getPrisma().contactTag.deleteMany({ where: { contactId: id } });
      const addedTagIds: string[] = [];
      for (const raw of body.tagNames) {
        const name = raw.trim().toLowerCase();
        if (!name) continue;
        const tag = await getPrisma().tag.upsert({
          where: {
            workspaceId_name: { workspaceId: auth.workspaceId, name },
          },
          create: { workspaceId: auth.workspaceId, name },
          update: {},
        });
        await getPrisma().contactTag.create({
          data: { tagId: tag.id, contactId: id },
        });
        if (!priorTagIds.has(tag.id)) addedTagIds.push(tag.id);
      }

      if (addedTagIds.length) {
        const { dispatchAutoReplies } = await import("@/lib/auto-replies/dispatch");
        for (const tagId of addedTagIds) {
          await dispatchAutoReplies({
            workspaceId: auth.workspaceId,
            contactId: id,
            triggerType: "tag_added",
            tagId,
          }).catch(() => undefined);
        }
        const { triggerDripCampaigns } = await import("@/lib/drip-campaigns/engine");
        for (const tagId of addedTagIds) {
          await triggerDripCampaigns({
            workspaceId: auth.workspaceId,
            contactId: id,
            triggerType: "tag_added",
            tagId,
          }).catch(() => undefined);
        }
      }
    }

    if (body.listIds !== undefined) {
      const validListIds = await filterWorkspaceListIds(auth.workspaceId, body.listIds);
      const priorLists = await getPrisma().contactListMember.findMany({
        where: { contactId: id },
        select: { listId: true },
      });
      const priorListIds = new Set(priorLists.map((l) => l.listId));

      await getPrisma().contactListMember.deleteMany({ where: { contactId: id } });
      const addedListIds: string[] = [];
      for (const listId of validListIds) {
        await getPrisma().contactListMember.create({
          data: { listId, contactId: id },
        }).catch(() => null);
        if (!priorListIds.has(listId)) addedListIds.push(listId);
      }

      if (addedListIds.length) {
        const { dispatchAutoReplies } = await import("@/lib/auto-replies/dispatch");
        for (const listId of addedListIds) {
          await dispatchAutoReplies({
            workspaceId: auth.workspaceId,
            contactId: id,
            triggerType: "list_join",
            listId,
          }).catch(() => undefined);
        }
        const { triggerDripCampaigns } = await import("@/lib/drip-campaigns/engine");
        for (const listId of addedListIds) {
          await triggerDripCampaigns({
            workspaceId: auth.workspaceId,
            contactId: id,
            triggerType: "list_join",
            listId,
          }).catch(() => undefined);
        }
      }
    } else {
      if (body.addListIds?.length) {
        await assignContactToLists(auth.workspaceId, id, body.addListIds);
      }
      if (body.removeListIds?.length) {
        const validRemove = await filterWorkspaceListIds(auth.workspaceId, body.removeListIds);
        for (const listId of validRemove) {
          await getPrisma().contactListMember.deleteMany({
            where: { listId, contactId: id },
          });
        }
      }
    }

    try {
      const { publishContactEvent } = await import("@/lib/crm/events");
      await publishContactEvent({
        workspaceId: auth.workspaceId,
        contactId: id,
        type: "contact.updated",
        payload: {
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          company: body.company,
          tags: body.tagNames,
        },
      });
    } catch {
      // CRM push is optional
    }

    try {
      const { emitAutomationEvent } = await import("@/lib/automations/events");
      const { resumeEventWaitsOnFieldChange } = await import(
        "@/lib/automations/parity/event-waits"
      );
      const updated = await getPrisma().contact.findUnique({ where: { id } });
      const fields: Array<{ field: string; prev: unknown; next: unknown }> = [
        { field: "firstName", prev: existing.firstName, next: body.firstName },
        { field: "lastName", prev: existing.lastName, next: body.lastName },
        { field: "email", prev: existing.email, next: body.email },
        { field: "company", prev: existing.company, next: body.company },
        { field: "status", prev: existing.status, next: body.status },
      ];
      for (const f of fields) {
        if (f.next === undefined) continue;
        if (String(f.prev ?? "") === String(f.next ?? "")) continue;
        await emitAutomationEvent(auth.workspaceId, "customer.field_changed", id, {
          field: f.field,
          previousValue: f.prev != null ? String(f.prev) : "",
          newValue: f.next != null ? String(f.next) : "",
        });
        if (updated) {
          await resumeEventWaitsOnFieldChange({
            workspaceId: auth.workspaceId,
            contactId: id,
            field: f.field,
            contact: {
              ...(updated as unknown as Record<string, unknown>),
              [f.field]: f.next,
            },
          });
        }
      }
    } catch {
      /* non-fatal */
    }

    const data = await loadContactById(auth.workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const existing = await getPrisma().contact.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
