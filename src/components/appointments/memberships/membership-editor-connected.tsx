"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import { useMembershipEditor } from "@/features/appointments/kimi/memberships/use-membership-editor";
import { membershipStatusLabel } from "@/lib/appointments/memberships/membership-display";
import {
  PilotInput,
  PilotLabel,
  PilotSelect,
  PilotTextarea,
  SectionCard,
} from "@/components/appointments/meetings/meeting-editor-sections";
import "@/components/appointments/kimi-ui/overview/reference.css";

type Props = { membershipId: string | null };

function contactName(c: { firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null } | null) {
  if (!c) return "Unknown";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || c.email || "Unknown";
}

export function MembershipEditorConnected({ membershipId }: Props) {
  const editor = useMembershipEditor(membershipId);
  const [assignOpen, setAssignOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [contactOptions, setContactOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);

  if (editor.loading) {
    return <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5 animate-pulse"><div className="h-8 w-64 rounded bg-gray-200" /></div>;
  }
  if (editor.failed) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 py-12 flex items-center justify-center">
        <p className="appt-pilot-text-section">Membership not found</p>
        <Link href="/appointments/memberships" className="appt-pilot-muted-link mt-4">Back to Memberships</Link>
      </div>
    );
  }

  const credits = editor.form.benefits.includedCredits || [];

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/memberships" className="appt-pilot-back-link"><ArrowLeft size={14} aria-hidden /> Memberships</Link>
      <RefDecoPageHeader
        title={editor.isCreating ? "Create membership" : editor.form.name}
        description="Define what members receive and how billing works."
        action={
          <button type="button" className="appt-pilot-primary-btn" disabled={editor.saving} onClick={() => void editor.save()}>
            <Save size={14} aria-hidden /> {editor.saving ? "Saving…" : "Save"}
          </button>
        }
      />
      {editor.error ? <p className="mb-4 text-[var(--state-error)]" role="alert">{editor.error}</p> : null}

      <div className="mt-6 space-y-5 max-w-3xl">
        <SectionCard id="mem-general" title="General" description="Membership basics">
          <PilotLabel>Membership name</PilotLabel>
          <PilotInput value={editor.form.name} onChange={(e) => editor.updateForm("name", e.target.value)} placeholder="Monthly Unlimited Classes" />
          <PilotLabel>Description</PilotLabel>
          <PilotTextarea rows={3} value={editor.form.description} onChange={(e) => editor.updateForm("description", e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <PilotLabel>Price</PilotLabel>
              <PilotInput type="number" min={0} step={0.01} value={(editor.form.priceCents / 100).toFixed(2)} onChange={(e) => editor.updateForm("priceCents", Math.round(Number(e.target.value) * 100) || 0)} />
            </div>
            <div>
              <PilotLabel>Billing frequency</PilotLabel>
              <PilotSelect value={editor.form.billingInterval} onChange={(e) => editor.updateForm("billingInterval", e.target.value)}>
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
              </PilotSelect>
            </div>
          </div>
          <label className="flex items-center gap-2 appt-pilot-text-list">
            <input type="checkbox" checked={editor.form.active} onChange={(e) => editor.updateForm("active", e.target.checked)} />
            Active — new members can join
          </label>
        </SectionCard>

        <SectionCard id="mem-benefits" title="Benefits" description="What do members get?">
          {credits.map((rule, index) => (
            <div key={index} className="mb-2 flex gap-2">
              <PilotInput type="number" min={1} className="w-24" value={rule.quantity} onChange={(e) => {
                const next = credits.map((r, i) => (i === index ? { ...r, quantity: Number(e.target.value) || 1 } : r));
                editor.updateBenefitCredits(next);
              }} />
              <PilotInput className="flex-1" value={rule.label || ""} onChange={(e) => {
                const next = credits.map((r, i) => (i === index ? { ...r, label: e.target.value } : r));
                editor.updateBenefitCredits(next);
              }} placeholder="e.g. Personal Training credits per month" />
              <button type="button" onClick={() => editor.updateBenefitCredits(credits.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" className="appt-pilot-muted-link flex items-center gap-1" onClick={() => editor.updateBenefitCredits([...credits, { quantity: 4, label: "Credits per month" }])}>
            <Plus size={14} /> Add benefit
          </button>
          <div className="mt-4">
            <PilotLabel>Member discount (%)</PilotLabel>
            <PilotInput type="number" min={0} max={100} value={editor.form.benefits.percentDiscount || ""} onChange={(e) => editor.updateForm("benefits", { ...editor.form.benefits, percentDiscount: Number(e.target.value) || undefined })} />
          </div>
        </SectionCard>

        <SectionCard id="mem-access" title="Access" description="What can only members book?">
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {editor.bookingTypeOptions.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-2 appt-pilot-text-list">
                  <input type="checkbox" checked={(editor.form.benefits.memberOnlyTypeIds || []).includes(t.id)} onChange={() => editor.toggleMemberOnly(t.id)} />
                  {t.name} — members only
                </label>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard id="mem-credits" title="Credits" description="When do credits refresh?">
          <label className="flex items-center gap-2 appt-pilot-text-list">
            <input type="checkbox" checked={editor.form.rolloverEnabled} onChange={(e) => editor.updateForm("rolloverEnabled", e.target.checked)} />
            Unused credits roll over
          </label>
          {editor.form.rolloverEnabled ? (
            <div className="mt-2">
              <PilotLabel>Rollover cap (optional)</PilotLabel>
              <PilotInput type="number" min={1} value={editor.form.rolloverCap ?? ""} onChange={(e) => editor.updateForm("rolloverCap", e.target.value ? Number(e.target.value) : null)} />
            </div>
          ) : null}
        </SectionCard>

        <SectionCard id="mem-billing" title="Billing & lifecycle" description="Payment provider and member status rules">
          {editor.paymentsConnected ? (
            <p className="appt-pilot-text-helper">Payment provider connected. Live subscriptions use your connected Stripe or Square account.</p>
          ) : (
            <p className="appt-pilot-text-helper">
              <Link href="/settings/business" className="appt-pilot-muted-link">Connect Stripe</Link> to charge members automatically.
            </p>
          )}
          <p className="appt-pilot-text-helper mt-2">Past due members may have benefits paused until payment is recovered.</p>
        </SectionCard>

        {!editor.isCreating ? (
          <SectionCard id="mem-members" title="Members" description="Current subscribers">
            <button type="button" className="appt-pilot-outline-btn mb-4" onClick={() => setAssignOpen(true)}>Subscribe member</button>
            {editor.subscriptions.length === 0 ? (
              <p className="appt-pilot-text-helper">No members yet.</p>
            ) : (
              <table className="appt-pilot-data-table">
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Status</th>
                    <th scope="col">Renews</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editor.subscriptions.map((s) => (
                    <tr key={s.id}>
                      <td>{contactName(s.contact)}</td>
                      <td>{membershipStatusLabel(s.status)}</td>
                      <td>{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {s.status === "active" ? (
                            <button type="button" className="appt-pilot-outline-btn !min-h-8 !px-2" onClick={() => void editor.subscriptionAction("pause_subscription", s.id)}>Pause</button>
                          ) : null}
                          {s.status === "paused" ? (
                            <button type="button" className="appt-pilot-outline-btn !min-h-8 !px-2" onClick={() => void editor.subscriptionAction("resume_subscription", s.id)}>Resume</button>
                          ) : null}
                          {s.status !== "canceled" ? (
                            <button type="button" className="appt-pilot-outline-btn !min-h-8 !px-2" onClick={() => void editor.subscriptionAction("cancel_subscription", s.id, "immediate")}>Cancel</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>
        ) : null}
      </div>

      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-5 shadow-xl">
            <h2 className="appt-pilot-text-section">Subscribe member</h2>
            <PilotInput className="mt-3" value={contactQuery} onChange={(e) => {
              setContactQuery(e.target.value);
              if (e.target.value.length >= 2) {
                void fetch(`/api/contacts?q=${encodeURIComponent(e.target.value)}`).then((r) => r.json()).then((json) => {
                  const rows = (json.data || json.contacts || json || []) as Array<{ id: string; firstName?: string; lastName?: string; phone?: string; email?: string }>;
                  setContactOptions(rows.slice(0, 8).map((c) => ({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || c.email || c.id })));
                });
              }
            }} placeholder="Search customer" />
            <ul className="mt-2 max-h-40 overflow-y-auto">{contactOptions.map((c) => (
              <li key={c.id}><button type="button" className="block w-full px-2 py-2 text-left hover:bg-[var(--surface-muted)]" onClick={() => { setSelectedContactId(c.id); setContactQuery(c.name); }}>{c.name}</button></li>
            ))}</ul>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setAssignOpen(false)}>Cancel</button>
              <button type="button" className="appt-pilot-primary-btn" disabled={!selectedContactId || busy} onClick={async () => { setBusy(true); const ok = await editor.subscribeMember(selectedContactId); setBusy(false); if (ok) setAssignOpen(false); }}>Subscribe</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
