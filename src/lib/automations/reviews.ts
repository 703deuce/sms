import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { markFactsForContact } from "./metadata";
import { emitAutomationEvent } from "./events";

export type RecordReviewInput = {
  rating?: number;
  positive?: boolean;
  negative?: boolean;
  source?: string;
};

/**
 * Record a review for a contact (no dedicated review table — persisted on contact customFields).
 * Updates execution facts, emits automation trigger events, and enrolls matching flows.
 */
export async function recordContactReview(
  workspaceId: string,
  contactId: string,
  input: RecordReviewInput = {},
) {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
  });
  if (!contact) throw new Error("Contact not found");

  const rating = input.rating;
  const positive =
    input.positive ?? (rating !== undefined && rating >= 4);
  const negative =
    input.negative ?? (rating !== undefined && rating <= 2);

  const existing =
    contact.customFields && typeof contact.customFields === "object"
      ? (contact.customFields as Record<string, unknown>)
      : {};

  const customFields: Record<string, unknown> = {
    ...existing,
    review_received: true,
    review_received_at: new Date().toISOString(),
    ...(rating !== undefined && { review_rating: rating }),
    ...(positive && { positive_review: true }),
    ...(negative && { negative_feedback: true }),
    ...(input.source && { review_source: input.source }),
  };

  await prisma.contact.update({
    where: { id: contactId },
    data: { customFields: customFields as Prisma.InputJsonValue },
  });

  await markFactsForContact(workspaceId, contactId, {
    review_received: true,
    positive_review: positive,
    negative_feedback: negative,
  });

  const enrollments = await emitAutomationEvent(workspaceId, "review.received", contactId);
  if (positive) {
    await emitAutomationEvent(workspaceId, "review.positive", contactId);
  }
  if (negative) {
    await emitAutomationEvent(workspaceId, "feedback.negative", contactId);
  }

  return { contactId, positive, negative, enrollments };
}
