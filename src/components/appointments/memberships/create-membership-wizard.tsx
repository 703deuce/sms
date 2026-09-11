"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  CreditCard,
  Layers,
  Wallet,
} from "lucide-react";
import {
  EMPTY_MEMBERSHIP_FORM,
  membershipSavePayload,
  validateMembershipForm,
  type MembershipFormState,
  accessSummary,
  formatBillingInterval,
  formatMoney,
} from "@/lib/appointments/memberships/membership-form";
import { Field, Panel, TextArea, TextInput } from "@/components/appointments/workspace-ui";
import { MembershipAccessSection } from "./membership-access-section";
import { buildMembershipBenefits } from "@/lib/appointments/memberships/membership-form";
import { useMembershipEditor } from "@/features/appointments/kimi/memberships/use-membership-editor";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS = "appt-overview-pilot bookable-workspace-pilot ws-pilot ref-root";
const API = "/api/appointments/service-booking/memberships";

const STEPS = [
  { label: "Basics", icon: CreditCard },
  { label: "Access", icon: Layers },
  { label: "Price & billing", icon: Wallet },
  { label: "Review", icon: ClipboardCheck },
] as const;

export function CreateMembershipWizard() {
  const router = useRouter();
  const editor = useMembershipEditor(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<MembershipFormState>(EMPTY_MEMBERSHIP_FORM);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const benefits = useMemo(() => buildMembershipBenefits(form), [form]);
  const access = useMemo(() => accessSummary(form), [form]);

  const onFormChange = useCallback(<K extends keyof MembershipFormState>(key: K, value: MembershipFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleOffering = useCallback(
    (offering: (typeof editor.options.offerings)[number], included: boolean) => {
      const key =
        offering.kind === "service"
          ? "eligibleServiceIds"
          : offering.kind === "meeting"
            ? "eligibleMeetingIds"
            : offering.kind === "workshop"
              ? "eligibleWorkshopIds"
              : "eligibleClassIds";
      setForm((prev) => {
        const current = prev[key];
        const next = included
          ? current.filter((id) => id !== offering.id)
          : [...current, offering.id];
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const createMembership = useCallback(async () => {
    const validation = validateMembershipForm(form);
    if (validation) {
      setError(validation);
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(membershipSavePayload(form)),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error || "Create failed");
      router.replace(`/appointments/memberships/${json.data!.id}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }, [form, router]);

  const dollars = (form.priceCents / 100).toFixed(2);

  return (
    <div className={`${SHELL_CLASS} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-4 py-5 lg:px-6">
        <header className="ws-event-head">
          <div className="ws-event-head-main">
            <Link href="/appointments/memberships" className="ws-text-btn">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Memberships
            </Link>
            <div>
              <h1 className="ws-event-title">Create membership</h1>
              <p className="ws-event-subtitle">Sell recurring access and benefits.</p>
            </div>
          </div>
        </header>

        <nav className="ws-wizard-steps" aria-label="Create membership steps">
          {STEPS.map((s, index) => (
            <button
              key={s.label}
              type="button"
              className={`ws-wizard-step${step === index ? " is-active" : step > index ? " is-done" : ""}`}
              onClick={() => setStep(index)}
            >
              <s.icon className="h-4 w-4" aria-hidden />
              {s.label}
            </button>
          ))}
        </nav>

        {error ? <p className="ws-inline-error" role="alert">{error}</p> : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            {step === 0 ? (
              <Panel title="Basics" icon={CreditCard}>
                <Field label="Membership name" htmlFor="wiz-name">
                  <TextInput
                    id="wiz-name"
                    value={form.name}
                    onChange={(e) => onFormChange("name", e.target.value)}
                  />
                </Field>
                <div className="mt-3">
                  <Field label="Description" htmlFor="wiz-desc">
                    <TextArea
                      id="wiz-desc"
                      rows={3}
                      value={form.description}
                      onChange={(e) => onFormChange("description", e.target.value)}
                    />
                  </Field>
                </div>
              </Panel>
            ) : null}

            {step === 1 ? (
              <MembershipAccessSection
                benefits={benefits}
                offerings={editor.options.offerings}
                onToggle={toggleOffering}
              />
            ) : null}

            {step === 2 ? (
              <Panel title="Price & billing" icon={Wallet}>
                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label="Price" htmlFor="wiz-price">
                    <div className="ws-money-field">
                      <span aria-hidden>$</span>
                      <input
                        id="wiz-price"
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={dollars}
                        onChange={(e) =>
                          onFormChange("priceCents", Math.round((Number(e.target.value) || 0) * 100))
                        }
                      />
                    </div>
                  </Field>
                  <Field label="Billing interval" htmlFor="wiz-interval">
                    <select
                      id="wiz-interval"
                      className="input"
                      value={form.billingInterval}
                      onChange={(e) => onFormChange("billingInterval", e.target.value)}
                    >
                      <option value="month">Monthly</option>
                      <option value="quarter">Quarterly</option>
                      <option value="year">Annual</option>
                    </select>
                  </Field>
                </div>
              </Panel>
            ) : null}

            {step === 3 ? (
              <Panel title="Review" icon={ClipboardCheck}>
                <p className="text-[var(--type-section)] font-semibold">{form.name || "Membership"}</p>
                <p>{formatMoney(form.priceCents)} / {formatBillingInterval(form.billingInterval).toLowerCase()}</p>
                <p className="ws-stat-note">Includes: {access.label}</p>
                <p className="ws-stat-note">
                  Availability: {form.purchaseAvailability === "public" ? "Public" : "Hidden"}
                </p>
              </Panel>
            ) : null}
          </div>

          <aside className="ws-wizard-summary">
            <h2 className="ws-wizard-summary-title">Summary</h2>
            <p className="text-[var(--type-list)] font-medium">{form.name || "Untitled"}</p>
            <p className="ws-stat-note">{access.label}</p>
            <p className="ws-stat-note">
              {formatMoney(form.priceCents)} / {formatBillingInterval(form.billingInterval).toLowerCase()}
            </p>
          </aside>
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            className="ws-text-btn"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="appt-pilot-primary-btn" onClick={() => setStep((s) => s + 1)}>
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="appt-pilot-primary-btn"
              disabled={creating}
              onClick={() => void createMembership()}
            >
              Create membership
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
