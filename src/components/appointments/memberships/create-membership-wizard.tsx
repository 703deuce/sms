"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ClipboardCheck,
  CreditCard,
  Layers,
  Plus,
  Trash2,
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
import { useMembershipEditor } from "@/features/appointments/kimi/memberships/use-membership-editor";
import type { OfferingOption } from "@/features/appointments/kimi/memberships/use-membership-editor";
import { SchedulingWizardShell } from "@/components/appointments/scheduling-opus/scheduling-wizard-shell";
import { MembershipLivePreview } from "@/components/appointments/scheduling-opus/membership-live-preview";
import { OfferingPickerSheet } from "@/components/appointments/scheduling-opus/offering-picker-sheet";
import { OpusCoverImageUploader } from "@/components/appointments/scheduling-opus/opus-cover-image-uploader";
import { OPUS_CARD, OPUS_CONFIG_INSET } from "@/newui-transplant/components/app/opus-surfaces";
import { Callout, OpusIconBadge, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { Textarea } from "@/newui-transplant/components/ui/textarea";
import { cn } from "@/lib/utils";

const API = "/api/appointments/service-booking/memberships";
const DRAFT_STORAGE_KEY = "transovo-membership-wizard-draft";

const STEPS = [
  { id: "details", label: "Details", icon: CreditCard },
  { id: "benefits", label: "Benefits", icon: Layers },
  { id: "billing", label: "Price & renewal", icon: Wallet },
  { id: "review", label: "Review", icon: ClipboardCheck },
] as const;

function offeringListKey(offering: OfferingOption): keyof MembershipFormState {
  if (offering.kind === "service") return "eligibleServiceIds";
  if (offering.kind === "meeting") return "eligibleMeetingIds";
  if (offering.kind === "workshop") return "eligibleWorkshopIds";
  return "eligibleClassIds";
}

function loadDraft(): MembershipFormState | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MembershipFormState;
  } catch {
    return null;
  }
}

function persistDraft(form: MembershipFormState) {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
  } catch {
    /* ignore */
  }
}

