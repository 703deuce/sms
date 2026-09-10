"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PortalSection = "home" | "appointments" | "products" | "payments" | "documents" | "profile";

type AppointmentRow = {
  id: string;
  serviceName?: string | null;
  startsAt?: string;
  status?: string;
  staffName?: string | null;
  locationLabel?: string | null;
  meetingLink?: string | null;
  pendingApproval?: boolean;
  metadata?: { manageAppointmentUrl?: string };
  paymentSummary?: {
    balanceDueCents?: number;
    totalPriceCents?: number;
    amountPaidCents?: number;
    paymentStatus?: string;
  };
};

type PortalData = {
  workspace?: { slug?: string; name?: string; logoUrl?: string | null };
  contact?: { firstName: string; lastName: string; email: string; phone: string };
  appointments: AppointmentRow[];
  upcomingAppointments?: AppointmentRow[];
  pastAppointments?: AppointmentRow[];
  balanceDueAppointments?: AppointmentRow[];
  entitlements: {
    packages?: Array<{
      id: string;
      product?: { name?: string };
      remainingCredits?: Record<string, number>;
      expiresAt?: string | null;
      status?: string;
    }>;
    gifts?: Array<{ id: string; code?: string; balanceCents?: number; status?: string }>;
    memberships?: Array<{
      id: string;
      status?: string;
      product?: { name?: string; billingInterval?: string };
      currentPeriodEnd?: string;
    }>;
  };
  packageUsageHistory?: Array<{
    id?: string;
    kind?: string;
    delta?: unknown;
    note?: string;
    createdAt?: string;
    productName?: string;
  }>;
  packagePurchaseHistory?: Array<{
    id?: string;
    createdAt?: string;
    productName?: string;
    delta?: unknown;
  }>;
  paymentHistory?: Array<{
    id: string;
    amountCents?: number;
    status?: string;
    createdAt?: string;
    description?: string;
    provider?: string;
    appointmentId?: string;
  }>;
  accountCreditHistory?: Array<{
    id: string;
    date: string;
    activity: string;
    amountCents: number;
    balanceCents: number;
  }>;
  giftRedemptionHistory?: Array<{
    id: string;
    date: string;
    activity: string;
    amountCents: number;
    maskedCode?: string;
  }>;
  invoices?: Array<{
    id: string;
    status: string;
    totalCents: number;
    balanceDueCents: number;
    createdAt: string;
    dueAt?: string | null;
  }>;
  outstandingInvoices?: Array<{
    id: string;
    balanceDueCents: number;
    dueAt?: string | null;
  }>;
  documents?: Array<{
    id: string;
    kind: string;
    title: string;
    appointmentId: string;
    serviceName?: string | null;
    date: string;
    status: string;
    detail?: string;
  }>;
  waitlist?: Array<{ id: string; serviceName?: string; status?: string }>;
  household?: {
    id: string;
    name?: string | null;
    members: Array<{ id: string; displayName?: string | null; role?: string | null }>;
  } | null;
  workspaceSlug?: string;
};

