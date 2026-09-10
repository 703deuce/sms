import {
  listGiftCertificateProducts,
  upsertGiftCertificateProduct,
  issueGiftCertificate,
  listIssuedGiftCertificateBalances,
  lookupGiftCertificateByCode,
  getGiftCertificateLedger,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const code = url.searchParams.get("code");
  const balanceId = url.searchParams.get("balanceId");
  const q = url.searchParams.get("q");

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (action === "issued") return listIssuedGiftCertificateBalances(workspaceId, q || undefined);
    if (action === "lookup" && code) return lookupGiftCertificateByCode(workspaceId, code);
    if (action === "ledger" && balanceId) return getGiftCertificateLedger(balanceId);
    return listGiftCertificateProducts(workspaceId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "issue") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      issueGiftCertificate(workspaceId, body),
    );
  }
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
    upsertGiftCertificateProduct(workspaceId, body),
  );
}
