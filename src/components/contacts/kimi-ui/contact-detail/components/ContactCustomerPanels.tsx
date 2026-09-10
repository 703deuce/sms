"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Gift,
  Home,
  Package,
  ShieldAlert,
  Wallet,
  Users,
} from "lucide-react";
import { Card, SectionHeader, Button, InlineEmpty } from "./ui";

type CustomerData = {
  overview: {
    nextAppointment: { id: string; startsAt: string; serviceName: string | null; status: string } | null;
    lastAppointment: { id: string; startsAt: string; serviceName: string | null; status: string } | null;
    completedAppointments: number;
  };
  entitlements: {
    packages: Array<{
      id: string;
      status: string;
      expiresAt?: string | null;
      remainingCredits?: Record<string, number> | null;
      product?: { name?: string | null };
    }>;
    memberships: Array<{
      id: string;
      status: string;
      renewsAt?: string | null;
      product?: { name?: string | null };
    }>;
    gifts: Array<{
      id: string;
      balanceCents: number;
      status: string;
    }>;
  };
  accountCredit: { balanceCents: number; currency: string };
  creditHistory: Array<{
    id: string;
    kind: string;
    amountCents: number;
    balanceAfterCents: number;
    note?: string | null;
    createdAt: string;
  }>;
  household: {
    id: string;
    name?: string | null;
    payerContactId: string;
    members: Array<{ id: string; contactId: string; role?: string | null; displayName?: string | null }>;
  } | null;
  bookingRestriction: {
    id: string;
    blockPublicBooking?: boolean;
    reason?: string | null;
    displayMessage?: string | null;
    createdAt?: string;
  } | null;
  contact: {
    customFields?: unknown;
  };
};

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function packageCreditsRemaining(remaining: Record<string, number> | null | undefined) {
  if (!remaining || typeof remaining !== "object") return 0;
  const values = Object.values(remaining);
  return values.reduce((sum, n) => sum + (typeof n === "number" ? n : 0), 0);
}

