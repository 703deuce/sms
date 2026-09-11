"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, MessageSquare, MoreHorizontal } from "lucide-react";
import { useClientDetail } from "@/features/appointments/kimi/clients/use-clients-workspace";
import { MergeClientsModal } from "./merge-clients-modal";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "appointments", label: "Appointments" },
  { id: "forms", label: "Forms & documents" },
  { id: "access", label: "Packages & memberships" },
  { id: "payments", label: "Payments" },
  { id: "messages", label: "Messages" },
  { id: "notes", label: "Notes & activity" },
  { id: "profile", label: "Profile" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ClientDetailConnected({ clientId }: { clientId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as SectionId) || "overview";
  const detail = useClientDetail(clientId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({});
  const [apptFilter, setApptFilter] = useState<"upcoming" | "past" | "all">("all");
  const [error, setError] = useState("");

  const setSection = useCallback(
    (id: SectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/clients/${clientId}?${q.toString()}`, { scroll: false });
    },
    [router, searchParams, clientId],
  );

  const d = detail.data;
  const c = d?.contact;

  async function toggleBlock() {
    if (!c) return;
    setError("");
    try {
      if (d?.bookingAccess.publicBookingBlocked) {
        if (d.bookingAccess.restrictionId) {
          await fetch("/api/appointments/service-booking/client-restrictions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: d.bookingAccess.restrictionId,
              contactId: c.id,
              blockPublicBooking: false,
              blockPurchases: false,
              blockSelfService: false,
            }),
          });
        }
      } else {
        await fetch("/api/appointments/service-booking/client-restrictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: c.id,
            email: c.email,
            phone: c.phone,
            blockPublicBooking: true,
            blockPurchases: false,
            blockSelfService: true,
            reason: "Blocked from Clients admin",
          }),
        });
      }
      await detail.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function archiveClient() {
    if (!c || !confirm("Archive this client? They will be hidden from the active directory.")) return;
    await detail.patch({ status: "INVALID" });
  }

  async function saveProfile() {
    if (!c) return;
    await detail.patch({
      firstName: profileDraft.firstName ?? c.firstName,
      lastName: profileDraft.lastName ?? c.lastName,
      email: profileDraft.email ?? c.email,
      phone: profileDraft.phone ?? c.phone,
      timezone: profileDraft.timezone ?? c.timezone,
    });
  }

  async function addNote() {
    if (!noteDraft.trim()) return;
    await detail.patch({ addNote: noteDraft.trim() });
    setNoteDraft("");
  }

  if (detail.loading) {
    return (
      <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
        <div className="mx-auto max-w-[1560px] h-48 animate-pulse rounded bg-[var(--surface)]" />
      </div>
    );
  }

  if (!d || !c) {
    return (
      <div className={`${SHELL} p-8 text-sm`}>
        {detail.error || "Client not found"}{" "}
        <Link href="/appointments/clients" className="text-[var(--accent)]">Back</Link>
      </div>
    );
  }

  const initials = d.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const filteredAppts = d.appointments.filter((a) => {
    const now = Date.now();
    const t = new Date(a.startsAt).getTime();
    const cancelled = /cancel|no_show/i.test(a.status);
    if (apptFilter === "upcoming") return t > now && !cancelled;
    if (apptFilter === "past") return t <= now && !cancelled;
    return true;
  });

  const bookHref = `/appointments/calendar?contactId=${encodeURIComponent(clientId)}`;
  const posHref = `/appointments/point-of-sale?contactId=${encodeURIComponent(clientId)}`;
  const messageHref = `/conversations?contact=${encodeURIComponent(clientId)}`;

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <Link href="/appointments/clients" className="text-xs text-[var(--accent)]">← Clients</Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
                {initials}
              </span>
              <div>
                <h1 className="ws-event-title">{d.displayName}</h1>
                <p className="text-xs text-[var(--text-muted)]">{c.email || "—"} · {c.phone}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="ws-chip">{c.status === "BLOCKED" ? "Blocked" : c.status === "INVALID" ? "Archived" : "Active"}</span>
                  {d.bookingAccess.publicBookingBlocked && <span className="ws-chip">Online booking blocked</span>}
                  {d.balance.outstandingCents > 0 && <span className="ws-chip">{money(d.balance.outstandingCents)} due</span>}
                  {d.balance.walletCreditCents > 0 && <span className="ws-chip">{money(d.balance.walletCreditCents)} credit</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={bookHref} className="appt-pilot-primary-btn text-xs">
                <Calendar className="mr-1 inline h-3.5 w-3.5" /> Book appointment
              </Link>
              <Link href={messageHref} className="appt-pilot-secondary-btn text-xs">
                <MessageSquare className="mr-1 inline h-3.5 w-3.5" /> Message
              </Link>
              <div className="relative">
                <button type="button" className="appt-pilot-secondary-btn px-2" onClick={() => setMenuOpen((v) => !v)} aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 z-10 mt-1 min-w-[180px] rounded border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
                    <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-[var(--surface-muted)]" onClick={() => { setMergeOpen(true); setMenuOpen(false); }}>
                      Merge duplicate
                    </button>
                    <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-[var(--surface-muted)]" onClick={() => { void toggleBlock(); setMenuOpen(false); }}>
                      {d.bookingAccess.publicBookingBlocked ? "Unblock online booking" : "Block online booking"}
                    </button>
                    <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-[var(--surface-muted)]" onClick={() => { void archiveClient(); setMenuOpen(false); }}>
                      Archive
                    </button>
                    <Link href={`/contacts/${clientId}`} className="block px-3 py-1.5 hover:bg-[var(--surface-muted)]" onClick={() => setMenuOpen(false)}>
                      Open in Contacts
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto border-t border-[var(--border)] pt-2" aria-label="Client sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`whitespace-nowrap rounded px-3 py-1.5 text-xs ${section === s.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"}`}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </header>

        {error && <p className="px-4 py-2 text-sm text-red-600 lg:px-6" role="alert">{error}</p>}

        <div className="p-4 lg:p-6">
          {section === "overview" && (
            <div className="grid grid-cols-12 gap-3 text-xs">
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-7">
                <h2 className="font-semibold">Next appointment</h2>
                {d.nextAppointment ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-medium">{d.nextAppointment.serviceName}</p>
                    <p>{fmt(d.nextAppointment.startsAt)}</p>
                    <p className="text-[var(--text-muted)]">{d.nextAppointment.staffName || "—"} · {d.nextAppointment.location || "—"}</p>
                    <p>Status: {d.nextAppointment.status}</p>
                    <p>
                      Payment: {money(d.nextAppointment.amountPaidCents)} paid
                      {d.nextAppointment.balanceDueCents > 0 ? ` · ${money(d.nextAppointment.balanceDueCents)} due` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link href={`/appointments/${d.nextAppointment.id}`} className="text-[var(--accent)]">Open appointment</Link>
                      <Link href={`/appointments/${d.nextAppointment.id}?action=reschedule`} className="text-[var(--accent)]">Reschedule</Link>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[var(--text-muted)]">No upcoming appointments. <Link href={bookHref} className="text-[var(--accent)]">Book appointment</Link></p>
                )}
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-5">
                <h2 className="font-semibold">Client summary</h2>
                <ul className="mt-2 space-y-1 text-[var(--text-muted)]">
                  <li>Client since {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</li>
                  <li>Total bookings {d.bookingStats.upcoming + d.bookingStats.completed + d.bookingStats.cancelled + d.bookingStats.noShow}</li>
                  <li>No-shows {d.bookingStats.noShow}</li>
                  <li>Cancellations {d.bookingStats.cancelled}</li>
                </ul>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <h2 className="font-semibold">Bookings</h2>
                <p className="mt-2">Upcoming {d.bookingStats.upcoming}</p>
                <p>Completed {d.bookingStats.completed}</p>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <h2 className="font-semibold">Balance</h2>
                <p className="mt-2">Outstanding {money(d.balance.outstandingCents)}</p>
                <p>Account credit {money(d.balance.walletCreditCents)}</p>
                {d.balance.lastPayment && <p className="text-[var(--text-muted)]">Last payment {fmt(d.balance.lastPayment.at)} · {money(d.balance.lastPayment.amountCents)}</p>}
                <Link href={posHref} className="mt-2 inline-block text-[var(--accent)]">Collect / POS</Link>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <h2 className="font-semibold">Access</h2>
                <p className="mt-2">{d.access.packages.length} package(s)</p>
                <p>{d.access.memberships.length} membership(s)</p>
                <button type="button" className="mt-2 text-[var(--accent)]" onClick={() => setSection("access")}>View access</button>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-7">
                <h2 className="font-semibold">Outstanding actions</h2>
                {d.outstandingActions.length ? (
                  <ul className="mt-2 space-y-2">
                    {d.outstandingActions.map((a) => (
                      <li key={a.id} className="flex justify-between gap-2 border-b border-[var(--border)] pb-2">
                        <span>{a.label} — {a.detail}</span>
                        <Link href={a.href} className="text-[var(--accent)]">Open</Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[var(--text-muted)]">None right now.</p>
                )}
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-5">
                <h2 className="font-semibold">Recent activity</h2>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {d.activity.slice(0, 8).map((ev, i) => (
                    <li key={`${ev.at}-${i}`} className="flex justify-between gap-2 text-[var(--text-muted)]">
                      <span>{ev.label}</span>
                      <span>{new Date(ev.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </li>
                  ))}
                  {!d.activity.length && <li>No activity yet.</li>}
                </ul>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <h2 className="font-semibold">Account</h2>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="flex justify-between"><dt>Portal</dt><dd className="text-[var(--text-muted)]">Next pass</dd></div>
                  <div className="flex justify-between"><dt>Booking access</dt><dd>{d.bookingAccess.publicBookingBlocked ? "Online blocked" : "Allowed"}</dd></div>
                  <div className="flex justify-between"><dt>Canonical contact</dt><dd><Link href={`/contacts/${clientId}`} className="text-[var(--accent)]">Contacts record</Link></dd></div>
                </dl>
              </section>
            </div>
          )}

          {section === "appointments" && (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1">
                  {(["upcoming", "past", "all"] as const).map((f) => (
                    <button key={f} type="button" className={`rounded px-2 py-1 text-xs capitalize ${apptFilter === f ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "border border-[var(--border)]"}`} onClick={() => setApptFilter(f)}>
                      {f}
                    </button>
                  ))}
                </div>
                <Link href={bookHref} className="appt-pilot-primary-btn text-xs">Book appointment</Link>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-2">Date / time</th>
                      <th className="px-3 py-2">Offering</th>
                      <th className="px-3 py-2">Staff</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Payment</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppts.map((a) => (
                      <tr key={a.id} className="border-b border-[var(--border)]">
                        <td className="px-3 py-2">{fmt(a.startsAt)}</td>
                        <td className="px-3 py-2">{a.serviceName}</td>
                        <td className="px-3 py-2">{a.staffName || "—"}</td>
                        <td className="px-3 py-2">{a.location || "—"}</td>
                        <td className="px-3 py-2">{a.status}</td>
                        <td className="px-3 py-2">{a.balanceDueCents > 0 ? `${money(a.balanceDueCents)} due` : "Paid"}</td>
                        <td className="px-3 py-2 text-right">
                          <Link href={`/appointments/${a.id}`} className="text-[var(--accent)]">Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredAppts.length && <p className="p-4 text-[var(--text-muted)]">No appointments in this view.</p>}
              </div>
            </div>
          )}

          {section === "forms" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {d.forms.map((f) => (
                    <tr key={f.id} className="border-b border-[var(--border)]">
                      <td className="px-3 py-2">{f.formName}</td>
                      <td className="px-3 py-2">{f.status}</td>
                      <td className="px-3 py-2">{f.submittedAt ? fmt(f.submittedAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!d.forms.length && <p className="p-4 text-[var(--text-muted)]">No form submissions yet.</p>}
            </div>
          )}

          {section === "access" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <h2 className="font-semibold">Packages</h2>
                <ul className="mt-2 space-y-2 text-xs">
                  {d.access.packages.map((p) => (
                    <li key={p.id} className="flex justify-between border-b border-[var(--border)] pb-2">
                      <span>{p.remaining} credits · {p.status}</span>
                      <span className="text-[var(--text-muted)]">{p.expiresAt ? `Expires ${new Date(p.expiresAt).toLocaleDateString()}` : ""}</span>
                    </li>
                  ))}
                  {!d.access.packages.length && <li className="text-[var(--text-muted)]">No packages.</li>}
                </ul>
                <Link href={posHref} className="mt-2 inline-block text-[var(--accent)]">Sell package (POS)</Link>
              </section>
              <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <h2 className="font-semibold">Memberships</h2>
                <ul className="mt-2 space-y-2 text-xs">
                  {d.access.memberships.map((m) => (
                    <li key={m.id} className="flex justify-between border-b border-[var(--border)] pb-2">
                      <span>{m.status}</span>
                      <span className="text-[var(--text-muted)]">{m.billingInterval || ""}</span>
                    </li>
                  ))}
                  {!d.access.memberships.length && <li className="text-[var(--text-muted)]">No memberships.</li>}
                </ul>
              </section>
            </div>
          )}

          {section === "payments" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
                <span>Lifetime (recent) {d.transactions.reduce((s, t) => s + t.amountCents, 0) > 0 ? money(d.transactions.reduce((s, t) => s + t.amountCents, 0)) : "—"}</span>
                <span>Outstanding {money(d.balance.outstandingCents)}</span>
                <span>Credit {money(d.balance.walletCreditCents)}</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.transactions.map((t) => (
                      <tr key={t.id} className="border-b border-[var(--border)]">
                        <td className="px-3 py-2">{fmt(t.at)}</td>
                        <td className="px-3 py-2">{t.description}</td>
                        <td className="px-3 py-2">{money(t.amountCents)}</td>
                        <td className="px-3 py-2">{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!d.transactions.length && <p className="p-4 text-[var(--text-muted)]">No transactions yet.</p>}
              </div>
            </div>
          )}

          {section === "messages" && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
              <p className="text-[var(--text-muted)]">Use the canonical inbox for full thread history.</p>
              <Link href={messageHref} className="mt-3 inline-block appt-pilot-primary-btn text-xs">Open messages</Link>
            </div>
          )}

          {section === "notes" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <h2 className="font-semibold text-sm">Internal notes</h2>
                <textarea className="mt-2 w-full rounded border border-[var(--border)] p-2 text-xs" rows={3} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Staff-only note" />
                <button type="button" className="mt-2 appt-pilot-primary-btn text-xs" onClick={() => void addNote()}>Add note</button>
                <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs">
                  {d.notes.map((n) => (
                    <li key={n.id} className="rounded border border-[var(--border)] p-2">
                      <p>{n.body}</p>
                      <p className="text-[var(--text-muted)]">{new Date(n.at).toLocaleString()}{n.author ? ` · ${n.author}` : ""}</p>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <h2 className="font-semibold text-sm">Activity</h2>
                <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto text-xs text-[var(--text-muted)]">
                  {d.activity.map((ev, i) => (
                    <li key={`${ev.at}-${i}`}>{new Date(ev.at).toLocaleString()} — {ev.label}</li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {section === "profile" && (
            <div className="max-w-xl space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
              <h2 className="font-semibold text-sm">Profile</h2>
              {(["firstName", "lastName", "email", "phone", "timezone"] as const).map((field) => (
                <label key={field} className="block">
                  <span className="capitalize text-[var(--text-muted)]">{field.replace(/([A-Z])/g, " $1")}</span>
                  <input
                    className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5"
                    value={profileDraft[field] ?? (c[field] as string) ?? ""}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, [field]: e.target.value }))}
                  />
                </label>
              ))}
              <button type="button" className="appt-pilot-primary-btn" onClick={() => void saveProfile()}>Save profile</button>
              <p className="text-[var(--text-muted)]">Email and phone changes affect booking identity matching and future portal login.</p>
            </div>
          )}
        </div>
      </div>

      {mergeOpen && (
        <MergeClientsModal
          primaryClientId={clientId}
          onClose={() => setMergeOpen(false)}
          onMerged={(id) => {
            setMergeOpen(false);
            router.replace(`/appointments/clients/${id}`);
            void detail.reload();
          }}
        />
      )}
    </div>
  );
}
