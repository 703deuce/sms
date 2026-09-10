import { useEffect, useMemo, useState } from "react";
import type { BookingType } from "../mock-data";
import { workspace } from "../mock-data";
import { BookingQuestionField } from "./BookingQuestionField";
import { Button, Input, Label, Textarea } from "./ui";
import { formatSlotTime, formatFullDate } from "./utils";
import { ArrowLeft, CalendarCheck, Clock, MapPin, ShieldCheck } from "lucide-react";
import { PaymentSummary, computePaymentBreakdown } from "./PaymentSummary";

type EntitlementOption = {
  packages: Array<{ id: string; productName: string; creditsRemaining: number }>;
  gifts: Array<{ id: string; code: string; balanceCents: number }>;
  loyaltyPrograms?: Array<{
    programId: string;
    programName: string;
    pointsBalance: number;
    redeemRateCents: number;
  }>;
  hasSavedCard?: boolean;
  walletBalanceCents?: number;
};

function loyaltyValueCents(points: number, redeemRateCents: number) {
  if (!points || !redeemRateCents) return 0;
  return Math.floor((points / redeemRateCents) * 100);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function InfoStep({
  type,
  startsAt,
  timezone,
  submitting,
  error,
  entitlements,
  entitlementsLoading,
  entitlementMethod,
  packageBalanceId,
  giftCertificateCode,
  useSavedCard,
  onEntitlementMethodChange,
  onPackageBalanceIdChange,
  onGiftCertificateCodeChange,
  onUseSavedCardChange,
  walletApplyCents = 0,
  onWalletApplyCentsChange,
  loyaltyProgramId = "",
  loyaltyRedeemPoints = 0,
  onLoyaltyProgramIdChange,
  onLoyaltyRedeemPointsChange,
  couponCode = "",
  onCouponCodeChange,
  onLookupEntitlements,
  eligibleAddOns = [],
  selectedAddOns = {},
  onSelectedAddOnsChange,
  customFieldDefinitions = [],
  customFieldValues = {},
  onCustomFieldValuesChange,
  intakeForms = [],
  intakeAnswers = {},
  onIntakeAnswersChange,
  onBack,
  onBook,
  recurringPreview,
  recurringPreviewLoading,
  sessionLineCount = 0,
  additionalServiceNames = [],
  dynamicPriceCents = null,
  onCheckoutSession,
  termsRequired = false,
  termsUrl = "/terms",
  termsAccepted = false,
  onTermsAcceptedChange,
  uploadSlug,
  payWhatYouWantCents,
  onPayWhatYouWantCentsChange,
  providerUnavailable,
}: {
  type: BookingType;
  startsAt: string;
  timezone: string;
  submitting: boolean;
  error: string;
  entitlements?: EntitlementOption | null;
  entitlementsLoading?: boolean;
  entitlementMethod?: "none" | "package" | "gift";
  packageBalanceId?: string;
  giftCertificateCode?: string;
  useSavedCard?: boolean;
  onEntitlementMethodChange?: (method: "none" | "package" | "gift") => void;
  onPackageBalanceIdChange?: (id: string) => void;
  onGiftCertificateCodeChange?: (code: string) => void;
  onUseSavedCardChange?: (value: boolean) => void;
  walletApplyCents?: number;
  onWalletApplyCentsChange?: (cents: number) => void;
  loyaltyProgramId?: string;
  loyaltyRedeemPoints?: number;
  onLoyaltyProgramIdChange?: (id: string) => void;
  onLoyaltyRedeemPointsChange?: (points: number) => void;
  couponCode?: string;
  onCouponCodeChange?: (code: string) => void;
  onLookupEntitlements?: (phone: string, email?: string) => void;
  eligibleAddOns?: Array<{
    id: string;
    name: string;
    priceCents: number;
    durationDeltaMinutes: number;
    quantityMax: number;
    required: boolean;
  }>;
  selectedAddOns?: Record<string, number>;
  onSelectedAddOnsChange?: (next: Record<string, number>) => void;
  customFieldDefinitions?: Array<{
    key: string;
    label: string;
    fieldType: string;
    options?: string[] | null;
    required: boolean;
  }>;
  customFieldValues?: Record<string, string>;
  onCustomFieldValuesChange?: (next: Record<string, string>) => void;
  intakeForms?: Array<{
    id: string;
    name: string;
    fields: Array<{ id: string; label: string; type: string; required?: boolean; options?: string[] }>;
  }>;
  intakeAnswers?: Record<string, Record<string, string>>;
  onIntakeAnswersChange?: (formId: string, fieldId: string, value: string) => void;
  onBack: () => void;
  onBook: (payload: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    notes: string;
    smsConsent: boolean;
    answers: Record<string, string>;
    recurringMode: string;
    recurringOccurrences: number;
    attendeeCount: number;
  }) => void;
  recurringPreview?: { dates: string[]; conflicts: Array<{ startsAt: string; reason: string }> } | null;
  recurringPreviewLoading?: boolean;
  sessionLineCount?: number;
  additionalServiceNames?: string[];
  dynamicPriceCents?: number | null;
  onCheckoutSession?: () => void;
  termsRequired?: boolean;
  termsUrl?: string;
  termsAccepted?: boolean;
  onTermsAcceptedChange?: (value: boolean) => void;
  uploadSlug?: string;
  payWhatYouWantCents?: number | null;
  onPayWhatYouWantCentsChange?: (cents: number) => void;
  providerUnavailable?: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recurringMode, setRecurringMode] = useState("once");
  const [recurringOccurrences, setRecurringOccurrences] = useState(4);
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  async function uploadIntakeFile(formId: string, fieldId: string, file: File) {
    if (!uploadSlug) return;
    const key = `${formId}:${fieldId}`;
    setUploadingField(key);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/public/book/${encodeURIComponent(uploadSlug)}/intake-upload`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      onIntakeAnswersChange?.(formId, fieldId, String(json.data?.url || ""));
    } finally {
      setUploadingField(null);
    }
  }

  const questions = type.config?.bookingQuestions || [];
  const recurring = type.config?.recurring?.enabled ? type.config.recurring : null;
  const group = type.config?.groupBooking?.enabled ? type.config.groupBooking : null;

  const missingRequired = useMemo(
    () => questions.filter((q) => q.required && !(answers[q.id] || "").trim()),
    [questions, answers],
  );

  useEffect(() => {
    if (!onLookupEntitlements) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) onLookupEntitlements(phone, email);
  }, [phone, email, onLookupEntitlements]);

  const hasEntitlements =
    Boolean(entitlements?.packages?.length) || Boolean(entitlements?.gifts?.length);
  const payment = type.config?.payment;
  const paymentRequired = payment && payment.mode !== "none" && payment.mode !== "save_card";
  const basePriceCents = payment?.priceCents || 0;
  const isPayWhatYouWant = payment?.mode === "pay_what_you_want";
  const pwywMin = payment?.payWhatYouWant?.minimumCents ?? 0;
  const pwywSuggested = payment?.payWhatYouWant?.suggestedCents ?? pwywMin;
  const paymentBreakdown = computePaymentBreakdown(payment, dynamicPriceCents, payWhatYouWantCents);
  const showDynamicPrice =
    paymentRequired &&
    dynamicPriceCents != null &&
    basePriceCents > 0 &&
    dynamicPriceCents !== basePriceCents;

  function validate() {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "Enter your first name.";
    if (!lastName.trim()) next.lastName = "Enter your last name.";
    if (!phone.trim()) next.phone = "Enter a mobile number for appointment updates.";
    else if (phone.replace(/\D/g, "").length < 10) next.phone = "Enter a complete phone number including area code.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a complete email address.";
    if (missingRequired.length > 0) next.questions = "Answer the required questions above.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (!validate()) return;
    if (isPayWhatYouWant && onPayWhatYouWantCentsChange) {
      const amount = payWhatYouWantCents ?? 0;
      if (amount < pwywMin) {
        setFieldErrors((prev) => ({
          ...prev,
          payWhatYouWant: `Enter at least ${formatMoney(pwywMin)}.`,
        }));
        return;
      }
    }
    onBook({ firstName, lastName, phone, email, notes, smsConsent, answers, recurringMode, recurringOccurrences, attendeeCount });
  }

  const submitLabel =
    submitting
      ? "Booking…"
      : paymentBreakdown?.ctaLabel || (paymentRequired ? "Continue" : "Book appointment");

  return (
    <div className="fade-in">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Change time
      </button>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{type.name}</p>
          {additionalServiceNames.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
              {additionalServiceNames.map((name) => (
                <li key={name}>+ {name} (back-to-back)</li>
              ))}
            </ul>
          ) : null}
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />
              {formatFullDate(startsAt, timezone)} · {formatSlotTime(startsAt, timezone)}
            </span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {type.config?.location || "In person"}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First name *</Label>
          <Input id="firstName" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          {fieldErrors.firstName ? <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.firstName}</p> : null}
        </div>
        <div>
          <Label htmlFor="lastName">Last name *</Label>
          <Input id="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          {fieldErrors.lastName ? <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.lastName}</p> : null}
        </div>
        <div>
          <Label htmlFor="phone">Mobile number *</Label>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="(615) 555-0142" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {fieldErrors.phone ? <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.phone}</p> : null}
        </div>
        <div>
          <Label htmlFor="email">Email address — optional</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {fieldErrors.email ? <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.email}</p> : null}
        </div>
      </div>

      {entitlementsLoading ? (
        <p className="mt-4 text-[12px] text-muted-foreground">Checking packages and gift balances…</p>
      ) : null}

      {hasEntitlements ? (
        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-[13px] font-semibold text-foreground">Apply a credit or gift balance</p>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="radio"
                name="entitlement"
                checked={entitlementMethod === "none"}
                onChange={() => onEntitlementMethodChange?.("none")}
              />
              Pay normally
            </label>
            {(entitlements?.packages || []).map((pkg) => (
              <label key={pkg.id} className="flex items-center gap-2 text-[13px]">
                <input
                  type="radio"
                  name="entitlement"
                  checked={entitlementMethod === "package" && packageBalanceId === pkg.id}
                  onChange={() => {
                    onEntitlementMethodChange?.("package");
                    onPackageBalanceIdChange?.(pkg.id);
                  }}
                />
                Use package: {pkg.productName} ({pkg.creditsRemaining} credits)
              </label>
            ))}
            {(entitlements?.gifts || []).map((gift) => (
              <label key={gift.id} className="flex items-center gap-2 text-[13px]">
                <input
                  type="radio"
                  name="entitlement"
                  checked={entitlementMethod === "gift" && giftCertificateCode === gift.code}
                  onChange={() => {
                    onEntitlementMethodChange?.("gift");
                    onGiftCertificateCodeChange?.(gift.code);
                  }}
                />
                Use gift certificate {gift.code} ({formatMoney(gift.balanceCents)})
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {showDynamicPrice ? (
        <p className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[13px] text-foreground">
          Price for this time: <strong>{formatMoney(dynamicPriceCents!)}</strong>
          <span className="text-muted-foreground"> (standard {formatMoney(basePriceCents)})</span>
        </p>
      ) : null}

      {isPayWhatYouWant && entitlementMethod === "none" ? (
        <div className="mt-4 rounded-xl border border-border p-4">
          <Label htmlFor="pwyw-amount">Amount</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              id="pwyw-amount"
              type="number"
              min={(pwywMin / 100).toFixed(2)}
              step="0.01"
              className="flex-1"
              value={payWhatYouWantCents != null ? (payWhatYouWantCents / 100).toFixed(2) : ""}
              placeholder={(pwywSuggested / 100).toFixed(2)}
              onChange={(e) => {
                const dollars = Number(e.target.value);
                if (!Number.isFinite(dollars)) return;
                onPayWhatYouWantCentsChange?.(Math.round(dollars * 100));
              }}
            />
          </div>
          {pwywMin > 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Minimum {formatMoney(pwywMin)}
              {pwywSuggested > pwywMin ? ` · suggested ${formatMoney(pwywSuggested)}` : ""}
            </p>
          ) : null}
          {fieldErrors.payWhatYouWant ? (
            <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.payWhatYouWant}</p>
          ) : null}
        </div>
      ) : null}

      {paymentRequired && entitlementMethod === "none" ? (
        <PaymentSummary
          payment={payment}
          dynamicPriceCents={dynamicPriceCents}
          payWhatYouWantCents={payWhatYouWantCents}
          providerUnavailable={providerUnavailable}
        />
      ) : null}

      {paymentRequired && entitlementMethod === "none" ? (
        <div className="mt-4 rounded-xl border border-border p-4 space-y-4">
          <div>
            <Label htmlFor="coupon-code">Promo code</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="coupon-code"
                value={couponCode}
                onChange={(e) => onCouponCodeChange?.(e.target.value)}
                placeholder="SUMMER20"
                className="flex-1"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Applied when you book if valid.</p>
          </div>
          {(entitlements?.loyaltyPrograms || []).length > 0 ? (
            <div className="space-y-2">
              <Label>Loyalty points</Label>
              {(entitlements?.loyaltyPrograms || []).map((program) => {
                const selected = loyaltyProgramId === program.programId;
                const maxPoints = program.pointsBalance;
                const appliedPoints = selected ? loyaltyRedeemPoints : 0;
                const valueCents = loyaltyValueCents(appliedPoints, program.redeemRateCents);
                return (
                  <label key={program.programId} className="flex items-start gap-3 text-[13px]">
                    <input
                      type="radio"
                      name="loyalty-program"
                      className="mt-0.5"
                      checked={selected && appliedPoints > 0}
                      onChange={() => {
                        onLoyaltyProgramIdChange?.(program.programId);
                        onLoyaltyRedeemPointsChange?.(maxPoints);
                      }}
                    />
                    <span>
                      <span className="font-semibold text-foreground">{program.programName}</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {maxPoints} points available
                        {appliedPoints > 0 ? ` · redeeming ${appliedPoints} (${formatMoney(valueCents)} off)` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
              {loyaltyProgramId ? (
                <label className="flex flex-col gap-1 text-[13px]">
                  <span className="text-muted-foreground">Points to redeem</span>
                  <Input
                    type="number"
                    min={0}
                    max={
                      entitlements?.loyaltyPrograms?.find((p) => p.programId === loyaltyProgramId)
                        ?.pointsBalance || 0
                    }
                    value={loyaltyRedeemPoints || ""}
                    onChange={(e) =>
                      onLoyaltyRedeemPointsChange?.(Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          {(entitlements?.walletBalanceCents || 0) > 0 ? (
            <label className="flex items-start gap-3 text-[13px]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={walletApplyCents > 0}
                onChange={(e) =>
                  onWalletApplyCentsChange?.(
                    e.target.checked ? Math.min(entitlements?.walletBalanceCents || 0, type.config?.payment?.priceCents || entitlements?.walletBalanceCents || 0) : 0,
                  )
                }
              />
              <span>
                <span className="font-semibold text-foreground">Use wallet credit</span>
                <span className="mt-0.5 block text-muted-foreground">
                  {formatMoney(entitlements?.walletBalanceCents || 0)} available
                  {walletApplyCents > 0 ? ` · applying ${formatMoney(walletApplyCents)}` : ""}
                </span>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      {paymentRequired && entitlements?.hasSavedCard && entitlementMethod === "none" ? (
        <div className="mt-4 rounded-xl border border-border p-4">
          <label className="flex items-start gap-3 text-[13px]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={Boolean(useSavedCard)}
              onChange={(e) => onUseSavedCardChange?.(e.target.checked)}
            />
            <span>
              <span className="font-semibold text-foreground">Charge my saved card</span>
              <span className="mt-0.5 block text-muted-foreground">
                Use the card on file for this booking when payment is required.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {eligibleAddOns.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border p-4">
          <p className="text-[13px] font-semibold text-foreground mb-3">Add-ons</p>
          <ul className="space-y-2">
            {eligibleAddOns.map((addOn) => {
              const qty = selectedAddOns[addOn.id] || 0;
              const checked = addOn.required || qty > 0;
              return (
                <li key={addOn.id}>
                  <label className="flex items-start justify-between gap-3 text-[13px]">
                    <span className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-primary"
                        checked={checked}
                        disabled={addOn.required}
                        onChange={(e) => {
                          if (!onSelectedAddOnsChange) return;
                          const next = { ...selectedAddOns };
                          if (e.target.checked) next[addOn.id] = 1;
                          else delete next[addOn.id];
                          onSelectedAddOnsChange(next);
                        }}
                      />
                      <span>
                        <span className="font-medium">{addOn.name}</span>
                        {addOn.required ? (
                          <span className="ml-1 text-[11px] text-muted-foreground">(required)</span>
                        ) : null}
                      </span>
                    </span>
                    {addOn.priceCents > 0 ? (
                      <span className="text-muted-foreground shrink-0">+{formatMoney(addOn.priceCents)}</span>
                    ) : null}
                  </label>
                  {checked && addOn.quantityMax > 1 ? (
                    <div className="mt-2 ml-6">
                      <Label htmlFor={`addon-qty-${addOn.id}`}>Quantity</Label>
                      <select
                        id={`addon-qty-${addOn.id}`}
                        className="mt-1 h-9 rounded-lg border border-border bg-card px-3 text-[13px]"
                        value={qty || 1}
                        onChange={(e) => {
                          if (!onSelectedAddOnsChange) return;
                          onSelectedAddOnsChange({
                            ...selectedAddOns,
                            [addOn.id]: Number(e.target.value),
                          });
                        }}
                      >
                        {Array.from({ length: addOn.quantityMax }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {group ? (
        <div className="mt-4">
          <Label htmlFor="attendees">How many people are coming?</Label>
          <select
            id="attendees"
            className="mt-1.5 h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px] shadow-sm sm:max-w-[200px]"
            value={attendeeCount}
            onChange={(e) => setAttendeeCount(Number(e.target.value))}
          >
            {Array.from({ length: group.maxAttendees }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>
            ))}
          </select>
        </div>
      ) : null}

      {recurring ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <p className="text-[13px] font-semibold text-foreground">Repeat this appointment</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["once", ...recurring.allowedFrequencies].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRecurringMode(opt)}
                className={
                  recurringMode === opt
                    ? "rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
                    : "rounded-full bg-muted px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
                }
              >
                {opt === "once" ? "One time" : opt === "weekly" ? "Weekly" : opt === "biweekly" ? "Every 2 weeks" : "Monthly"}
              </button>
            ))}
          </div>
          {recurringMode !== "once" ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-[13px]">
                <Label htmlFor="occurrences" className="font-normal text-muted-foreground">Total visits</Label>
                <select
                  id="occurrences"
                  className="h-8 rounded-lg border border-border bg-card px-2 text-[13px]"
                  value={recurringOccurrences}
                  onChange={(e) => setRecurringOccurrences(Number(e.target.value))}
                >
                  {Array.from({ length: recurring.maxOccurrences - 1 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              {recurringPreviewLoading ? (
                <p className="text-[12px] text-muted-foreground">Checking schedule preview…</p>
              ) : recurringPreview?.dates?.length ? (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-[12px]">
                  <p className="font-medium text-foreground">Upcoming dates</p>
                  <ul className="mt-1 max-h-28 overflow-y-auto text-muted-foreground">
                    {recurringPreview.dates.map((d) => {
                      const conflict = recurringPreview.conflicts.find((c) => c.startsAt === d);
                      return (
                        <li key={d} className={conflict ? "text-amber-700" : undefined}>
                          {formatFullDate(d, timezone)} {formatSlotTime(d, timezone)}
                          {conflict ? ` — ${conflict.reason}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {questions.length > 0 ? (
        <div className="mt-5 space-y-4">
          <p className="text-[13px] font-semibold text-foreground">A few quick questions</p>
          {questions.map((q) => (
            <BookingQuestionField
              key={q.id}
              question={q}
              value={answers[q.id] || ""}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
            />
          ))}
          {fieldErrors.questions ? <p className="text-[12px] text-rose-600">{fieldErrors.questions}</p> : null}
        </div>
      ) : null}

      {customFieldDefinitions.length > 0 ? (
        <div className="mt-5 space-y-4">
          <p className="text-[13px] font-semibold text-foreground">About you</p>
          {customFieldDefinitions.map((field) => (
            <div key={field.key}>
              <Label htmlFor={`cf-${field.key}`}>
                {field.label}{field.required ? " *" : ""}
              </Label>
              {field.fieldType === "select" && field.options?.length ? (
                <select
                  id={`cf-${field.key}`}
                  className="mt-1.5 h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px]"
                  value={customFieldValues[field.key] || ""}
                  onChange={(e) =>
                    onCustomFieldValuesChange?.({ ...customFieldValues, [field.key]: e.target.value })
                  }
                >
                  <option value="">Select…</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.fieldType === "textarea" ? (
                <Textarea
                  id={`cf-${field.key}`}
                  rows={2}
                  className="mt-1.5"
                  value={customFieldValues[field.key] || ""}
                  onChange={(e) =>
                    onCustomFieldValuesChange?.({ ...customFieldValues, [field.key]: e.target.value })
                  }
                />
              ) : (
                <Input
                  id={`cf-${field.key}`}
                  className="mt-1.5"
                  type={field.fieldType === "email" ? "email" : field.fieldType === "phone" ? "tel" : "text"}
                  value={customFieldValues[field.key] || ""}
                  onChange={(e) =>
                    onCustomFieldValuesChange?.({ ...customFieldValues, [field.key]: e.target.value })
                  }
                />
              )}
            </div>
          ))}
        </div>
      ) : null}

      {intakeForms.length > 0 ? (
        <div className="mt-5 space-y-5">
          {intakeForms.map((form) => (
            <div key={form.id} className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-[13px] font-semibold text-foreground">{form.name}</p>
              {(form.fields || []).map((field) => (
                <div key={field.id}>
                  <Label htmlFor={`intake-${form.id}-${field.id}`}>
                    {field.label}{field.required ? " *" : ""}
                  </Label>
                  {field.type === "file" || field.type === "image" ? (
                    <div className="mt-1.5 space-y-2">
                      <input
                        id={`intake-${form.id}-${field.id}`}
                        type="file"
                        accept={field.type === "image" ? "image/*" : undefined}
                        className="block w-full text-[13px]"
                        disabled={uploadingField === `${form.id}:${field.id}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadIntakeFile(form.id, field.id, file);
                        }}
                      />
                      {intakeAnswers[form.id]?.[field.id] ? (
                        <p className="text-[12px] text-muted-foreground break-all">
                          Uploaded: {intakeAnswers[form.id][field.id]}
                        </p>
                      ) : null}
                    </div>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      id={`intake-${form.id}-${field.id}`}
                      className="mt-1.5"
                      rows={3}
                      value={intakeAnswers[form.id]?.[field.id] || ""}
                      onChange={(e) => onIntakeAnswersChange?.(form.id, field.id, e.target.value)}
                    />
                  ) : field.type === "select" && field.options?.length ? (
                    <select
                      id={`intake-${form.id}-${field.id}`}
                      className="mt-1.5 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                      value={intakeAnswers[form.id]?.[field.id] || ""}
                      onChange={(e) => onIntakeAnswersChange?.(form.id, field.id, e.target.value)}
                    >
                      <option value="">Select…</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`intake-${form.id}-${field.id}`}
                      className="mt-1.5"
                      type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                      value={intakeAnswers[form.id]?.[field.id] || ""}
                      onChange={(e) => onIntakeAnswersChange?.(form.id, field.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        <Label htmlFor="notes">Notes for the office — optional</Label>
        <Textarea id="notes" rows={2} placeholder="Anything else we should know?" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {termsRequired ? (
      <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => onTermsAcceptedChange?.(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            required={termsRequired}
          />
          <span className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">I agree to the terms and conditions.</span>{" "}
            <a href={termsUrl} className="font-semibold text-primary hover:underline" target="_blank" rel="noreferrer">
              Read terms
            </a>
          </span>
        </label>
      </div>
      ) : null}

      <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Text me appointment updates — optional.</span>{" "}
            {workspace.consentText}{" "}
            <a href={workspace.termsUrl} className="font-semibold text-primary hover:underline">Terms</a> ·{" "}
            <a href={workspace.privacyUrl} className="font-semibold text-primary hover:underline">Privacy Policy</a>
          </span>
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-6 space-y-2">
        {sessionLineCount > 0 && onCheckoutSession ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={onCheckoutSession}
            disabled={submitting}
          >
            Checkout {sessionLineCount + 1} appointments
          </Button>
        ) : null}
        <Button size="lg" className="w-full" onClick={submit} disabled={submitting}>
          {submitLabel}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Your information is only used to schedule and manage this appointment.
        </p>
      </div>
    </div>
  );
}
