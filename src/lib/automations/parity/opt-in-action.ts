import { getPrisma } from "@/lib/db";
import type { AutomationCanvasNode, AutomationDefinition } from "../types";
import { outcomeResult } from "./resolve-outcome";

type ContactStatus = "SUBSCRIBED" | "UNSUBSCRIBED" | "BLOCKED" | "INVALID";

const ALLOWED_TARGETS: ContactStatus[] = [
  "SUBSCRIBED",
  "UNSUBSCRIBED",
  "BLOCKED",
  "INVALID",
];

/**
 * Update contact opt-in status with compliance guardrails.
 * Never manufactures consent — SUBSCRIBED requires existing consent evidence.
 */
export async function runSetContactOptInStatus(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  contactId: string,
  workspaceId: string,
) {
  const prisma = getPrisma();
  const target = String(node.data.config?.targetStatus || "").toUpperCase() as ContactStatus;
  if (!ALLOWED_TARGETS.includes(target)) {
    return outcomeResult(def, node.id, "failed", { error: "invalid_status" });
  }

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
  });
  if (!contact) {
    return outcomeResult(def, node.id, "failed", { error: "contact_not_found" });
  }

  if (contact.status === target) {
    return outcomeResult(def, node.id, "updated", { status: target, unchanged: true });
  }

  // More permissive transitions require consent evidence.
  if (target === "SUBSCRIBED") {
    const hasConsent =
      Boolean(contact.consentDate) ||
      Boolean(contact.consentSource?.trim()) ||
      (await prisma.suppression.findFirst({
        where: {
          workspaceId,
          phone: contact.phone,
          reason: { in: ["OPT_IN", "START", "KEYWORD"] },
        },
      })) !== null;

    if (!hasConsent) {
      return outcomeResult(def, node.id, "no_consent_evidence");
    }
  }

  // Blocked contacts cannot be re-subscribed via workflow.
  if (contact.status === "BLOCKED" && target === "SUBSCRIBED") {
    return outcomeResult(def, node.id, "not_allowed", { reason: "blocked_contact" });
  }

  await prisma.contact.update({
    where: { id: contactId },
    data: { status: target },
  });

  if (target === "UNSUBSCRIBED" || target === "BLOCKED") {
    try {
      const suppressionKey = `${workspaceId}:p:${contact.phone}`;
      await prisma.suppression.upsert({
        where: { suppressionKey },
        create: {
          workspaceId,
          phone: contact.phone,
          suppressionKey,
          reason: target === "BLOCKED" ? "BLOCKED" : "UNSUBSCRIBED",
          source: "automation",
        },
        update: {
          reason: target === "BLOCKED" ? "BLOCKED" : "UNSUBSCRIBED",
          source: "automation",
        },
      });
    } catch {
      /* non-fatal */
    }
  }

  return outcomeResult(def, node.id, "updated", {
    status: target,
    previousStatus: contact.status,
  });
}

export async function runDeleteContact(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  contactId: string,
  workspaceId: string,
  testMode: boolean,
) {
  if (!node.data.config?.confirm) {
    return outcomeResult(def, node.id, "failed", { error: "confirmation_required" });
  }
  if (testMode) {
    return outcomeResult(def, node.id, "deleted", { test: true });
  }

  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
  });
  if (!contact) {
    return outcomeResult(def, node.id, "not_found");
  }

  await prisma.contactListMember.deleteMany({ where: { contactId } });
  await prisma.contactTag.deleteMany({ where: { contactId } });
  await prisma.contact.delete({ where: { id: contactId } });

  return outcomeResult(def, node.id, "deleted", {
    reason: String(node.data.config?.reason || ""),
  });
}
