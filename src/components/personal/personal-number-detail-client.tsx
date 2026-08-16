"use client";

import { MoveToBusinessClient } from "@/components/personal/personal-pages";
import { PersonalParkButton } from "@/components/personal/personal-action-buttons";
import { Button } from "@/components/ui/button";
import type { PersonalNumberRow, PersonalNumberStats } from "@/lib/workspace/personal-data";
import { PERSONAL_VERIFICATION_WARNING } from "@/lib/numbers/personal-call-settings";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PersonalNumberDetailClient({
  number,
  stats,
  acquisition,
  businesses,
}: {
  number: PersonalNumberRow;
  stats: PersonalNumberStats;
  acquisition: string;
  businesses: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [portMessage, setPortMessage] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const accountNumber =
    number.portOutAccountNumber || number.number.replace(/\D/g, "").slice(-10);
  const portPin = number.portOutPin || "Request unlock to reveal";

  async function togglePortLock() {
    setUnlocking(true);
    setPortMessage(null);
    try {
      const res = await fetch(`/api/numbers/${number.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalCallSettings: {
            portOutLocked: !number.portOutLocked,
          },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not update port-out lock.");
      setPortMessage(number.portOutLocked ? "Number unlocked for port-out." : "Number locked.");
      router.refresh();
    } catch (e) {
      setPortMessage(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="surface rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{formatPhone(number.number)}</h2>
            {number.friendlyName ? (
              <p className="text-sm font-medium text-primary">{number.friendlyName}</p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">
              Status: {number.serviceLabel} · {number.status}
            </p>
            <p className="text-sm text-muted-foreground">Acquisition: {acquisition}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/personal/forwarding?numberId=${number.id}`}>
              <Button size="sm">Forward</Button>
            </Link>
            <Link href={`/personal/voicemail?numberId=${number.id}`}>
              <Button size="sm" variant="outline">Voicemail</Button>
            </Link>
            <PersonalParkButton numberId={number.id} label="Vault" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Usage"
          value={`${stats.forwardingMinutes} min`}
          sub="forwarded this period"
          href={`/personal/usage`}
        />
        <StatTile
          label="Calls"
          value={String(stats.callsThisMonth)}
          sub="this month"
          href={`/personal/activity?numberId=${number.id}`}
        />
        <StatTile
          label="Voicemails"
          value={String(stats.voicemailsUnread)}
          sub="unread"
          href={`/personal/voicemail?numberId=${number.id}`}
        />
      </div>

      <section className="surface rounded-xl border border-amber-100 bg-amber-50/50 p-5">
        <h3 className="text-sm font-semibold text-amber-900">Verification codes</h3>
        <p className="mt-2 text-sm text-amber-900/80">{PERSONAL_VERIFICATION_WARNING}</p>
      </section>

      <section className="surface rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold">Transfer number out</h3>
        <p className="text-sm text-muted-foreground">
          Your number stays yours. Use these credentials with your new carrier — no support ticket
          required.
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Account number</dt>
            <dd className="font-mono font-medium">{accountNumber}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Port-out PIN</dt>
            <dd className="font-mono font-medium">{portPin}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lock status</dt>
            <dd>{number.portOutLocked ? "Locked" : "Unlocked for port-out"}</dd>
          </div>
        </dl>
        <Button size="sm" variant="outline" onClick={togglePortLock} disabled={unlocking}>
          {number.portOutLocked ? "Unlock for port-out" : "Lock number"}
        </Button>
        {portMessage ? <p className="text-xs text-muted-foreground">{portMessage}</p> : null}
        <p className="text-xs text-muted-foreground">
          <Link href="/personal/porting?tab=out" className="text-primary">Porting center</Link>
        </p>
      </section>

      {number.voiceForwardTo ? (
        <section className="surface rounded-xl p-5">
          <h3 className="text-sm font-semibold">Forwarding</h3>
          <p className="text-sm text-muted-foreground">
            Forwarding to {formatPhone(number.voiceForwardTo)}
            {number.forwardTargets.length > 1
              ? ` (+${number.forwardTargets.length - 1} more)`
              : ""}
          </p>
        </section>
      ) : null}

      <section className="surface rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold">Move to Business</h3>
        <p className="text-sm text-muted-foreground">
          Reassign this number to a business workspace on your account.
        </p>
        {businesses.length > 0 ? (
          <MoveToBusinessClient numberId={number.id} businesses={businesses} />
        ) : (
          <p className="text-xs text-muted-foreground">No business workspaces on this account.</p>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="surface block rounded-xl p-4 transition hover:border-primary/30"
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Link>
  );
}
