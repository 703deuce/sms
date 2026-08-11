import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getPrisma } from "@/lib/db";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import Link from "next/link";

export default async function RealtorAppointmentsPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const prisma = getPrisma();
  const appointments = await prisma.voiceAppointment.findMany({
    where: { workspaceId },
    orderBy: { startsAt: "asc" },
    take: 50,
    select: {
      id: true,
      serviceName: true,
      startsAt: true,
      contactId: true,
      contact: { select: { firstName: true, lastName: true, phone: true } },
    },
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Appointments" description="Every appointment links back to a lead." />
      <Card className="divide-y">
        {appointments.map((appt: (typeof appointments)[number]) => {
          const name = [appt.contact?.firstName, appt.contact?.lastName].filter(Boolean).join(" ") || "Guest";
          return (
            <div key={appt.id} className="flex items-center justify-between p-4">
              <div>
                <CardTitle className="text-base">
                  {appt.startsAt.toLocaleString()} — {appt.serviceName || "Consultation"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{name}</p>
              </div>
              {appt.contactId ? (
                <Link href={`/realtor/leads/${appt.contactId}`} className="text-sm font-medium text-primary">
                  View Lead
                </Link>
              ) : null}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
