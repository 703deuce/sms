import "server-only";

import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import { getMerchantConnection } from "@/lib/merchant-payments/connection-store";
import { refreshStripeConnectAccount } from "@/lib/merchant-payments/stripe-connect";

type ContactPaymentMeta = {
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
};

function readPaymentMeta(customFields: unknown): ContactPaymentMeta {
  if (!customFields || typeof customFields !== "object") return {};
  const payment = (customFields as { payment?: ContactPaymentMeta }).payment;
  return payment || {};
}

async function writePaymentMeta(contactId: string, patch: Partial<ContactPaymentMeta>) {
  const prisma = getPrisma();
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");
  const current = (contact.customFields || {}) as Record<string, unknown>;
  const payment = { ...readPaymentMeta(current), ...patch };
  await prisma.contact.update({
    where: { id: contactId },
    data: { customFields: { ...current, payment } as object },
  });
  return payment;
}

export async function getOrCreateStripeCustomerForContact(
  workspaceId: string,
  contactId: string,
  email?: string,
) {
  const prisma = getPrisma();
  const contact = await prisma.contact.findUnique({ where: { id: contactId, workspaceId } });
  if (!contact) throw new Error("Contact not found");

  const meta = readPaymentMeta(contact.customFields);
  if (meta.stripeCustomerId) return meta.stripeCustomerId;

  const connection = await getMerchantConnection(workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) throw new Error("Stripe is not connected");

  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const customer = await stripe.customers.create(
    {
      email: email || contact.email || undefined,
      phone: contact.phone,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || undefined,
      metadata: { workspaceId, contactId },
    },
    { stripeAccount: connection.merchantAccountId },
  );

  await writePaymentMeta(contactId, { stripeCustomerId: customer.id });
  return customer.id;
}

export async function createSavedCardSetupIntent(input: {
  workspaceId: string;
  contactId: string;
  customerEmail?: string;
}) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const connection = await getMerchantConnection(input.workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) throw new Error("Stripe is not connected");
  const refreshed = await refreshStripeConnectAccount(input.workspaceId, connection);
  if (!refreshed.chargesEnabled) throw new Error("Stripe account cannot accept payments yet");

  const customerId = await getOrCreateStripeCustomerForContact(
    input.workspaceId,
    input.contactId,
    input.customerEmail,
  );

  const intent = await stripe.setupIntents.create(
    {
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
      },
    },
    { stripeAccount: refreshed.merchantAccountId! },
  );

  return { clientSecret: intent.client_secret, setupIntentId: intent.id, customerId };
}

export async function attachSavedPaymentMethod(input: {
  workspaceId: string;
  contactId: string;
  paymentMethodId: string;
}) {
  const prisma = getPrisma();
  const contact = await prisma.contact.findUnique({
    where: { id: input.contactId, workspaceId: input.workspaceId },
  });
  if (!contact) throw new Error("Contact not found");

  const meta = readPaymentMeta(contact.customFields);
  if (!meta.stripeCustomerId) throw new Error("No Stripe customer on file");

  const connection = await getMerchantConnection(input.workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) throw new Error("Stripe is not connected");

  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  await stripe.paymentMethods.attach(
    input.paymentMethodId,
    { customer: meta.stripeCustomerId },
    { stripeAccount: connection.merchantAccountId },
  );

  await stripe.customers.update(
    meta.stripeCustomerId,
    { invoice_settings: { default_payment_method: input.paymentMethodId } },
    { stripeAccount: connection.merchantAccountId },
  );

  await writePaymentMeta(input.contactId, { defaultPaymentMethodId: input.paymentMethodId });
  return { paymentMethodId: input.paymentMethodId };
}

export async function getSavedPaymentMethodForContact(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  const contact = await prisma.contact.findUnique({ where: { id: contactId, workspaceId } });
  if (!contact) return null;
  return readPaymentMeta(contact.customFields);
}
