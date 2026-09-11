import { getPrisma } from "@/lib/db";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const prisma = getPrisma();
    const row = await prisma.intakeFormResponse.findFirst({
      where: { id, workspaceId },
    });
    if (!row) throw new Error("Submission not found");
    return {
      id: row.id,
      formId: row.formId,
      answers: row.answers,
      formVersion: row.formVersion,
      appointmentId: row.appointmentId,
      contactId: row.contactId,
      createdAt: row.createdAt.toISOString(),
    };
  });
}