export function ContactOverviewPanel({ contactId }: { contactId: string }) {
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/customer-data`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load overview");
      setData(json.data as CustomerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card style={{ padding: 18 }}>
        <SectionHeader icon={<Users />} title="Overview" description="Customer summary" />
        <div className="skeleton" style={{ marginTop: 16, height: 80 }} />
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card style={{ padding: 18 }}>
        <SectionHeader icon={<Users />} title="Overview" description="Customer summary" />
        <p style={{ marginTop: 12, fontSize: 13, color: "var(--destructive)" }}>{error || "Unavailable"}</p>
        <Button variant="outline" onClick={() => void load()} style={{ marginTop: 8 }}>Try again</Button>
      </Card>
    );
  }

  const activePackages = data.entitlements.packages.filter((p) => p.status === "active");
  const activeMemberships = data.entitlements.memberships.filter((m) =>
    ["active", "past_due"].includes(m.status),
  );

  return (
    <Card style={{ padding: 18 }}>
      <SectionHeader icon={<Users />} title="Overview" description="Key customer information at a glance." />
      <dl
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          fontSize: 13,
        }}
      >
        <div>
          <dt style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Next appointment
          </dt>
          <dd style={{ margin: "4px 0 0", fontWeight: 500 }}>
            {data.overview.nextAppointment ? (
              <Link href={`/appointments/${data.overview.nextAppointment.id}`} style={{ color: "var(--primary)" }}>
                {data.overview.nextAppointment.serviceName || "Appointment"} — {formatWhen(data.overview.nextAppointment.startsAt)}
              </Link>
            ) : (
              "None scheduled"
            )}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Last appointment
          </dt>
          <dd style={{ margin: "4px 0 0", fontWeight: 500 }}>
            {data.overview.lastAppointment
              ? `${data.overview.lastAppointment.serviceName || "Appointment"} — ${formatWhen(data.overview.lastAppointment.startsAt)}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Completed
          </dt>
          <dd style={{ margin: "4px 0 0", fontWeight: 500 }}>{data.overview.completedAppointments}</dd>
        </div>
        <div>
          <dt style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Active packages
          </dt>
          <dd style={{ margin: "4px 0 0", fontWeight: 500 }}>{activePackages.length || "—"}</dd>
        </div>
        <div>
          <dt style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Active membership
          </dt>
          <dd style={{ margin: "4px 0 0", fontWeight: 500 }}>{activeMemberships.length ? "Yes" : "—"}</dd>
        </div>
        <div>
          <dt style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Account credit
          </dt>
          <dd style={{ margin: "4px 0 0", fontWeight: 500 }}>
            {formatMoney(data.accountCredit.balanceCents, data.accountCredit.currency)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

export function ContactPackagesMembershipsPanel({ contactId }: { contactId: string }) {
  const [data, setData] = useState<CustomerData["entitlements"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/customer-data`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData((json.data as CustomerData).entitlements);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card style={{ padding: 18 }}>
      <SectionHeader
        icon={<Package />}
        title="Packages & memberships"
        description="Customer-owned packages and memberships."
      />
      {loading ? (
        <div className="skeleton" style={{ marginTop: 16, height: 60 }} />
      ) : error ? (
        <p style={{ marginTop: 12, fontSize: 13, color: "var(--destructive)" }}>{error}</p>
      ) : !data ? (
        <InlineEmpty>No entitlement data.</InlineEmpty>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Packages
            </h3>
            {data.packages.length === 0 ? (
              <InlineEmpty>No packages on file.</InlineEmpty>
            ) : (
              <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {data.packages.map((pkg) => (
                  <li
                    key={pkg.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{pkg.product?.name || "Package"}</div>
                    <div style={{ color: "var(--muted-foreground)", marginTop: 4 }}>
                      {packageCreditsRemaining(pkg.remainingCredits as Record<string, number>)} credits remaining
                      {pkg.expiresAt ? ` · Expires ${formatWhen(pkg.expiresAt)}` : ""}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, textTransform: "capitalize" }}>{pkg.status}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Memberships
            </h3>
            {data.memberships.length === 0 ? (
              <InlineEmpty>No memberships on file.</InlineEmpty>
            ) : (
              <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {data.memberships.map((m) => (
                  <li
                    key={m.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{m.product?.name || "Membership"}</div>
                    <div style={{ color: "var(--muted-foreground)", marginTop: 4, textTransform: "capitalize" }}>
                      {m.status}
                      {m.renewsAt ? ` · Renews ${formatWhen(m.renewsAt)}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link href={`/appointments/pos?contactId=${contactId}`}>
              <Button variant="primary">Add package or membership</Button>
            </Link>
            <Link href="/appointments/packages">
              <Button variant="outline">View package definitions</Button>
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ContactAccountCreditPanel({ contactId }: { contactId: string }) {
  const [balanceCents, setBalanceCents] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [ledger, setLedger] = useState<CustomerData["creditHistory"]>([]);
  const [gifts, setGifts] = useState<CustomerData["entitlements"]["gifts"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/customer-data`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      const d = json.data as CustomerData;
      setBalanceCents(d.accountCredit.balanceCents);
      setCurrency(d.accountCredit.currency);
      setLedger(d.creditHistory);
      setGifts(d.entitlements.gifts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitAdjust() {
    const cents = Math.round(Number(amount) * 100);
    if (!cents || cents <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/client-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: adjustMode === "credit" ? "credit" : "debit",
          contactId,
          amountCents: cents,
          note: reason.trim() || `Manual ${adjustMode}`,
          kind: "manual_adjustment",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Adjustment failed");
      setAdjustOpen(false);
      setAmount("");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed");
    } finally {
      setBusy(false);
    }
  }

  const adjustmentPreview =
    amount && Number(amount) > 0
      ? adjustMode === "credit"
        ? balanceCents + Math.round(Number(amount) * 100)
        : balanceCents - Math.round(Number(amount) * 100)
      : balanceCents;

  return (
    <Card style={{ padding: 18 }}>
      <SectionHeader
        icon={<Wallet />}
        title="Payments & account credit"
        description="Account credit balance and recent activity."
      />
      {loading ? (
        <div className="skeleton" style={{ marginTop: 16, height: 60 }} />
      ) : (
        <div style={{ marginTop: 16 }}>
          {error ? (
            <p style={{ fontSize: 13, color: "var(--destructive)", marginBottom: 8 }}>{error}</p>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                Account credit
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700 }}>{formatMoney(balanceCents, currency)}</p>
            </div>
            <Button variant="outline" onClick={() => setAdjustOpen((v) => !v)}>Adjust credit</Button>
          </div>

          {adjustOpen ? (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 10,
                border: "1px solid var(--border)",
                display: "grid",
                gap: 10,
              }}
            >
              <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="radio"
                    name="adjustMode"
                    checked={adjustMode === "credit"}
                    onChange={() => setAdjustMode("credit")}
                  />
                  Add credit
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="radio"
                    name="adjustMode"
                    checked={adjustMode === "debit"}
                    onChange={() => setAdjustMode("debit")}
                  />
                  Remove credit
                </label>
              </fieldset>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                <span>Amount (USD)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                <span>Reason</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px" }}
                />
              </label>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>
                Current: {formatMoney(balanceCents, currency)} → New: {formatMoney(Math.max(0, adjustmentPreview), currency)}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="primary" disabled={busy} onClick={() => void submitAdjust()}>
                  {busy ? "Saving…" : "Confirm adjustment"}
                </Button>
                <Button variant="ghost" onClick={() => setAdjustOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : null}

          {gifts.length > 0 ? (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
                <Gift style={{ width: 12, height: 12 }} /> Gift cards
              </h3>
              <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {gifts.map((g) => (
                  <li key={g.id} style={{ fontSize: 13 }}>
                    {formatMoney(g.balanceCents)} remaining
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Credit history
            </h3>
            {ledger.length === 0 ? (
              <InlineEmpty>No credit activity yet.</InlineEmpty>
            ) : (
              <table style={{ marginTop: 8, width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted-foreground)" }}>
                    <th style={{ padding: "6px 4px" }}>Date</th>
                    <th style={{ padding: "6px 4px" }}>Activity</th>
                    <th style={{ padding: "6px 4px" }}>Amount</th>
                    <th style={{ padding: "6px 4px" }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row) => (
                    <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 4px" }}>{formatWhen(row.createdAt)}</td>
                      <td style={{ padding: "8px 4px" }}>{row.note || row.kind}</td>
                      <td style={{ padding: "8px 4px", color: row.amountCents >= 0 ? "#047857" : "#b91c1c" }}>
                        {row.amountCents >= 0 ? "+" : ""}
                        {formatMoney(row.amountCents)}
                      </td>
                      <td style={{ padding: "8px 4px" }}>{formatMoney(row.balanceAfterCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <Link href="/appointments/payments" style={{ fontSize: 13, color: "var(--primary)", fontWeight: 500 }}>
              View all transactions →
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ContactHouseholdPanel({ contactId }: { contactId: string }) {
  const [household, setHousehold] = useState<CustomerData["household"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberContactId, setMemberContactId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/customer-data`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setHousehold((json.data as CustomerData).household);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createHousehold() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payerContactId: contactId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create household");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function addMember() {
    if (!household?.id || !memberContactId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_member",
          householdId: household.id,
          contactId: memberContactId.trim(),
          role: "dependent",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not add member");
      setMemberContactId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ padding: 18 }}>
      <SectionHeader icon={<Home />} title="Household" description="Family and dependent relationships." />
      {loading ? (
        <div className="skeleton" style={{ marginTop: 16, height: 48 }} />
      ) : !household ? (
        <div style={{ marginTop: 16 }}>
          <InlineEmpty>No household linked to this customer.</InlineEmpty>
          {error ? <p style={{ fontSize: 13, color: "var(--destructive)" }}>{error}</p> : null}
          <Button variant="outline" disabled={busy} onClick={() => void createHousehold()} style={{ marginTop: 12 }}>
            Create household
          </Button>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{household.name || "Household"}</p>
          <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
            {household.members.map((m) => (
              <li key={m.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                <Link href={`/contacts/${m.contactId}`} style={{ color: "var(--primary)", fontWeight: 500 }}>
                  {m.displayName || m.contactId}
                </Link>
                <span style={{ color: "var(--muted-foreground)", textTransform: "capitalize" }}>
                  {m.contactId === household.payerContactId ? "Primary" : m.role || "Dependent"}
                </span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              placeholder="Contact ID to add"
              value={memberContactId}
              onChange={(e) => setMemberContactId(e.target.value)}
              style={{ flex: 1, minWidth: 160, borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px", fontSize: 13 }}
            />
            <Button variant="outline" disabled={busy} onClick={() => void addMember()}>Add member</Button>
          </div>
          {error ? <p style={{ marginTop: 8, fontSize: 13, color: "var(--destructive)" }}>{error}</p> : null}
        </div>
      )}
    </Card>
  );
}

export function ContactBookingAccessPanel({ contactId }: { contactId: string }) {
  const [restriction, setRestriction] = useState<CustomerData["bookingRestriction"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/customer-data`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setRestriction((json.data as CustomerData).bookingRestriction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function restrict() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/client-restrictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          blockPublicBooking: true,
          reason: reason.trim() || "Staff restriction",
          displayMessage: "We couldn't complete this booking online. Please contact the business.",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save restriction");
      setDrawerOpen(false);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeRestriction() {
    if (!restriction?.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/client-restrictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: restriction.id,
          contactId,
          blockPublicBooking: false,
          blockPurchases: false,
          blockSelfService: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not remove restriction");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const isRestricted = Boolean(restriction?.blockPublicBooking);

  return (
    <Card style={{ padding: 18 }}>
      <SectionHeader
        icon={<ShieldAlert />}
        title="Booking access"
        description="Online booking permissions for this customer."
      />
      {loading ? (
        <div className="skeleton" style={{ marginTop: 16, height: 40 }} />
      ) : (
        <div style={{ marginTop: 16 }}>
          {error ? <p style={{ fontSize: 13, color: "var(--destructive)" }}>{error}</p> : null}
          {isRestricted ? (
            <div
              style={{
                borderRadius: 10,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                padding: "12px 14px",
                fontSize: 13,
              }}
            >
              <p style={{ margin: 0, fontWeight: 600, color: "#b91c1c" }}>Online booking restricted</p>
              {restriction?.reason ? (
                <p style={{ margin: "6px 0 0", color: "#7f1d1d" }}>Reason: {restriction.reason}</p>
              ) : null}
              <Button variant="outline" disabled={busy} onClick={() => void removeRestriction()} style={{ marginTop: 10 }}>
                Remove restriction
              </Button>
            </div>
          ) : (
            <div>
              <p style={{ margin: 0, fontSize: 13 }}>Can book normally</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
                This customer can use your public booking pages.
              </p>
              <Button variant="outline" onClick={() => setDrawerOpen(true)} style={{ marginTop: 12 }}>
                Restrict booking
              </Button>
            </div>
          )}
          {drawerOpen ? (
            <div style={{ marginTop: 14, padding: 14, border: "1px solid var(--border)", borderRadius: 10 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                <span>Reason (internal)</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px" }}
                />
              </label>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <Button variant="primary" disabled={busy} onClick={() => void restrict()}>Confirm restriction</Button>
                <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

export function ContactCustomFieldsValuesCard({ customFields }: { customFields: unknown }) {
  const fields =
    customFields && typeof customFields === "object" && !Array.isArray(customFields)
      ? Object.entries(customFields as Record<string, unknown>).filter(
          ([key, val]) => !["linkedin", "timezone"].includes(key) && val != null && String(val).trim() !== "",
        )
      : [];

  if (fields.length === 0) return null;

  return (
    <Card style={{ padding: 18 }}>
      <SectionHeader
        icon={<CreditCard />}
        title="Customer information"
        description="Custom fields on this profile."
      />
      <dl style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {fields.map(([key, value]) => (
          <div key={key}>
            <dt style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              {key.replace(/_/g, " ")}
            </dt>
            <dd style={{ margin: "2px 0 0", fontSize: 14 }}>{String(value)}</dd>
          </div>
        ))}
      </dl>
      <p style={{ marginTop: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        Field definitions are managed under{" "}
        <Link href="/contacts/fields" style={{ color: "var(--primary)" }}>Customer Fields</Link>.
      </p>
    </Card>
  );
}