export function CreateMembershipWizard() {
  const router = useRouter();
  const editor = useMembershipEditor(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<MembershipFormState>(() => loadDraft() ?? EMPTY_MEMBERSHIP_FORM);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    persistDraft(form);
  }, [form]);

  const onFormChange = useCallback(<K extends keyof MembershipFormState>(key: K, value: MembershipFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleOffering = useCallback((offering: OfferingOption, included: boolean) => {
    const listKey = offeringListKey(offering);
    setForm((prev) => {
      const current = prev[listKey] as string[];
      const nextIds = included
        ? current.filter((id) => id !== offering.id)
        : [...current, offering.id];
      return { ...prev, [listKey]: nextIds };
    });
  }, []);

  const addOffering = useCallback((offering: OfferingOption) => {
    toggleOffering(offering, false);
  }, [toggleOffering]);

  const includedOfferings = useMemo(
    () =>
      editor.options.offerings.filter((o) => {
        const listKey = offeringListKey(o);
        return (form[listKey] as string[]).includes(o.id);
      }),
    [editor.options.offerings, form],
  );

  const selectedIds = useMemo(() => new Set(includedOfferings.map((o) => o.id)), [includedOfferings]);
  const access = useMemo(() => accessSummary(form), [form]);

  const createMembership = useCallback(
    async (draftOnly: boolean) => {
      const draftForm = draftOnly ? { ...form, active: false } : { ...form, active: true };
      const validation = validateMembershipForm(draftForm);
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
          body: JSON.stringify(membershipSavePayload(draftForm)),
        });
        const json = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: string };
        if (!res.ok) throw new Error(json.error || "Create failed");
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        router.replace(
          `/appointments/memberships/${json.data!.id}?${draftOnly ? "draft=1" : "created=1"}`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      } finally {
        setBusy(false);
      }
    },
    [form, router],
  );

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(form.name.trim());
    if (step === 1) return includedOfferings.length > 0;
    if (step === 2) return form.priceCents >= 0 && Boolean(form.billingInterval);
    return true;
  }, [step, form, includedOfferings.length]);

  const continueDisabledReason =
    step === 0 && !form.name.trim()
      ? "Enter a membership name"
      : step === 1 && includedOfferings.length === 0
        ? "Add at least one eligible booking"
        : "";

  const editorPanel = (
    <>
      {error ? (
        <Callout tone="warning" title="Could not save">{error}</Callout>
      ) : null}

      {step === 0 ? (
        <section className={cn(OPUS_CARD, "p-5 md:p-6")}>
          <h2 className="text-lg font-semibold">Membership details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Name your plan and add a cover image for your storefront.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mem-name">Membership name</Label>
                <Input
                  id="mem-name"
                  className="h-11"
                  value={form.name}
                  onChange={(e) => onFormChange("name", e.target.value)}
                  placeholder="Unlimited classes"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mem-desc">Description (optional)</Label>
                <Textarea
                  id="mem-desc"
                  rows={4}
                  value={form.description}
                  onChange={(e) => onFormChange("description", e.target.value)}
                />
              </div>
            </div>
            <OpusCoverImageUploader
              value={form.imageUrl}
              onChange={(url) => onFormChange("imageUrl", url)}
              category="membership"
            />
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className={cn(OPUS_CARD, "p-5 md:p-6")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Benefits</h2>
              <p className="text-sm text-muted-foreground">
                Choose which services and classes are included while the membership is active.
              </p>
            </div>
            <Button type="button" onClick={() => setPickerOpen(true)}>
              <Plus className="mr-2 size-4" aria-hidden />
              Add booking
            </Button>
          </div>
          <ul className="mt-4 space-y-3">
            {includedOfferings.length === 0 ? (
              <li className={cn(OPUS_CONFIG_INSET, "p-8 text-center text-sm text-muted-foreground")}>
                No benefits yet. Add services, classes, or workshops customers can book with this membership.
              </li>
            ) : (
              includedOfferings.map((o) => (
                <li
                  key={o.id}
                  className="flex min-h-[4.5rem] items-center gap-3 rounded-xl border bg-card px-3 py-3"
                >
                  <OpusIconBadge icon={Layers} className="size-10 shrink-0 rounded-lg bg-primary/10" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">{o.meta}</p>
                    <Pill tone="neutral" dot={false} className="mt-1 inline-flex text-xs">{o.kind}</Pill>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    aria-label={`Remove ${o.name}`}
                    onClick={() => toggleOffering(o, true)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {step === 2 ? (
        <section className={cn(OPUS_CARD, "space-y-6 p-5 md:p-6")}>
          <h2 className="text-lg font-semibold">Price & renewal</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mem-price">Price</Label>
              <div className="flex h-11 items-center gap-2 rounded-md border px-3">
                <span className="text-muted-foreground">$</span>
                <Input
                  id="mem-price"
                  type="number"
                  min={0}
                  step="0.01"
                  className="border-0 shadow-none focus-visible:ring-0"
                  value={(form.priceCents / 100).toFixed(2)}
                  onChange={(e) =>
                    onFormChange("priceCents", Math.round((Number(e.target.value) || 0) * 100))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mem-interval">Billing interval</Label>
              <select
                id="mem-interval"
                className="flex h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={form.billingInterval}
                onChange={(e) => onFormChange("billingInterval", e.target.value)}
              >
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Annual</option>
              </select>
            </div>
          </div>
          <div className="space-y-2 border-t pt-4">
            <Label>Store visibility</Label>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ["public", "Public on storefront"],
                  ["hidden", "Hidden — staff only"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="purchaseAvailability"
                    checked={form.purchaseAvailability === value}
                    onChange={() => onFormChange("purchaseAvailability", value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className={cn(OPUS_CARD, "p-5 md:p-6")}>
          <h2 className="text-lg font-semibold">Review</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{form.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Price</dt>
              <dd className="font-medium">
                {formatMoney(form.priceCents)} / {formatBillingInterval(form.billingInterval).toLowerCase()}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Benefits</dt>
              <dd className="max-w-[60%] text-right font-medium">{access.label}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Visibility</dt>
              <dd className="font-medium">
                {form.purchaseAvailability === "public" ? "Public" : "Hidden"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <OfferingPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        offerings={editor.options.offerings as Parameters<typeof OfferingPickerSheet>[0]["offerings"]}
        selectedIds={selectedIds}
        onAdd={addOffering}
        returnDraftKey={DRAFT_STORAGE_KEY}
      />
    </>
  );

  return (
    <SchedulingWizardShell
      backHref="/appointments/memberships"
      backLabel="Memberships"
      title="Create membership"
      description="Sell recurring access to services and classes."
      headerAction={
        <Button type="button" variant="outline" disabled={busy} onClick={() => void createMembership(true)}>
          Save draft
        </Button>
      }
      steps={STEPS}
      currentStep={step}
      onStepSelect={(i) => setStep(i)}
      editor={editorPanel}
      preview={<MembershipLivePreview form={form} includedOfferings={includedOfferings} />}
      footerLeft={
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || busy}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
      }
      footerRight={
        step < STEPS.length - 1 ? (
          <Button
            type="button"
            disabled={!canContinue || busy}
            title={continueDisabledReason}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
            <ArrowRight className="ml-2 size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void createMembership(false)}>
            {busy ? "Creating…" : "Create membership"}
          </Button>
        )
      }
      showPreviewOnMobile
    />
  );
}
