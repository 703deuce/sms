import {
  cancelMembershipProductSubscription,
  countMembershipSubscribers,
  deleteMembershipProduct,
  duplicateMembershipProduct,
  getMembershipCatalogStats,
  getMembershipProduct,
  listMembershipActivityForProduct,
  listMembershipProducts,
  listSubscriptionsForProduct,
  markMembershipPastDue,
  pauseMembershipProductSubscription,
  restoreMembershipSubscription,
  resumeMembershipProductSubscription,
  startMembershipSubscription,
  upsertMembershipProduct,
} from "@/lib/appointments/service-booking/memberships";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const view = url.searchParams.get("view");

  if (productId && view === "subscriptions") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      listSubscriptionsForProduct(workspaceId, productId),
    );
  }

  if (productId && view === "activity") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      listMembershipActivityForProduct(workspaceId, productId),
    );
  }

  if (productId) {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
      const row = await getMembershipProduct(workspaceId, productId);
      if (!row) throw new Error("Membership not found");
      return row;
    });
  }

  if (view === "stats") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      getMembershipCatalogStats(workspaceId),
    );
  }

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const rows = await listMembershipProducts(workspaceId);
    const counts = await countMembershipSubscribers(
      workspaceId,
      rows.map((row: { id: string }) => row.id),
    );
    return rows.map((row: { id: string }) => {
      const stats = counts.get(row.id) || { active: 0, pastDue: 0 };
      return {
        ...row,
        activeMemberCount: stats.active,
        pastDueCount: stats.pastDue,
      };
    });
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.action === "subscribe") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      startMembershipSubscription(workspaceId, body.productId, body.contactId, body.stripeSubscriptionId),
    );
  }

  if (body.action === "duplicate") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      duplicateMembershipProduct(workspaceId, body.productId),
    );
  }

  if (body.action === "delete") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      deleteMembershipProduct(workspaceId, body.productId),
    );
  }

  if (body.action === "cancel_subscription") {
    return withAppointmentsAuth("appointments.write", async () =>
      cancelMembershipProductSubscription(body.subscriptionId, body.mode || "end_of_period"),
    );
  }

  if (body.action === "pause_subscription") {
    return withAppointmentsAuth("appointments.write", async () =>
      pauseMembershipProductSubscription(body.subscriptionId, body.pausedUntil ? new Date(body.pausedUntil) : undefined),
    );
  }

  if (body.action === "resume_subscription") {
    return withAppointmentsAuth("appointments.write", async () =>
      resumeMembershipProductSubscription(body.subscriptionId),
    );
  }

  if (body.action === "mark_past_due") {
    return withAppointmentsAuth("appointments.write", async () =>
      markMembershipPastDue(body.subscriptionId),
    );
  }

  if (body.action === "restore_subscription") {
    return withAppointmentsAuth("appointments.write", async () =>
      restoreMembershipSubscription(body.subscriptionId),
    );
  }

  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertMembershipProduct(workspaceId, body),
  );
}
