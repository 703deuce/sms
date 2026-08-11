import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveWorkspaceId } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import { formatPhone } from "@/lib/utils";
import { ClickToCallButton } from "@/components/contacts/click-to-call-button";
import Link from "next/link";
import { notFound } from "next/navigation";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function RealtorLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRealtorOnboardingComplete();
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await params;
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId },
  });
  if (!contact) notFound();

  const calls = await prisma.voiceCall.findMany({
    where: { workspaceId, contactId: id },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      direction: true,
      outcome: true,
      startedAt: true,
      durationSeconds: true,
      metadata: true,
    },
  });

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown";
  const latestMeta = asRecord(calls[0]?.metadata);
  const reState = asRecord(latestMeta.realEstateCallState);
  const fields = asRecord(reState.collectedFields) as Record<string, string>;

  return (
    <div className="space-y-6 p-6">
      <Link href="/realtor/leads" className="text-sm text-primary">
        ← Back to Leads
      </Link>
      <PageHeader
        title={name}
        description={`${reState.primaryIntent || "Lead"} · ${contact.consentSource || "Direct"}`}
      />
      <div className="flex flex-wrap gap-2">
        <ClickToCallButton phone={contact.phone} />
        <Link href={`/inbox?contact=${contact.id}`} className="inline-flex h-8 items-center rounded-md border px-3 text-xs">
          Text
        </Link>
        <Link href="/realtor/test" className="inline-flex h-8 items-center rounded-md border px-3 text-xs">
          Have Amy Call
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <CardTitle className="mb-3">Overview</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{formatPhone(contact.phone)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{contact.email || "—"}</dd>
            </div>
            {Object.entries(fields).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-4">
          <CardTitle className="mb-3">Timeline</CardTitle>
          <ul className="space-y-3 text-sm">
            {calls.length ? (
              calls.map((call: (typeof calls)[number]) => (
                <li key={call.id} className="border-b pb-2 last:border-0">
                  <Link href={`/phone/calls/${call.id}`} className="font-medium text-primary">
                    {call.direction === "INBOUND" ? "Inbound" : "Outbound"} call
                  </Link>
                  <p className="text-muted-foreground">
                    {call.startedAt?.toLocaleString()} · {call.outcome || "completed"}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No activity yet.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
