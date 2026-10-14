import { z } from "zod";

const reviewSendBase = {
  businessId: z.string().min(1),
  customerName: z.string().min(1).max(200),
  serviceType: z.string().max(200).optional(),
  templateId: z.string().uuid().optional(),
  customMessage: z.string().max(2000).optional(),
};

export const sendReviewSmsSchema = z.object({
  ...reviewSendBase,
  customerPhone: z.string().min(7).max(32),
});

export const sendReviewEmailSchema = z.object({
  ...reviewSendBase,
  customerEmail: z.string().email().max(320),
});
