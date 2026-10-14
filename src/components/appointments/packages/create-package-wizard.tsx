"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Layers,
  Minus,
  Package,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  EMPTY_PACKAGE_FORM,
  applyPackageSellTemplate,
  buildCreditRules,
  formatMoney,
  itemizedQuantityKey,
  packageSavePayload,
  validatePackageForm,
  type PackageFormState,
  type PackageSellTemplate,
} from "@/lib/appointments/packages/package-form";
import { usePackageEditor } from "@/features/appointments/kimi/packages/use-package-editor";
import type { OfferingOption } from "@/features/appointments/kimi/packages/use-package-editor";
import { SchedulingWizardShell } from "@/components/appointments/scheduling-opus/scheduling-wizard-shell";
import { PackageLivePreview } from "@/components/appointments/scheduling-opus/package-live-preview";
import { OfferingPickerSheet } from "@/components/appointments/scheduling-opus/offering-picker-sheet";
import { OPUS_CARD, OPUS_CONFIG_INSET } from "@/newui-transplant/components/app/opus-surfaces";
import { Callout, OpusIconBadge, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { Textarea } from "@/newui-transplant/components/ui/textarea";
import { cn } from "@/lib/utils";
import { OpusCoverImageUploader } from "@/components/appointments/scheduling-opus/opus-cover-image-uploader";

const API = "/api/appointments/service-booking/packages";
const DRAFT_STORAGE_KEY = "transovo-package-wizard-draft";

const STEPS = [
  { id: "type", label: "Package type", icon: Package },
  { id: "included", label: "What's included", icon: Layers },
  { id: "pricing", label: "Pricing and rules", icon: Wallet },
  { id: "review", label: "Review and publish", icon: ClipboardCheck },
] as const;

const TEMPLATE_OPTIONS: {
  id: PackageSellTemplate;
  title: string;
  description: string;
  example: string;
}[] = [
  {
    id: "prepaid_sessions",
    title: "Prepaid sessions",
    description: "Customers get a pool of appointments to use on eligible services.",
    example: "Example: five tutoring sessions",
  },
  {
    id: "mixed_bundle",
    title: "Bundle of services and classes",
    description: "Each included offering has its own quantity — great for training bundles.",
    example: "Example: 1 cyber class, 1 Python course, 3 tutoring sessions",
  },
];

function offeringListKey(offering: OfferingOption): keyof PackageFormState {
  if (offering.kind === "service") return "eligibleServiceIds";
  if (offering.kind === "meeting") return "eligibleMeetingIds";
  if (offering.kind === "workshop") return "eligibleWorkshopIds";
  return "eligibleClassIds";
}

function loadDraft(): PackageFormState | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PackageFormState;
  } catch {
    return null;
  }
}

function persistDraft(form: PackageFormState) {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
  } catch {
    /* ignore */
  }
}

