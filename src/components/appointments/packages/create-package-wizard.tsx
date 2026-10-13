"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Layers,
  Package,
  Wallet,
} from "lucide-react";
import {
  EMPTY_PACKAGE_FORM,
  applyPackageSellTemplate,
  buildCreditRules,
  itemizedQuantityKey,
  packageSavePayload,
  validatePackageForm,
  type PackageFormState,
  type PackageSellTemplate,
} from "@/lib/appointments/packages/package-form";
import { Field, NumberField, Panel, TextArea, TextInput } from "@/components/appointments/workspace-ui";
import { PackageEligibilitySection } from "./package-eligibility-section";
import { usePackageEditor } from "@/features/appointments/kimi/packages/use-package-editor";
import type { OfferingOption } from "@/features/appointments/kimi/packages/use-package-editor";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS = "appt-overview-pilot bookable-workspace-pilot ws-pilot ref-root";
const API = "/api/appointments/service-booking/packages";

const SELL_TEMPLATES: {
  id: PackageSellTemplate;
  title: string;
  description: string;
}[] = [
  {
    id: "prepaid_sessions",
    title: "Prepaid sessions",
    description: "Example: five tutoring sessions customers can use on any eligible service.",
  },
  {
    id: "bundle_classes",
    title: "Bundle classes & workshops",
    description: "Example: IT career starter — one seat in each included course.",
  },
  {
    id: "mixed_bundle",
    title: "Mix services and classes",
    description: "Example: two consultations plus one workshop, each with its own quantity.",
  },
];

const STEPS = [
  { label: "What you sell", icon: Package },
  { label: "What's included", icon: Layers },
  { label: "Price & validity", icon: Wallet },
  { label: "Review", icon: ClipboardCheck },
] as const;

function offeringListKey(offering: OfferingOption): keyof PackageFormState {
  if (offering.kind === "service") return "eligibleServiceIds";
  if (offering.kind === "meeting") return "eligibleMeetingIds";
  if (offering.kind === "workshop") return "eligibleWorkshopIds";
  return "eligibleClassIds";
}

