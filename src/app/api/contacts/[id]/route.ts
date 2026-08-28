import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { loadContactById } from "@/lib/workspace-data";

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
      status?: string;
      assignedUser?: string | null;
      company?: string;
      tagNames?: string[];
      listIds?: string[];
    };

    const existing = await getPrisma().contact.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await getPrisma().contact.update({
      where: { id },
      data: {
        firstName: body.firstName ?? undefined,
        lastName: body.lastName ?? undefined,
        email: body.email ?? undefined,
        status: body.status
          ? (body.status.toUpperCase() as
              | "SUBSCRIBED"
              | "UNSUBSCRIBED"
              | "BLOCKED"
              | "INVALID")
          : undefined,
        assignedUser: body.assignedUser === undefined ? undefined : body.assignedUser,
        company: body.company ?? undefined,
      },
    });

    if (body.tagNames) {
      await getPrisma().contactTag.deleteMany({ where: { contactId: id } });
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
      }
    }

    if (body.listIds) {
      await getPrisma().contactListMember.deleteMany({ where: { contactId: id } });
      for (const listId of body.listIds) {
        await getPrisma().contactListMember.create({
          data: { listId, contactId: id },
        }).catch(() => null);
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