export function CreatePackageWizard() {
  const router = useRouter();
  const editor = usePackageEditor(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PackageFormState>(() => loadDraft() ?? EMPTY_PACKAGE_FORM);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [published, setPublished] = useState<{ id: string; slug: string } | null>(null);

  const creditRules = useMemo(() => buildCreditRules(form), [form]);

  useEffect(() => {
    persistDraft(form);
  }, [form]);

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

  const addOffering = useCallback((offering: OfferingOption) => {
    toggleOffering(offering, false);
  }, [toggleOffering]);

  const setItemizedQty = useCallback((offering: OfferingOption, quantity: number) => {
    const qtyKey = itemizedQuantityKey(offering.kind, offering.id);
    setForm((prev) => ({
      ...prev,
      itemizedQuantities: { ...prev.itemizedQuantities, [qtyKey]: Math.max(1, quantity) },
    }));
  }, []);

  const includedOfferings = useMemo(
    () =>
      editor.options.offerings.filter((o) => {
        const listKey = offeringListKey(o);
        return (form[listKey] as string[]).includes(o.id);
      }),
    [editor.options.offerings, form],
  );

  const selectedIds = useMemo(() => new Set(includedOfferings.map((o) => o.id)), [includedOfferings]);

  const savePackage = useCallback(
    async (publish: boolean) => {
      const draftForm = publish ? { ...form, active: true, directPurchase: true } : { ...form, active: false };
      const validation = validatePackageForm(draftForm);
      if (validation) {
        setError(validation);
        return;
      }
      setBusy(true);
      setError("");
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(packageSavePayload(draftForm)),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { id: string; slug: string };
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Save failed");
        if (publish) {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
          setPublished({ id: json.data!.id, slug: json.data!.slug });
        } else {
          router.replace(`/appointments/packages/${json.data!.id}?draft=1`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
    [form, router],
  );

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(form.name.trim()) && form.sellTemplate;
    if (step === 1) return includedOfferings.length > 0;
    if (step === 2) return form.priceCents >= 0;
    return true;
  }, [step, form, includedOfferings.length]);

  const continueDisabledReason =
    step === 0 && !form.name.trim()
      ? "Enter a package name"
      : step === 1 && includedOfferings.length === 0
        ? "Add at least one service or class"
        : "";

  if (published) {
    const storeUrl = editor.options.workspaceSlug
      ? `/book/${editor.options.workspaceSlug}/store`
      : "/appointments/booking/share";
    return (
      <SchedulingWizardShell
        backHref="/appointments/packages"
        backLabel="Packages"
        title="Package published"
        description="Your package is live. Share the purchase link or keep editing."
        steps={STEPS}
        currentStep={3}
        editor={
          <Callout tone="success" title="Ready to sell">
            <p className="text-sm">{form.name} is published and visible on your storefront when direct purchase is enabled.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link href={storeUrl} target="_blank" rel="noreferrer">View storefront</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const url = `${window.location.origin}${storeUrl}`;
                  void navigator.clipboard.writeText(url);
                }}
              >
                Copy purchase link
              </Button>
              <Button asChild variant="outline">
                <Link href="/appointments/packages/new">Create another package</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/appointments/packages/${published.id}`}>Manage package</Link>
              </Button>
            </div>
          </Callout>
        }
        preview={<PackageLivePreview form={form} includedOfferings={includedOfferings} mode="published" />}
        footerLeft={null}
        footerRight={null}
      />
    );
  }

  const editorPanel = (
    <>
      {error ? (
        <Callout tone="error" title="Could not save">
          {error}
        </Callout>
      ) : null}

      {step === 0 ? (
        <section className="space-y-6">
          <div>
          <h2 className="text-lg font-semibold">What kind of package are you creating?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose a template, then name your package and add a short customer-facing description.
          </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {TEMPLATE_OPTIONS.map((t) => {
              const selected = form.sellTemplate === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    "flex min-h-[12.5rem] flex-col rounded-xl border-2 p-4 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/[0.06] ring-2 ring-primary/20"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                  aria-pressed={selected}
                  onClick={() => selectTemplate(t.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <OpusIconBadge icon={Package} className="size-10 rounded-xl bg-primary/12" />
                    {selected ? <Check className="size-5 text-primary" aria-hidden /> : null}
                  </div>
                  <span className="mt-3 font-semibold">{t.title}</span>
                  <span className="mt-1 text-sm text-muted-foreground">{t.description}</span>
                  <span className="mt-3 text-xs text-muted-foreground">{t.example}</span>
                </button>
              );
            })}
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pkg-name">Package name</Label>
              <Input
                id="pkg-name"
                className="h-11 w-full"
                value={form.name}
                onChange={(e) => onFormChange("name", e.target.value)}
                placeholder="IT Career Starter Package"
              />
            </div>
            {form.packageKind === "pooled" ? (
              <div className="scheduling-wizard-editor-compact-field space-y-2">
                <Label htmlFor="pkg-sessions">How many sessions?</Label>
                <Input
                  id="pkg-sessions"
                  type="number"
                  min={1}
                  className="h-11"
                  value={form.totalCredits}
                  onChange={(e) => onFormChange("totalCredits", Number(e.target.value) || 1)}
                />
              </div>
            ) : null}
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="pkg-desc">Short description (optional)</Label>
            <Textarea
              id="pkg-desc"
              rows={3}
              value={form.description}
              onChange={(e) => onFormChange("description", e.target.value)}
            />
          </div>
          <div className="mt-6 max-w-md">
            <OpusCoverImageUploader
              value={form.imageUrl}
              onChange={(url) => onFormChange("imageUrl", url)}
              category="package"
            />
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Add what customers receive</h2>
            <Button type="button" onClick={() => setPickerOpen(true)}>
              <Plus className="mr-2 size-4" aria-hidden />
              Add service or class
            </Button>
          </div>
          <ul className="mt-4 space-y-3">
            {includedOfferings.length === 0 ? (
              <li className={cn(OPUS_CONFIG_INSET, "p-8 text-center text-sm text-muted-foreground")}>
                Nothing added yet. Use the button above to include services, classes, or courses.
              </li>
            ) : (
              includedOfferings.map((o) => {
                const qty =
                  form.packageKind === "pooled"
                    ? form.totalCredits
                    : form.itemizedQuantities[itemizedQuantityKey(o.kind, o.id)] ?? 1;
                return (
                  <li
                    key={o.id}
                    className="flex min-h-[4.5rem] items-center gap-3 rounded-xl border bg-card px-3 py-3 shadow-[0_1px_2px_rgba(16,18,40,0.04)]"
                  >
                    <OpusIconBadge icon={Layers} className="size-10 shrink-0 rounded-lg bg-primary/10" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{o.name}</p>
                      <p className="text-xs text-muted-foreground">{o.meta}</p>
                      <Pill tone="neutral" dot={false} className="mt-1 inline-flex text-xs">
                        {o.kind}
                      </Pill>
                    </div>
                    {form.packageKind === "itemized" ? (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-9"
                          aria-label={`Decrease quantity for ${o.name}`}
                          onClick={() => setItemizedQty(o, qty - 1)}
                          disabled={qty <= 1}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <span className="w-8 text-center tabular-nums text-sm font-medium">{qty}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-9"
                          aria-label={`Increase quantity for ${o.name}`}
                          onClick={() => setItemizedQty(o, qty + 1)}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-9 text-muted-foreground"
                      aria-label={`Remove ${o.name}`}
                      onClick={() => toggleOffering(o, true)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-8">
          <div>
            <h3 className="font-semibold">Package price</h3>
            <div className="mt-3 flex max-w-xs items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="h-11"
                value={(form.priceCents / 100).toFixed(2)}
                onChange={(e) =>
                  onFormChange("priceCents", Math.round((Number(e.target.value) || 0) * 100))
                }
              />
            </div>
          </div>
          <div className="border-t pt-6">
            <h3 className="font-semibold">Validity</h3>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["none", "Never expires"],
                  ["days", "Expires after purchase"],
                  ["fixed", "Fixed expiration date"],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="expiration"
                    checked={form.expirationMode === mode}
                    onChange={() => onFormChange("expirationMode", mode)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {form.expirationMode === "days" ? (
              <div className="mt-3 max-w-xs">
                <Label htmlFor="exp-days">Days after purchase</Label>
                <Input
                  id="exp-days"
                  type="number"
                  min={1}
                  className="mt-1 h-11"
                  value={form.expirationDays}
                  onChange={(e) => onFormChange("expirationDays", Number(e.target.value) || 1)}
                />
              </div>
            ) : null}
            {form.expirationMode === "fixed" ? (
              <div className="mt-3 max-w-xs">
                <Label htmlFor="exp-date">Expiration date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  className="mt-1 h-11"
                  value={form.expirationDate}
                  onChange={(e) => onFormChange("expirationDate", e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <div className="border-t pt-6">
            <h3 className="font-semibold">Visibility</h3>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.directPurchase}
                onChange={(e) => onFormChange("directPurchase", e.target.checked)}
              />
              Show on public storefront (direct purchase)
            </label>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">Review and publish</h2>
          {[
            { title: "Package", step: 0, body: form.name },
            {
              title: "Included",
              step: 1,
              body: `${includedOfferings.length} offering${includedOfferings.length === 1 ? "" : "s"}`,
            },
            { title: "Price", step: 2, body: formatMoney(form.priceCents) },
          ].map((block) => (
            <div key={block.title} className="flex items-start justify-between gap-4 border-b pb-4 last:border-0">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">{block.title}</p>
                <p className="mt-1 font-medium">{block.body}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(block.step)}>
                Edit
              </Button>
            </div>
          ))}
          <ul className="text-sm text-muted-foreground">
            {includedOfferings.map((o) => (
              <li key={o.id}>
                {o.name} — ×
                {form.packageKind === "itemized"
                  ? form.itemizedQuantities[itemizedQuantityKey(o.kind, o.id)] ?? 1
                  : form.totalCredits}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <OfferingPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        offerings={editor.options.offerings}
        selectedIds={selectedIds}
        onAdd={addOffering}
      />
    </>
  );

  return (
    <SchedulingWizardShell
      backHref="/appointments/packages"
      backLabel="Packages"
      title="Create a package"
      description="Bundle services and classes customers can purchase once and book over time."
      headerAction={
        <Button type="button" variant="outline" disabled={busy} onClick={() => void savePackage(false)}>
          Save draft
        </Button>
      }
      steps={[...STEPS]}
      currentStep={step}
      onStepSelect={(i) => i <= step && setStep(i)}
      editor={editorPanel}
      preview={<PackageLivePreview form={form} includedOfferings={includedOfferings} />}
      footerLeft={
        <Button type="button" variant="outline" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
      }
      footerRight={
        step < STEPS.length - 1 ? (
          <div className="flex flex-col items-end gap-1">
            {continueDisabledReason ? (
              <span className="text-xs text-muted-foreground">{continueDisabledReason}</span>
            ) : null}
            <Button type="button" disabled={!canContinue || busy} onClick={() => setStep((s) => s + 1)}>
              Continue
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void savePackage(false)}>
              Save draft
            </Button>
            <Button type="button" disabled={busy} onClick={() => void savePackage(true)}>
              <Check className="mr-2 size-4" aria-hidden />
              {busy ? "Publishing…" : "Publish package"}
            </Button>
          </div>
        )
      }
    />
  );
}
