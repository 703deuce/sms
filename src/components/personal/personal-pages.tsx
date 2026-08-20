"use client";

import { PersonalParkButton, KeepWithTransovoButton } from "@/components/personal/personal-action-buttons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { PersonalOverviewActivityRow, PersonalNumberRow } from "@/lib/workspace/personal-data";
import { isPortInHiddenAtLaunch } from "@/lib/workspace/platform-launch";
import { formatPhone } from "@/lib/utils";
import { ArrowRight, Phone, Sparkles, Vault } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function PersonalOverviewClient({
  numbers,
  activity,
}: {
  numbers: PersonalNumberRow[];
  activity: PersonalOverviewActivityRow[];
}) {
  if (numbers.length === 0) {
    return (
      <EmptyState
        title="You don't have a number yet"
        description="Get a new number, find a memorable premium number, or bring your existing number to Transovo."
        actionLabel="Get a Number"
        actionHref="/personal/numbers/premium"
        icon={<Phone className="h-10 w-10" />}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="surface rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Number Vault</h2>
        <div className="mt-4 divide-y divide-border">
          {numbers.slice(0, 5).map((n) => (
            <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{formatPhone(n.number)}</p>
                <p className="text-sm text-muted-foreground">{n.serviceLabel}</p>
                {n.voiceForwardTo ? (
                  <p className="text-xs text-muted-foreground">
                    Forwarding to {formatPhone(n.voiceForwardTo)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{n.status}</span>
                <Link href={`/personal/numbers/${n.id}`}>
                  <Button variant="outline" size="sm">Manage</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
        {numbers.length > 5 ? (
          <Link href="/personal/vault" className="mt-3 inline-flex text-sm font-medium text-primary">
            View all numbers <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        ) : null}
      </section>

      <section className="surface rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Quick actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/personal/numbers/find" label="Get a Number" icon={Phone} />
          <QuickAction href="/personal/numbers/premium" label="Find Premium Number" icon={Sparkles} />
          {isPortInHiddenAtLaunch() ? (
            <QuickAction href="/personal/porting?tab=out" label="Port Out Number" icon={ArrowRight} />
          ) : (
            <QuickAction href="/personal/porting" label="Port In My Number" icon={ArrowRight} />
          )}
          <QuickAction href="/personal/vault" label="Park a Number" icon={Vault} />
        </div>
      </section>

      <section className="surface rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No recent calls or changes yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {activity.map((row) => (
              <li key={row.id} className="flex justify-between gap-4 text-sm">
                <span>{row.summary}</span>
                <span className="shrink-0 text-muted-foreground">
                  {new Date(row.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Phone;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border p-4 transition hover:border-primary/40 hover:bg-muted/40"
    >
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

export function PersonalNumbersListClient({ numbers }: { numbers: PersonalNumberRow[] }) {
  if (numbers.length === 0) {
    return (
      <EmptyState
        title="You don't have a number yet"
        description="Search for a local or toll-free number, or bring your number from another carrier."
        actionLabel="Find a Number"
        actionHref="/personal/numbers/premium"
      />
    );
  }

  return (
    <div className="space-y-3">
      {numbers.map((n) => (
        <div key={n.id} className="surface flex flex-wrap items-center justify-between gap-4 rounded-xl p-4">
          <div>
            <p className="text-lg font-semibold">{formatPhone(n.number)}</p>
            <p className="text-sm text-muted-foreground">
              {n.type} · {n.serviceLabel}
            </p>
            {n.voiceForwardTo ? (
              <p className="text-xs text-muted-foreground">Forward to {formatPhone(n.voiceForwardTo)}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Voicemail: {n.voicemailEnabled ? "On" : "Off"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/personal/numbers/${n.id}`}>
              <Button size="sm">Manage</Button>
            </Link>
            <Link href={`/personal/forwarding?numberId=${n.id}`}>
              <Button size="sm" variant="outline">Forward</Button>
            </Link>
            <PersonalParkButton numberId={n.id} label="Park" />
            <Link href={`/personal/voicemail?numberId=${n.id}`}>
              <Button size="sm" variant="outline">Voicemail</Button>
            </Link>
            <Link href={`/personal/porting?tab=out`}>
              <Button size="sm" variant="outline">Port Away</Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PortAwayWindowBanner({
  number,
}: {
  number: PersonalNumberRow;
}) {
  if (number.serviceState !== "PORT_AWAY_WINDOW" || !number.portAwayExpiresAt) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <p className="font-semibold text-amber-900">Your number is ready to transfer to another provider.</p>
      <p className="mt-1 text-amber-800">
        Transfer window ends {new Date(number.portAwayExpiresAt).toLocaleDateString()}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/personal/porting?tab=out&numberId=${number.id}`}>
          <Button size="sm">Start Port Away</Button>
        </Link>
        <KeepWithTransovoButton numberId={number.id} />
      </div>
    </div>
  );
}

export function MoveToBusinessClient({
  numberId,
  businesses,
}: {
  numberId: string;
  businesses: Array<{ id: string; name: string }>;
}) {
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (businesses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a business workspace first to move this number.
        <Link href="/onboarding/add-business" className="ml-1 font-medium text-primary">Add Business</Link>
      </p>
    );
  }

  async function move() {
    if (!target) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/numbers/${numberId}/move-workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetWorkspaceId: target }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Move failed");
      setStatus(`Moved to ${json.data?.targetWorkspaceName || "business workspace"}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Move failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <select
        className="h-10 w-full max-w-sm rounded-lg border border-border px-3 text-sm"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">Select business workspace</option>
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <Button size="sm" disabled={!target || loading} onClick={move}>
        {loading ? "Moving…" : "Move to Business"}
      </Button>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}
