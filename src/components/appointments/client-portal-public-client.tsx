"use client";

import { useEffect, useMemo, useState } from "react";

type AppointmentRow = {
  id: string;
  serviceName?: string | null;
  startsAt?: string;
  status?: string;
  metadata?: { manageAppointmentUrl?: string };
};

type PackageBalance = {
  id: string;
  product?: { name?: string };
  remainingCredits?: Record<string, number>;
  expiresAt?: string | null;
};

type GiftBalance = {
  id: string;
  code?: string;
  balanceCents?: number;
};

type Membership = {
  id: string;
  status?: string;
  product?: { name?: string; billingInterval?: string };
};

type LedgerEntry = {
  id?: string;
  kind?: string;
  delta?: number;
  note?: string;
  createdAt?: string;
  productName?: string;
};

type PortalData = {
  workspaceSlug?: string;
  appointments: AppointmentRow[];
  entitlements: {
    packages?: PackageBalance[];
    gifts?: GiftBalance[];
    memberships?: Membership[];
  };
  packageUsageHistory?: LedgerEntry[];
  packagePurchaseHistory?: LedgerEntry[];
  paymentHistory?: Array<{
    id: string;
    amountCents?: number;
    status?: string;
    createdAt?: string;
    description?: string;
    provider?: string;
    appointmentId?: string;
  }>;
  waitlist?: Array<{ id: string; serviceName?: string; status?: string }>;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function ClientPortalPublicClient({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedCard, setHasSavedCard] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [walletBalanceCents, setWalletBalanceCents] = useState<number | null>(null);

  useEffect(() => {
    void fetch(`/api/public/portal/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Invalid portal link");
        const resolved = json.data;
        setData({
          workspaceSlug: resolved.workspaceSlug,
          appointments: resolved.appointments || [],
          entitlements: resolved.entitlements || {},
          packageUsageHistory: resolved.packageUsageHistory || [],
          packagePurchaseHistory: resolved.packagePurchaseHistory || [],
          paymentHistory: resolved.paymentHistory || [],
          waitlist: resolved.waitlist || [],
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));

    void fetch(`/api/public/portal/${token}/payment-methods`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.ok) setHasSavedCard(Boolean(json.data?.hasSavedCard));
      })
      .catch(() => undefined);

    void fetch(`/api/public/portal/${token}/wallet`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.ok) setWalletBalanceCents(Number(json.data?.balanceCents ?? 0));
      })
      .catch(() => undefined);
  }, [token]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (data?.appointments || [])
      .filter((a) => a.startsAt && new Date(a.startsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime());
  }, [data]);

  const past = useMemo(() => {
    const now = Date.now();
    return (data?.appointments || [])
      .filter((a) => a.startsAt && new Date(a.startsAt).getTime() < now)
      .sort((a, b) => new Date(b.startsAt!).getTime() - new Date(a.startsAt!).getTime())
      .slice(0, 10);
  }, [data]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Client portal</h1>
        <p className="mt-4 text-sm text-destructive">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      </main>
    );
  }

  const bookHref = data.workspaceSlug ? `/book/${encodeURIComponent(data.workspaceSlug)}` : "/book";
  const storeHref = data.workspaceSlug
    ? `/book/${encodeURIComponent(data.workspaceSlug)}/store`
    : "/book";

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">Your account</h1>
        <p className="text-sm text-muted-foreground">
          Appointments, packages, memberships, and gift balances in one place.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={bookHref}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Book again
          </a>
          <a href={storeHref} className="rounded-md border px-4 py-2 text-sm">
            Buy packages or memberships
          </a>
        </div>
      </header>

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-lg font-medium">Upcoming appointments</h2>
        <ul className="mt-3 divide-y rounded-lg border">
          {upcoming.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No upcoming appointments.</li>
          ) : (
            upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{a.serviceName || "Appointment"}</p>
                  <p className="text-muted-foreground">{formatDate(a.startsAt)}</p>
                </div>
                {a.metadata?.manageAppointmentUrl ? (
                  <a href={a.metadata.manageAppointmentUrl} className="text-sm underline">
                    Manage
                  </a>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-labelledby="wallet-heading">
        <h2 id="wallet-heading" className="text-lg font-medium">Client wallet</h2>
        <div className="mt-3 rounded-lg border p-4 text-sm">
          {walletBalanceCents != null ? (
            <p className="text-muted-foreground">
              Available balance: <span className="font-medium text-foreground">{formatMoney(walletBalanceCents)}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">Wallet balance unavailable.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="payment-heading">
        <h2 id="payment-heading" className="text-lg font-medium">Payment methods</h2>
        <div className="mt-3 rounded-lg border p-4 text-sm">
          {hasSavedCard ? (
            <p className="text-muted-foreground">A card is saved for faster checkout on your next booking.</p>
          ) : (
            <p className="text-muted-foreground">
              No card on file yet. Save a card during your next paid booking, or ask the business to send a
              payment link from your appointment.
            </p>
          )}
          {paymentMessage ? <p className="mt-2 text-primary">{paymentMessage}</p> : null}
        </div>
      </section>

      <section aria-labelledby="packages-heading">
        <h2 id="packages-heading" className="text-lg font-medium">Packages</h2>
        <ul className="mt-3 divide-y rounded-lg border">
          {(data.entitlements.packages || []).length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No active packages.</li>
          ) : (
            data.entitlements.packages!.map((pkg) => {
              const credits = pkg.remainingCredits || {};
              const total = Object.values(credits).reduce((sum, n) => sum + n, 0);
              return (
                <li key={pkg.id} className="p-4 text-sm">
                  <p className="font-medium">{pkg.product?.name || "Package"}</p>
                  <p className="text-muted-foreground">{total} credits remaining</p>
                  {pkg.expiresAt ? (
                    <p className="text-muted-foreground">Expires {formatDate(pkg.expiresAt)}</p>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
        {(data.packageUsageHistory || []).length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-medium">Package usage</h3>
            <ul className="mt-2 divide-y rounded-lg border text-sm">
              {data.packageUsageHistory!.map((entry, i) => (
                <li key={entry.id || i} className="flex justify-between gap-4 p-3">
                  <span>
                    {formatDate(entry.createdAt)}
                    {entry.productName ? ` · ${entry.productName}` : ""}
                  </span>
                  <span className="text-muted-foreground capitalize">{entry.kind || "adjustment"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="payments-history-heading">
        <h2 id="payments-history-heading" className="text-lg font-medium">Payments &amp; purchases</h2>
        <ul className="mt-3 divide-y rounded-lg border">
          {(data.paymentHistory || []).length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No payment history yet.</li>
          ) : (
            data.paymentHistory!.map((p) => (
              <li key={p.id} className="flex justify-between gap-4 p-4 text-sm">
                <span>
                  {formatDate(p.createdAt)}
                  {p.provider ? ` · ${p.provider}` : ""}
                </span>
                <span className="font-medium">
                  {formatMoney(p.amountCents || 0)}
                  {p.status ? ` · ${p.status}` : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-labelledby="memberships-heading">
        <h2 id="memberships-heading" className="text-lg font-medium">Memberships</h2>
        <ul className="mt-3 divide-y rounded-lg border">
          {(data.entitlements.memberships || []).length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No active memberships.</li>
          ) : (
            data.entitlements.memberships!.map((m) => (
              <li key={m.id} className="p-4 text-sm">
                <p className="font-medium">{m.product?.name || "Membership"}</p>
                <p className="text-muted-foreground capitalize">{m.status || "active"}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-labelledby="gifts-heading">
        <h2 id="gifts-heading" className="text-lg font-medium">Gift certificates</h2>
        <ul className="mt-3 divide-y rounded-lg border">
          {(data.entitlements.gifts || []).length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No gift balances.</li>
          ) : (
            data.entitlements.gifts!.map((g) => (
              <li key={g.id} className="p-4 text-sm">
                <p className="font-medium">{g.code || "Gift certificate"}</p>
                <p className="text-muted-foreground">{formatMoney(g.balanceCents || 0)} remaining</p>
              </li>
            ))
          )}
        </ul>
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="text-lg font-medium">Recent visits</h2>
          <ul className="mt-3 divide-y rounded-lg border">
            {past.map((a) => (
              <li key={a.id} className="flex justify-between gap-4 p-4 text-sm">
                <span>{a.serviceName || "Appointment"}</span>
                <span className="text-muted-foreground">{formatDate(a.startsAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