type PaymentMethodInfo = {
  hasSavedCard: boolean;
  card?: { brand?: string; last4?: string; expMonth?: number; expYear?: number } | null;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isWorkspaceSlugToken(token: string) {
  return token.length < 48 && /[a-z]/i.test(token) && !/^[a-f0-9]{32,}$/i.test(token);
}

function packageCreditsTotal(credits?: Record<string, number>) {
  return Object.values(credits || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

function membershipStatusLabel(status?: string) {
  switch (status) {
    case "active":
      return "Active";
    case "past_due":
      return "Past due";
    case "paused":
      return "Paused";
    case "canceled":
      return "Canceled";
    case "cancellation_scheduled":
      return "Cancellation scheduled";
    default:
      return status ? status.replace(/_/g, " ") : "Active";
  }
}

const NAV: Array<{ id: PortalSection; label: string }> = [
  { id: "home", label: "Home" },
  { id: "appointments", label: "Appointments" },
  { id: "products", label: "Packages & Memberships" },
  { id: "payments", label: "Payments & Credit" },
  { id: "documents", label: "Documents" },
  { id: "profile", label: "Profile" },
];

function PortalSlugLogin({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setLoading(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/public/portal/login/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not send verification code");
      return;
    }
    setOtpSent(true);
    setMessage("Enter the 6-digit code sent to your email.");
  }

  async function verifyCode() {
    setLoading(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/public/portal/login/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", email, code }),
    });
    setLoading(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(json.error || "");
      if (/expired/i.test(msg)) setError("This code has expired. Request a new one.");
      else if (/invalid/i.test(msg)) setError("Invalid code. Check the email and try again.");
      else setError(msg || "Could not verify code");
      return;
    }
    const portalToken = String(json.data?.portalToken || "");
    if (!portalToken) {
      setError("Portal session could not be created");
      return;
    }
    window.location.href = `/portal/${portalToken}`;
  }

  const bookHref = `/book/${encodeURIComponent(slug)}`;

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Your account</h1>
        <p className="text-sm text-muted-foreground">
          Sign in with your email. We&apos;ll send a one-time verification code.
        </p>
      </header>
      <div className="space-y-4 rounded-lg border p-4">
        {!otpSent ? (
          <label className="flex flex-col gap-1 text-sm">
            <span>Email address</span>
            <input
              type="email"
              className="rounded border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Enter the code sent to <span className="font-medium text-foreground">{email}</span>
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span>Verification code</span>
              <input
                className="rounded border px-3 py-2 tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
              />
            </label>
            <button
              type="button"
              className="text-sm text-primary underline"
              onClick={() => {
                setOtpSent(false);
                setCode("");
                setError(null);
              }}
            >
              Change email
            </button>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {!otpSent ? (
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              disabled={loading || !email.trim()}
              onClick={() => void sendCode()}
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                disabled={loading || !code.trim()}
                onClick={() => void verifyCode()}
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                disabled={loading}
                onClick={() => void sendCode()}
              >
                Resend code
              </button>
            </>
          )}
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        ) : null}
        {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        <a href={bookHref} className="underline">Return to booking page</a>
      </p>
    </main>
  );
}

export default function ClientPortalPublicClient({ token }: { token: string }) {
  if (isWorkspaceSlugToken(token)) {
    return <PortalSlugLogin slug={token} />;
  }
  return <ClientPortalTokenView token={token} />;
}

function ClientPortalTokenView({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<PortalSection>("home");
  const [appointmentFilter, setAppointmentFilter] = useState<"upcoming" | "past">("upcoming");
  const [walletBalanceCents, setWalletBalanceCents] = useState<number | null>(null);
  const [walletHistory, setWalletHistory] = useState<PortalData["accountCreditHistory"]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [profileDraft, setProfileDraft] = useState({ firstName: "", lastName: "", phone: "" });
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/public/portal/${token}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Invalid portal link");
    const resolved = json.data as PortalData;
    setData({
      ...resolved,
      appointments: resolved.appointments || [],
      entitlements: resolved.entitlements || {},
    });
    if (resolved.contact) {
      setProfileDraft({
        firstName: resolved.contact.firstName || "",
        lastName: resolved.contact.lastName || "",
        phone: resolved.contact.phone || "",
      });
    }
  }, [token]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load"),
    );
    void fetch(`/api/public/portal/${token}/payment-methods`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.ok) setPaymentMethod(json.data as PaymentMethodInfo);
      })
      .catch(() => undefined);
    void fetch(`/api/public/portal/${token}/wallet`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setWalletBalanceCents(Number(json.data?.balanceCents ?? 0));
          setWalletHistory(json.data?.history || []);
        }
      })
      .catch(() => undefined);
  }, [load, token]);

  const slug = data?.workspace?.slug || data?.workspaceSlug;
  const bookHref = slug ? `/book/${encodeURIComponent(slug)}` : "/book";
  const storeHref = slug ? `/book/${encodeURIComponent(slug)}/store` : bookHref;

  const upcoming = useMemo(
    () => data?.upcomingAppointments || data?.appointments.filter((a) => a.startsAt && new Date(a.startsAt).getTime() >= Date.now()) || [],
    [data],
  );
  const past = useMemo(
    () => data?.pastAppointments || [],
    [data],
  );
  const nextAppointment = upcoming[0];

  async function signOut() {
    await fetch(`/api/public/portal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign_out" }),
    });
    if (slug) window.location.href = `/portal/${slug}`;
    else window.location.href = "/book";
  }

  async function saveProfile() {
    setProfileSaving(true);
    setProfileMessage(null);
    const res = await fetch(`/api/public/portal/${token}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileDraft),
    });
    const json = await res.json().catch(() => ({}));
    setProfileSaving(false);
    if (!res.ok) {
      setProfileMessage(json.error || "Could not save profile");
      return;
    }
    setProfileMessage("Profile updated.");
    void load();
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-xl font-semibold">Your account</h1>
        <p className="text-sm text-destructive" role="alert">
          {/invalid|expired/i.test(error)
            ? "This account link is no longer valid."
            : error}
        </p>
        {slug ? (
          <a href={bookHref} className="text-sm font-medium text-primary underline">
            Return to booking page
          </a>
        ) : null}
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

  const businessName = data.workspace?.name || "Your business";
  const customerName = [data.contact?.firstName, data.contact?.lastName].filter(Boolean).join(" ");

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pb-12 sm:p-6">
      <header className="space-y-3 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">{businessName}</h1>
            {customerName ? (
              <p className="text-sm text-muted-foreground">Signed in as {customerName}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="text-sm text-muted-foreground underline"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
        <nav aria-label="Account sections" className="flex flex-wrap gap-2">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm ${
                section === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {section === "home" ? (
        <div className="space-y-4">
          {nextAppointment ? (
            <section className="rounded-lg border p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Next appointment
              </h2>
              <p className="mt-2 text-lg font-semibold">{nextAppointment.serviceName}</p>
              <p className="text-sm text-muted-foreground">{formatDate(nextAppointment.startsAt)}</p>
              {nextAppointment.staffName ? (
                <p className="text-sm text-muted-foreground">{nextAppointment.staffName}</p>
              ) : null}
              {nextAppointment.pendingApproval ? (
                <p className="mt-2 text-sm text-amber-800">Pending approval</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {nextAppointment.metadata?.manageAppointmentUrl ? (
                  <a
                    href={nextAppointment.metadata.manageAppointmentUrl}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                  >
                    View
                  </a>
                ) : null}
                {nextAppointment.meetingLink ? (
                  <a
                    href={nextAppointment.meetingLink}
                    className="rounded-md border px-3 py-1.5 text-sm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join meeting
                  </a>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="rounded-lg border p-4 text-sm text-muted-foreground">
              No upcoming appointments.{" "}
              <a href={bookHref} className="font-medium text-primary underline">Book an appointment</a>
            </section>
          )}

          <a
            href={bookHref}
            className="block rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm font-medium"
          >
            Book another appointment
          </a>

          {(data.entitlements.packages || []).length > 0 ? (
            <SummaryCard
              title="Packages"
              body={`${data.entitlements.packages![0].product?.name || "Package"} · ${packageCreditsTotal(data.entitlements.packages![0].remainingCredits)} credits left`}
              onClick={() => setSection("products")}
            />
          ) : null}

          {(data.entitlements.memberships || []).length > 0 ? (
            <SummaryCard
              title="Membership"
              body={`${data.entitlements.memberships![0].product?.name || "Membership"} · ${membershipStatusLabel(data.entitlements.memberships![0].status)}`}
              onClick={() => setSection("products")}
            />
          ) : null}

          {walletBalanceCents != null && walletBalanceCents > 0 ? (
            <SummaryCard
              title="Account credit"
              body={formatMoney(walletBalanceCents)}
              onClick={() => setSection("payments")}
            />
          ) : null}

          {(data.balanceDueAppointments || []).length > 0 || (data.outstandingInvoices || []).length > 0 ? (
            <SummaryCard
              title="Balance due"
              body={formatMoney(
                (data.balanceDueAppointments || []).reduce(
                  (s, a) => s + (a.paymentSummary?.balanceDueCents || 0),
                  0,
                ) +
                  (data.outstandingInvoices || []).reduce((s, i) => s + (i.balanceDueCents || 0), 0),
              )}
              onClick={() => setSection("payments")}
            />
          ) : null}
        </div>
      ) : null}

      {section === "appointments" ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <FilterButton active={appointmentFilter === "upcoming"} onClick={() => setAppointmentFilter("upcoming")}>
              Upcoming
            </FilterButton>
            <FilterButton active={appointmentFilter === "past"} onClick={() => setAppointmentFilter("past")}>
              Past
            </FilterButton>
          </div>
          <ul className="divide-y rounded-lg border">
            {(appointmentFilter === "upcoming" ? upcoming : past).length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">
                {appointmentFilter === "upcoming" ? "No upcoming appointments." : "No past appointments yet."}
              </li>
            ) : (
              (appointmentFilter === "upcoming" ? upcoming : past).map((a) => (
                <li key={a.id} className="space-y-2 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{a.serviceName || "Appointment"}</p>
                      <p className="text-muted-foreground">{formatDate(a.startsAt)}</p>
                      {a.staffName ? <p className="text-muted-foreground">{a.staffName}</p> : null}
                      {a.locationLabel ? <p className="text-muted-foreground">{a.locationLabel}</p> : null}
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{a.status}</span>
                  </div>
                  {a.pendingApproval ? (
                    <p className="text-xs text-amber-800">The business will confirm your request.</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {a.metadata?.manageAppointmentUrl ? (
                      <a href={a.metadata.manageAppointmentUrl} className="text-sm font-medium text-primary underline">
                        Manage
                      </a>
                    ) : null}
                    {a.meetingLink ? (
                      <a href={a.meetingLink} className="text-sm font-medium text-primary underline" target="_blank" rel="noreferrer">
                        Join meeting
                      </a>
                    ) : null}
                    <a href={bookHref} className="text-sm text-muted-foreground underline">Book again</a>
                  </div>
                </li>
              ))
            )}
          </ul>
          {(data.waitlist || []).length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold">Waitlist</h2>
              <ul className="mt-2 divide-y rounded-lg border text-sm">
                {data.waitlist!.map((w) => (
                  <li key={w.id} className="flex justify-between gap-4 p-3">
                    <span>{w.serviceName || "Waitlist"}</span>
                    <span className="text-muted-foreground capitalize">{w.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {section === "products" ? (
        <div className="space-y-6">
          <ProductSection title="Packages">
            {(data.entitlements.packages || []).length === 0 ? (
              <EmptyNote>No active packages.</EmptyNote>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {data.entitlements.packages!.map((pkg) => {
                  const credits = packageCreditsTotal(pkg.remainingCredits);
                  const expired = pkg.expiresAt && new Date(pkg.expiresAt).getTime() < Date.now();
                  const depleted = credits <= 0;
                  return (
                    <li key={pkg.id} className="space-y-1 p-4">
                      <p className="font-medium">{pkg.product?.name || "Package"}</p>
                      <p className="text-muted-foreground">
                        {depleted ? "0 credits remaining" : `${credits} credits remaining`}
                      </p>
                      {pkg.expiresAt ? (
                        <p className="text-muted-foreground">
                          {expired ? "Expired" : "Expires"} {formatShortDate(pkg.expiresAt)}
                        </p>
                      ) : null}
                      {!depleted ? (
                        <a href={bookHref} className="inline-block pt-1 text-sm font-medium text-primary underline">
                          Book with package
                        </a>
                      ) : (
                        <a href={storeHref} className="inline-block pt-1 text-sm text-muted-foreground underline">
                          Buy again
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {(data.packageUsageHistory || []).length > 0 ? (
              <HistoryTable
                title="Credit history"
                rows={data.packageUsageHistory!.map((e) => ({
                  date: formatDate(e.createdAt),
                  activity: e.note || e.kind || "Activity",
                  amount: typeof e.delta === "object" ? JSON.stringify(e.delta) : String(e.delta ?? ""),
                }))}
              />
            ) : null}
          </ProductSection>

          <ProductSection title="Memberships">
            {(data.entitlements.memberships || []).length === 0 ? (
              <EmptyNote>No active membership.</EmptyNote>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {data.entitlements.memberships!.map((m) => (
                  <li key={m.id} className="space-y-1 p-4">
                    <p className="font-medium">{m.product?.name || "Membership"}</p>
                    <p className="text-muted-foreground">{membershipStatusLabel(m.status)}</p>
                    {m.status === "past_due" ? (
                      <p className="text-sm text-amber-800">
                        Payment issue — membership benefits may be temporarily unavailable.
                      </p>
                    ) : null}
                    {m.currentPeriodEnd ? (
                      <p className="text-muted-foreground">Renews {formatShortDate(m.currentPeriodEnd)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </ProductSection>

          <ProductSection title="Gift cards">
            {(data.entitlements.gifts || []).length === 0 ? (
              <EmptyNote>No gift balances.</EmptyNote>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {data.entitlements.gifts!.map((g) => (
                  <li key={g.id} className="flex justify-between gap-4 p-4">
                    <span>
                      Gift card {g.code ? `•••• ${g.code.slice(-4)}` : ""}
                    </span>
                    <span className="font-medium">{formatMoney(g.balanceCents || 0)}</span>
                  </li>
                ))}
              </ul>
            )}
            {(data.giftRedemptionHistory || []).length > 0 ? (
              <HistoryTable
                title="Redemption history"
                rows={data.giftRedemptionHistory!.map((e) => ({
                  date: formatDate(e.date),
                  activity: e.activity,
                  amount: formatMoney(Math.abs(e.amountCents)),
                }))}
              />
            ) : null}
          </ProductSection>
        </div>
      ) : null}

      {section === "payments" ? (
        <div className="space-y-6">
          <section className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Account credit</h2>
            <p className="mt-2 text-2xl font-semibold">
              {walletBalanceCents != null ? formatMoney(walletBalanceCents) : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Applied automatically at checkout when eligible.</p>
            {(walletHistory || data.accountCreditHistory || []).length > 0 ? (
              <HistoryTable
                title="Account credit history"
                rows={(walletHistory || data.accountCreditHistory || []).map((e) => ({
                  date: formatDate(e.date),
                  activity: e.activity,
                  amount: `${e.amountCents >= 0 ? "+" : ""}${formatMoney(e.amountCents)}`,
                  balance: formatMoney(e.balanceCents),
                }))}
                showBalance
              />
            ) : null}
          </section>

          <section className="rounded-lg border p-4 text-sm">
            <h2 className="font-semibold">Payment methods</h2>
            {paymentMethod?.hasSavedCard && paymentMethod.card ? (
              <p className="mt-2 text-muted-foreground">
                {(paymentMethod.card.brand || "Card").toUpperCase()} •••• {paymentMethod.card.last4}
                {paymentMethod.card.expMonth && paymentMethod.card.expYear
                  ? ` · Expires ${String(paymentMethod.card.expMonth).padStart(2, "0")}/${paymentMethod.card.expYear}`
                  : ""}
              </p>
            ) : (
              <p className="mt-2 text-muted-foreground">
                No saved payment method. Add one during your next paid booking if the business supports it.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold">Payment history</h2>
            <ul className="mt-2 divide-y rounded-lg border text-sm">
              {(data.paymentHistory || []).length === 0 ? (
                <li className="p-4 text-muted-foreground">No payments yet.</li>
              ) : (
                data.paymentHistory!.map((p) => (
                  <li key={p.id} className="flex justify-between gap-4 p-4">
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

          {(data.invoices || []).length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold">Invoices</h2>
              <ul className="mt-2 divide-y rounded-lg border text-sm">
                {data.invoices!.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium">{formatMoney(inv.totalCents)}</p>
                      <p className="text-muted-foreground">{formatShortDate(inv.createdAt)} · {inv.status}</p>
                      {(inv.balanceDueCents || 0) > 0 ? (
                        <p className="text-muted-foreground">Due {formatMoney(inv.balanceDueCents)}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(data.balanceDueAppointments || []).length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold">Outstanding balances</h2>
              <ul className="mt-2 divide-y rounded-lg border text-sm">
                {data.balanceDueAppointments!.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <span>{a.serviceName}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {formatMoney(a.paymentSummary?.balanceDueCents || 0)}
                      </span>
                      {a.metadata?.manageAppointmentUrl ? (
                        <a href={a.metadata.manageAppointmentUrl} className="text-primary underline">
                          Pay
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {section === "documents" ? (
        <div>
          {(data.documents || []).length === 0 ? (
            <EmptyNote>No documents on file yet.</EmptyNote>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {data.documents!.map((doc) => (
                <li key={doc.id} className="space-y-1 p-4">
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-muted-foreground">
                    {doc.serviceName || "Appointment"} · {formatShortDate(doc.date)}
                  </p>
                  <p className="text-muted-foreground capitalize">{doc.status}</p>
                  {doc.detail ? <p className="text-xs text-muted-foreground">{doc.detail}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {section === "profile" ? (
        <div className="space-y-6">
          <form
            className="space-y-4 rounded-lg border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveProfile();
            }}
          >
            <h2 className="text-sm font-semibold">Contact information</h2>
            <label className="flex flex-col gap-1 text-sm">
              <span>First name</span>
              <input
                className="rounded border px-3 py-2"
                value={profileDraft.firstName}
                onChange={(e) => setProfileDraft((p) => ({ ...p, firstName: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Last name</span>
              <input
                className="rounded border px-3 py-2"
                value={profileDraft.lastName}
                onChange={(e) => setProfileDraft((p) => ({ ...p, lastName: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Phone</span>
              <input
                className="rounded border px-3 py-2"
                value={profileDraft.phone}
                onChange={(e) => setProfileDraft((p) => ({ ...p, phone: e.target.value }))}
                type="tel"
              />
            </label>
            <p className="text-sm text-muted-foreground">
              Email: {data.contact?.email || "—"} (contact the business to change login email)
            </p>
            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {profileSaving ? "Saving…" : "Save changes"}
            </button>
            {profileMessage ? (
              <p className="text-sm text-muted-foreground" role="status">{profileMessage}</p>
            ) : null}
          </form>

          {data.household?.members?.length ? (
            <section className="rounded-lg border p-4 text-sm">
              <h2 className="font-semibold">Household</h2>
              <p className="mt-1 text-muted-foreground">{data.household.name || "Family account"}</p>
              <ul className="mt-3 space-y-1">
                {data.household.members.map((m) => (
                  <li key={m.id}>
                    {m.displayName || "Member"}
                    {m.role ? ` · ${m.role}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function SummaryCard({ title, body, onClick }: { title: string; body: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border p-4 text-left transition hover:border-primary/40"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm font-medium">{body}</p>
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${
        active ? "bg-primary text-primary-foreground" : "bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function ProductSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border p-4 text-sm text-muted-foreground">{children}</p>;
}

function HistoryTable({
  title,
  rows,
  showBalance,
}: {
  title: string;
  rows: Array<{ date: string; activity: string; amount: string; balance?: string }>;
  showBalance?: boolean;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <h3 className="text-sm font-medium">{title}</h3>
      <table className="mt-2 w-full min-w-[280px] text-left text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-2 pr-2 font-medium">Date</th>
            <th className="py-2 pr-2 font-medium">Activity</th>
            <th className="py-2 pr-2 font-medium">Amount</th>
            {showBalance ? <th className="py-2 font-medium">Balance</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-2 pr-2">{row.date}</td>
              <td className="py-2 pr-2">{row.activity}</td>
              <td className="py-2 pr-2">{row.amount}</td>
              {showBalance ? <td className="py-2">{row.balance}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
