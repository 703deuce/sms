import type { PrismaClient, PowerDialerDisposition } from "@prisma/client";
import { z } from "zod";

const actionSchema = z.object({
  type: z.enum([
    "tag",
    "add_to_list",
    "remove_from_list",
    "schedule_callback",
    "create_task",
    "create_deal",
    "create_appointment",
    "send_sms",
    "send_email",
    "dnc",
    "change_owner",
    "cadence_next",
    "cadence_enroll",
  ]),
  tagId: z.string().optional(),
  tagName: z.string().optional(),
  listId: z.string().optional(),
  cadenceId: z.string().optional(),
  templateId: z.string().optional(),
  body: z.string().optional(),
  subject: z.string().optional(),
  ownerUserId: z.string().optional(),
  callbackMinutes: z.number().optional(),
  taskTitle: z.string().optional(),
});

export type DispositionAction = z.infer<typeof actionSchema>;

export function parseDispositionActions(def: PowerDialerDisposition | null | undefined): DispositionAction[] {
  const raw = def?.actionsJson;
  if (!Array.isArray(raw)) return [];
  const out: DispositionAction[] = [];
  for (const item of raw) {
    const parsed = actionSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export type ActionRunResult = { type: string; ok: boolean; message: string };

export async function runDispositionActions(
  prisma: PrismaClient,
  input: {
    workspaceId: string;
    campaignId: string;
    contactId: string;
    attemptId: string;
    disposition: PowerDialerDisposition | null | undefined;
    notes?: string;
    assignedUserId?: string | null;
    callbackAt?: Date | null;
    timezone?: string;
  },
): Promise<ActionRunResult[]> {
  const actions = parseDispositionActions(input.disposition);
  const results: ActionRunResult[] = [];

  for (const action of actions) {
    try {
      if (action.type === "tag" && (action.tagId || action.tagName)) {
        const tag = action.tagId
          ? await prisma.tag.findFirst({
              where: { id: action.tagId, workspaceId: input.workspaceId },
            })
          : await prisma.tag.findFirst({
              where: { workspaceId: input.workspaceId, name: action.tagName || "" },
            });
        if (!tag) {
          results.push({ type: action.type, ok: false, message: "Tag not found" });
          continue;
        }
        const existingTag = await prisma.contactTag.findFirst({
          where: { contactId: input.contactId, tagId: tag.id },
        });
        if (!existingTag) {
          await prisma.contactTag.create({
            data: { contactId: input.contactId, tagId: tag.id },
          });
        }
        results.push({ type: action.type, ok: true, message: `Tagged ${tag.name}` });
        continue;
      }

      if (action.type === "add_to_list" && action.listId) {
        const member = await prisma.contactListMember.findFirst({
          where: { listId: action.listId, contactId: input.contactId },
        });
        if (!member) {
          await prisma.contactListMember.create({
            data: { listId: action.listId, contactId: input.contactId },
          });
        }
        results.push({ type: action.type, ok: true, message: "Added to list" });
        continue;
      }

      if (action.type === "remove_from_list" && action.listId) {
        await prisma.contactListMember.deleteMany({
          where: { listId: action.listId, contactId: input.contactId },
        });
        results.push({ type: action.type, ok: true, message: "Removed from list" });
        continue;
      }

      if (action.type === "schedule_callback") {
        const at =
          input.callbackAt ||
          new Date(Date.now() + (action.callbackMinutes ?? 60) * 60 * 1000);
        const { upsertCallbackFromDisposition } = await import("./callbacks-service");
        await upsertCallbackFromDisposition({
          workspaceId: input.workspaceId,
          campaignId: input.campaignId,
          contactId: input.contactId,
          attemptId: input.attemptId,
          scheduledAt: at,
          timezone: input.timezone || "America/Chicago",
          notes: input.notes,
          disposition: input.disposition?.label,
          assignedUserId: input.assignedUserId || action.ownerUserId,
          visibility: "personal",
          priority: 1,
          source: "disposition",
        });
        results.push({ type: action.type, ok: true, message: "Callback scheduled" });
        continue;
      }

      if (action.type === "dnc") {
        await prisma.contact.updateMany({
          where: { id: input.contactId, workspaceId: input.workspaceId },
          data: { status: "BLOCKED" },
        });
        results.push({ type: action.type, ok: true, message: "Contact marked DNC" });
        continue;
      }

      if (action.type === "change_owner" && action.ownerUserId) {
        await prisma.contact.update({
          where: { id: input.contactId },
          data: { assignedUserId: action.ownerUserId },
        });
        results.push({ type: action.type, ok: true, message: "Owner updated" });
        continue;
      }

      if (action.type === "create_task" && action.taskTitle) {
        await prisma.crmTask.create({
          data: {
            workspaceId: input.workspaceId,
            contactId: input.contactId,
            title: action.taskTitle,
            status: "open",
            assigneeUserId: input.assignedUserId || action.ownerUserId || null,
          },
        });
        results.push({ type: action.type, ok: true, message: "Task created" });
        continue;
      }

      if (action.type === "send_sms") {
        const { sendDispositionSms } = await import("./disposition-messaging");
        const r = await sendDispositionSms({
          workspaceId: input.workspaceId,
          contactId: input.contactId,
          body: action.body || "",
          templateId: action.templateId,
        });
        results.push({ type: action.type, ok: r.ok, message: r.message });
        continue;
      }

      if (action.type === "send_email") {
        const { sendDispositionEmail } = await import("./disposition-messaging");
        const r = await sendDispositionEmail({
          workspaceId: input.workspaceId,
          contactId: input.contactId,
          subject: action.subject || "Follow up",
          body: action.body || "",
          templateId: action.templateId,
        });
        results.push({ type: action.type, ok: r.ok, message: r.message });
        continue;
      }

      if (action.type === "cadence_enroll" && action.cadenceId) {
        const { enrollContactInCadence } = await import("./cadence-engine");
        await enrollContactInCadence(input.workspaceId, action.cadenceId, input.contactId);
        results.push({ type: action.type, ok: true, message: "Enrolled in cadence" });
        continue;
      }

      if (action.type === "cadence_next") {
        const { advanceCadenceForContact } = await import("./cadence-engine");
        const r = await advanceCadenceForContact(input.workspaceId, input.contactId);
        results.push({
          type: action.type,
          ok: r.ok,
          message: r.message,
        });
        continue;
      }

      results.push({ type: action.type, ok: false, message: "Action missing required fields" });
    } catch (err) {
      results.push({
        type: action.type,
        ok: false,
        message: err instanceof Error ? err.message : "Action failed",
      });
    }
  }

  if (input.disposition?.triggerFollowUp) {
    const follow = actions.length
      ? results
      : [{ type: "triggerFollowUp", ok: true, message: "Legacy follow-up flag set" }];
    return follow;
  }

  return results;
}
