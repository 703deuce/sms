"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useClientPortalSession, type PortalWorkspace } from "@/features/client-portal/use-client-portal";
import "@/components/client-portal/client-portal.css";

type Section = "home" | "appointments" | "forms" | "access" | "payments" | "profile";

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

type Appt = PortalWorkspace["appointments"]["upcoming"][number] & {
  id: string;
  title: string;
  startsAt: string;
  status: string;
  staffName?: string | null;
  location?: string | null;
  payment?: { balanceDueCents: number; amountPaidCents: number };
  canReschedule?: boolean;
  canCancel?: boolean;
  rescheduleBlockedReason?: string | null;
  cancelBlockedReason?: string | null;
};

export function ClientPortalApp() {
  const portal = useClientPortalSession();
  const [section, setSection] = useState<Section>("home");
  const [apptTab, setApptTab] = useState<"upcoming" | "past" | "cancelled">("upcoming");
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const accent = portal.data?.business.accentColor || "#0d9488";

  const apptList = useMemo(() => {
    if (!portal.data) return [];
    if (apptTab === "upcoming") return portal.data.appointments.upcoming as Appt[];
    if (apptTab === "past") return portal.data.appointments.past as Appt[];
    return portal.data.appointments.cancelled as Appt[];
  }, [portal.data, apptTab]);

  const runAppointmentAction = useCallback(
    async (appointmentId: string, action: string, extra?: Record<string, unknown>) => {
      setBusy(true);
      setMessage("");
      try {
        const res = await fetch(`/api/client/portal/appointments/${appointmentId}/actions`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Action failed");
        if (json.data?.checkoutUrl) {
          window.location.href = json.data.checkoutUrl;
          return;
        }
        if (json.data?.managePath) {
          window.location.href = json.data.managePath;
          return;
        }
        await portal.reload();
        setMessage(action === "cancel" ? "Appointment canceled." : "Updated.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [portal],
  );

  async function saveProfile() {
    if (!portal.data) return;
    setBusy(true);
    try {
      const res = await fetch("/api/client/portal/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profileDraft.firstName ?? portal.data.profile.firstName,
          lastName: profileDraft.lastName ?? portal.data.profile.lastName,
          phone: profileDraft.phone ?? portal.data.profile.phone,
          timezone: profileDraft.timezone ?? portal.data.profile.timezone,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      await portal.reload();
      setMessage("Profile saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (portal.loading) {
    return (
      <div className="client-portal-root p-8 text-center" style={{ color: "var(--cp-muted)" }}>
        Loading your account…
      </div>
    );
  }

  if (portal.error === "unauthorized" || !portal.data) {
    return (
      <div className="client-portal-root client-portal-main text-center">
        <p>Please sign in to view your account.</p>
        <Link href="/client/login" className="client-portal-btn client-portal-btn-primary mt-4 inline-flex">
          Sign in
        </Link>
      </div>
    );
  }

  const d = portal.data;
  const next = d.nextAppointment as Appt | null;

  return (
    <div className="client-portal-root" style={{ ["--cp-accent" as string]: accent }}>
      <header className="client-portal-main pb-2">
        <div className="flex items-center gap-3">
          {d.business.logoUrl ? (
            <img src={d.business.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--cp-muted)" }}>{d.business.name}</p>
            <h1 className="text-lg font-semibold">Hi, {d.profile.displayName.split(" ")[0]}</h1>
          </div>
        </div>
      </header>

      <main className="client-portal-main">
        {message && <p className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">{message}</p>}

        {section === "home" && (
          <div className="space-y-4">
            {next ? (
              <section className="client-portal-hero">
                <p className="text-xs uppercase opacity-90">Next appointment</p>
                <h2 className="mt-1 text-xl font-semibold">{next.title}</h2>
                <p className="mt-2 text-sm opacity-95">{fmt(next.startsAt)}</p>
                <p className="text-sm opacity-90">{next.staffName || ""}{next.location ? ` · ${next.location}` : ""}</p>
                {next.payment && next.payment.balanceDueCents > 0 && (
                  <p className="mt-2 text-sm">{money(next.payment.balanceDueCents)} remaining</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/client/appointments/${next.id}`} className="client-portal-btn client-portal-btn-secondary text-sm">
                    View details
                  </Link>
                  {next.canReschedule && (
                    <button
                      type="button"
                      className="client-portal-btn client-portal-btn-secondary text-sm"
                      disabled={busy}
                      onClick={() => void runAppointmentAction(next.id, "manage_token")}
                    >
                      Reschedule
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <section className="client-portal-card text-center">
                <p>No upcoming appointments.</p>
                <a href={d.bookUrlWithContact} className="client-portal-btn client-portal-btn-primary mt-3 inline-flex">
                  Book an appointment
                </a>
              </section>
            )}

            {d.tasks.length > 0 && (
              <section>
                <h3 className="mb-2 font-semibold">Things to do</h3>
                <ul className="client-portal-list">
                  {d.tasks.map((t) => (
                    <li key={t.id} className="client-portal-card flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{t.label}</p>
                        <p className="text-sm" style={{ color: "var(--cp-muted)" }}>{t.detail}</p>
                      </div>
                      <Link href={t.href} className="text-sm font-semibold" style={{ color: accent }}>Open</Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(d.packages.length > 0 || d.memberships.length > 0) && (
              <section>
                <h3 className="mb-2 font-semibold">My access</h3>
                <div className="client-portal-list">
                  {d.packages.map((p) => {
                    const pkg = p as { id: string; name: string; remaining: number; expiresAt: string | null };
                    return (
                      <div key={pkg.id} className="client-portal-card">
                        <p className="font-medium">{pkg.name}</p>
                        <p className="text-sm" style={{ color: "var(--cp-muted)" }}>{pkg.remaining} credits remaining</p>
                      </div>
                    );
                  })}
                  {d.memberships.map((m) => {
                    const mem = m as { id: string; name: string; status: string };
                    return (
                      <div key={mem.id} className="client-portal-card">
                        <p className="font-medium">{mem.name}</p>
                        <p className="text-sm capitalize" style={{ color: "var(--cp-muted)" }}>{mem.status}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {section === "appointments" && (
          <div>
            <div className="mb-3 flex gap-2">
              {(["upcoming", "past", "cancelled"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded-full px-3 py-1 text-xs capitalize"
                  style={{
                    background: apptTab === t ? accent : "var(--cp-surface)",
                    color: apptTab === t ? "#fff" : "var(--cp-muted)",
                    border: `1px solid var(--cp-border)`,
                  }}
                  onClick={() => setApptTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <ul className="client-portal-list">
              {apptList.map((a) => (
                <li key={a.id} className="client-portal-card">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm" style={{ color: "var(--cp-muted)" }}>{fmt(a.startsAt)}</p>
                  <Link href={`/client/appointments/${a.id}`} className="mt-2 inline-block text-sm font-semibold" style={{ color: accent }}>
                    View
                  </Link>
                </li>
              ))}
              {!apptList.length && <li className="client-portal-card text-sm" style={{ color: "var(--cp-muted)" }}>None here.</li>}
            </ul>
            <a href={d.bookUrlWithContact} className="client-portal-btn client-portal-btn-primary mt-4 inline-flex w-full justify-center">
              Book appointment
            </a>
          </div>
        )}

        {section === "forms" && (
          <ul className="client-portal-list">
            {(d.forms as Array<{ id: string; formName: string; status: string; submittedAt: string }>).map((f) => (
              <li key={f.id} className="client-portal-card">
                <p className="font-medium">{f.formName}</p>
                <p className="text-sm capitalize" style={{ color: "var(--cp-muted)" }}>{f.status}</p>
                <p className="text-xs" style={{ color: "var(--cp-muted)" }}>{fmt(f.submittedAt)}</p>
              </li>
            ))}
            {!d.forms.length && (
              <li className="client-portal-card" style={{ color: "var(--cp-muted)" }}>No forms to show.</li>
            )}
          </ul>
        )}

        {section === "access" && (
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 font-semibold">Packages</h3>
              <ul className="client-portal-list">
                {d.packages.map((p) => {
                  const pkg = p as { id: string; name: string; remaining: number };
                  return (
                    <li key={pkg.id} className="client-portal-card">
                      {pkg.name} — {pkg.remaining} credits
                      <a href={d.bookUrlWithContact} className="mt-2 block text-sm font-semibold" style={{ color: accent }}>
                        Book using package
                      </a>
                    </li>
                  );
                })}
                {!d.packages.length && <li className="client-portal-card text-sm" style={{ color: "var(--cp-muted)" }}>No active packages.</li>}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Memberships</h3>
              <ul className="client-portal-list">
                {d.memberships.map((m) => {
                  const mem = m as { id: string; name: string; status: string };
                  return (
                    <li key={mem.id} className="client-portal-card capitalize">
                      {mem.name} — {mem.status}
                    </li>
                  );
                })}
                {!d.memberships.length && <li className="client-portal-card text-sm" style={{ color: "var(--cp-muted)" }}>No active membership.</li>}
              </ul>
            </section>
          </div>
        )}

        {section === "payments" && (
          <div className="space-y-4">
            <div className="client-portal-card grid grid-cols-2 gap-3 text-sm">
              <div>
                <p style={{ color: "var(--cp-muted)" }}>Outstanding</p>
                <p className="text-lg font-semibold">{money(d.payments.outstandingCents)}</p>
              </div>
              <div>
                <p style={{ color: "var(--cp-muted)" }}>Account credit</p>
                <p className="text-lg font-semibold">{money(d.payments.walletCreditCents)}</p>
              </div>
            </div>
            <ul className="client-portal-list">
              {d.payments.transactions.map((t) => (
                <li key={t.id} className="client-portal-card flex justify-between text-sm">
                  <span>{fmt(t.at)}</span>
                  <span className="font-medium">{money(t.amountCents)}</span>
                </li>
              ))}
              {!d.payments.transactions.length && (
                <li className="client-portal-card text-sm" style={{ color: "var(--cp-muted)" }}>No payment history yet.</li>
              )}
            </ul>
          </div>
        )}

        {section === "profile" && (
          <div className="client-portal-card space-y-3">
            {(["firstName", "lastName", "phone", "timezone"] as const).map((field) => (
              <label key={field} className="block text-sm">
                <span className="capitalize" style={{ color: "var(--cp-muted)" }}>{field.replace(/([A-Z])/g, " $1")}</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  style={{ borderColor: "var(--cp-border)" }}
                  value={profileDraft[field] ?? (d.profile[field] as string) ?? ""}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, [field]: e.target.value }))}
                />
              </label>
            ))}
            <p className="text-sm" style={{ color: "var(--cp-muted)" }}>Email: {d.profile.email || "—"}</p>
            <button type="button" className="client-portal-btn client-portal-btn-primary w-full" disabled={busy} onClick={() => void saveProfile()}>
              Save profile
            </button>
            <button
              type="button"
              className="client-portal-btn client-portal-btn-secondary w-full"
              onClick={() => void portal.logout().then(() => { window.location.href = "/client/login"; })}
            >
              Sign out
            </button>
          </div>
        )}
      </main>

      <nav className="client-portal-nav" aria-label="Portal">
        {(
          [
            ["home", "Home"],
            ["appointments", "Appts"],
            ["forms", "Forms"],
            ["access", "Access"],
            ["payments", "Pay"],
            ["profile", "Profile"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" data-active={section === id} onClick={() => setSection(id)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