export function CreatePackageWizard() {
  const router = useRouter();
  const editor = usePackageEditor(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PackageFormState>(EMPTY_PACKAGE_FORM);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const creditRules = useMemo(() => buildCreditRules(form), [form]);

  const onFormChange = useCallback(<K extends keyof PackageFormState>(key: K, value: PackageFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const selectTemplate = useCallback((template: PackageSellTemplate) => {
    setForm((prev) => applyPackageSellTemplate(template, prev));
  }, []);

  const toggleOffering = useCallback((offering: OfferingOption, included: boolean) => {
    const listKey = offeringListKey(offering);
    const qtyKey = itemizedQuantityKey(offering.kind, offering.id);
    setForm((prev) => {
      const current = prev[listKey] as string[];
      const nextIds = included
        ? current.filter((id) => id !== offering.id)
        : [...current, offering.id];
      const nextQty = { ...prev.itemizedQuantities };
      if (!included) {
        nextQty[qtyKey] = nextQty[qtyKey] ?? 1;
      } else {
        delete nextQty[qtyKey];
      }
      return { ...prev, [listKey]: nextIds, itemizedQuantities: nextQty };
    });
  }, []);

  const setItemizedQty = useCallback((offering: OfferingOption, quantity: number) => {
    const qtyKey = itemizedQuantityKey(offering.kind, offering.id);
    setForm((prev) => ({
      ...prev,
      itemizedQuantities: { ...prev.itemizedQuantities, [qtyKey]: Math.max(1, quantity) },
    }));
  }, []);

  const includedOfferings = useMemo(
    () => editor.options.offerings.filter((o) => {
      const listKey = offeringListKey(o);
      return (form[listKey] as string[]).includes(o.id);
    }),
    [editor.options.offerings, form],
  );

  const createPackage = useCallback(async () => {
    const validation = validatePackageForm(form);
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
        body: JSON.stringify(packageSavePayload(form)),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error || "Create failed");
      router.replace(`/appointments/packages/${json.data!.id}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }, [form, router]);

  return (
    <div className={`${SHELL_CLASS} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-4 py-5 lg:px-6">
        <header className="ws-event-head">
          <div className="ws-event-head-main">
            <Link href="/appointments/packages" className="ws-text-btn">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Packages
            </Link>
            <div>
              <h1 className="ws-event-title">Create package</h1>
              <p className="ws-event-subtitle">
                Answer a few business questions — we configure credits and eligibility for you.
              </p>
            </div>
          </div>
        </header>

        <nav className="ws-wizard-steps" aria-label="Create package steps">
          {STEPS.map((s, index) => (
            <button
              key={s.label}
              type="button"
              className="ws-wizard-step"
              aria-current={step === index ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              <s.icon className="h-4 w-4" aria-hidden />
              {s.label}
            </button>
          ))}
        </nav>

        {error ? <p className="ws-inline-error" role="alert">{error}</p> : null}

        {step === 0 ? (
          <Panel title="What are you selling?" icon={Package}>
            <div className="grid gap-3 lg:grid-cols-3">
              {SELL_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="ws-card-btn text-left"
                  aria-pressed={form.sellTemplate === t.id}
                  onClick={() => selectTemplate(t.id)}
                >
                  <span className="ws-row-primary">{t.title}</span>
                  <span className="ws-row-secondary">{t.description}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <Field label="Package name" htmlFor="wiz-name">
                <TextInput
                  id="wiz-name"
                  value={form.name}
                  onChange={(e) => onFormChange("name", e.target.value)}
                  placeholder="IT Career Starter Package"
                />
              </Field>
              {form.packageKind === "pooled" ? (
                <Field label="How many sessions?" htmlFor="wiz-credits">
                  <NumberField
                    id="wiz-credits"
                    min={1}
                    suffix={form.creditUnitLabel}
                    value={form.totalCredits}
                    onChange={(e) => onFormChange("totalCredits", Number(e.target.value) || 1)}
                  />
                </Field>
              ) : (
                <p className="ws-stat-note self-end">
                  You will set how many of each class or service is included on the next step.
                </p>
              )}
            </div>
            <Field label="Customer-facing description" htmlFor="wiz-desc">
              <TextArea
                id="wiz-desc"
                rows={3}
                value={form.description}
                onChange={(e) => onFormChange("description", e.target.value)}
              />
            </Field>
          </Panel>
        ) : null}

        {step === 1 ? (
          <>
            <PackageEligibilitySection
              creditRules={creditRules}
              offerings={editor.options.offerings}
              onToggle={toggleOffering}
            />
            {form.packageKind === "itemized" && includedOfferings.length > 0 ? (
              <Panel title="How many of each?" icon={Layers}>
                <ul className="ws-review-list">
                  {includedOfferings.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{o.name}</span>
                      <NumberField
                        aria-label={`Quantity for ${o.name}`}
                        min={1}
                        suffix="included"
                        value={form.itemizedQuantities[itemizedQuantityKey(o.kind, o.id)] ?? 1}
                        onChange={(e) => setItemizedQty(o, Number(e.target.value) || 1)}
                      />
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <Panel title="Price & validity" icon={Wallet}>
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
                    value={(form.priceCents / 100).toFixed(2)}
                    onChange={(e) =>
                      onFormChange("priceCents", Math.round((Number(e.target.value) || 0) * 100))
                    }
                  />
                </div>
              </Field>
              <Field label="Expires after" htmlFor="wiz-exp">
                <NumberField
                  id="wiz-exp"
                  min={1}
                  suffix="days"
                  value={form.expirationDays}
                  onChange={(e) => {
                    onFormChange("expirationDays", Number(e.target.value) || 1);
                    onFormChange("expirationMode", "days");
                  }}
                />
              </Field>
            </div>
          </Panel>
        ) : null}

        {step === 3 ? (
          <Panel title="Review" icon={ClipboardCheck}>
            <ul className="ws-review-list">
              <li><strong>{form.name || "Untitled package"}</strong></li>
              <li>
                {form.packageKind === "pooled"
                  ? `${form.totalCredits} ${form.creditUnitLabel} (any eligible booking)`
                  : `${creditRules.filter((r) => r.quantity > 0).length} included items`}
              </li>
              <li>
                {includedOfferings.length} offering{includedOfferings.length === 1 ? "" : "s"} in catalog
              </li>
              <li>${(form.priceCents / 100).toFixed(2)}</li>
              <li>{form.expirationMode === "days" ? `${form.expirationDays} days after purchase` : "No expiration"}</li>
            </ul>
          </Panel>
        ) : null}

        <div className="flex justify-between">
          <button
            type="button"
            className="appt-pilot-outline-btn"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="appt-pilot-primary-btn"
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="appt-pilot-primary-btn"
              disabled={creating}
              onClick={() => void createPackage()}
            >
              <Check className="h-4 w-4" aria-hidden />
              {creating ? "Creating…" : "Publish package"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
