import {
  listGiftCertificateProducts,
  upsertGiftCertificateProduct,
  issueGiftCertificate,
  listIssuedGiftCertificates,
  getGiftCertificateLedgerHistory,
  duplicateGiftCertificateProduct,
} from "@/lib/appointments/service-booking/gift-certificates";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const issued = searchParams.get("issued");
  const balanceId = searchParams.get("balanceId");
  const ledger = searchParams.get("ledger");

  if (balanceId && ledger === "1") {
    return withAppointmentsAuth("appointments.read", async () =>
      getGiftCertificateLedgerHistory(balanceId),
    );
  }

  if (issued === "1") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      listIssuedGiftCertificates(workspaceId),
    );
  }

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listGiftCertificateProducts(workspaceId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.action === "issue") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      issueGiftCertificate(workspaceId, body),
    );
  }

  if (body.action === "duplicate") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      duplicateGiftCertificateProduct(workspaceId, body.productId),
    );
  }

  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
    upsertGiftCertificateProduct(workspaceId, body),
  );
}
