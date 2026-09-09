"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { appointmentSmsConsentDisclosure } from "@/lib/appointments/sms-consent-disclosure";
import type {
  PublicBookingCategory,
  PublicBookingFlowOptions,
  PublicBookingStep,
  PublicBookingType,
  PublicBookingWorkspace,
  PublicLocationOption,
  PublicSlot,
  PublicStaffOption,
  SquarePaymentConfig,
} from "./types";

export type BookingEntitlements = {
  packages: Array<{ id: string; productName: string; creditsRemaining: number }>;
  gifts: Array<{ id: string; code: string; balanceCents: number }>;
  memberships: Array<{ id: string; productName: string; status: string }>;
  loyaltyPrograms?: Array<{
    programId: string;
    programName: string;
    pointsBalance: number;
    redeemRateCents: number;
  }>;
  hasSavedCard?: boolean;
  walletBalanceCents?: number;
};

import type { PaymentRequirement } from "@/lib/appointments/types";

function formatPrice(payment?: PaymentRequirement) {
  if (!payment || payment.mode === "none") return null;
  const cents =
    payment.mode === "deposit"
      ? payment.depositCents || Math.round((payment.priceCents || 0) * ((payment.depositPercent || 0) / 100))
      : payment.priceCents;
  if (!cents) return null;
  const currency = (payment.currency || "usd").toUpperCase();
  const amount = (cents / 100).toFixed(2);
  return payment.mode === "deposit" ? `Deposit $${amount} ${currency}` : `$${amount} ${currency}`;
}

export type { PublicBookingFlowOptions } from "./types";

export function usePublicBookingFlow(options: PublicBookingFlowOptions) {
  const {
    slug,
    initialServiceId,
    preselectTypeId,
    singleUseToken,
    theme,
    initialCategorySlug,
    initialStaffId,
    initialLocationId,
  } = options;

  const [step, setStep] = useState<PublicBookingStep>("service");
  const [workspace, setWorkspace] = useState<PublicBookingWorkspace | null>(null);
  const [types, setTypes] = useState<PublicBookingType[]>([]);
  const [categories, setCategories] = useState<PublicBookingCategory[]>([]);
  const [staffOptions, setStaffOptions] = useState<PublicStaffOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<PublicLocationOption[]>([]);
  const [selectedType, setSelectedType] = useState<PublicBookingType | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [recurringMode, setRecurringMode] = useState<"once" | "weekly" | "biweekly" | "monthly">("once");
  const [recurringOccurrences, setRecurringOccurrences] = useState(4);
  const [recurringPreview, setRecurringPreview] = useState<{
    dates: string[];
    conflicts: Array<{ startsAt: string; reason: string }>;
  } | null>(null);
  const [recurringPreviewLoading, setRecurringPreviewLoading] = useState(false);
  const [sessionLines, setSessionLines] = useState<
    Array<{ serviceId: string; serviceName: string; startsAt: string; durationMinutes?: number }>
  >([]);
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingAnswers, setBookingAnswers] = useState<Record<string, string>>({});
  const [smsConsent, setSmsConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [humanVerification, setHumanVerification] = useState(false);
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [formStartedAt] = useState(() => Date.now());
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bookingConflicts, setBookingConflicts] = useState<Array<{ startsAt: string; reason: string }>>([]);
  const [paymentPending, setPaymentPending] = useState(false);
  const [pendingAppointmentId, setPendingAppointmentId] = useState("");
  const [squareConfig, setSquareConfig] = useState<SquarePaymentConfig | null>(null);
  const [bookingMeetingLink, setBookingMeetingLink] = useState<string | null>(null);
  const [bookingIsTransovoVideo, setBookingIsTransovoVideo] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiSlots, setAiSlots] = useState<PublicSlot[]>([]);
  const [waitlistPreferredDate, setWaitlistPreferredDate] = useState("");
  const [waitlistTimeStart, setWaitlistTimeStart] = useState("09:00");
  const [waitlistTimeEnd, setWaitlistTimeEnd] = useState("17:00");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [utm, setUtm] = useState<Record<string, string>>({});
  const [urlSingleUseToken, setUrlSingleUseToken] = useState("");
  const [confirmationResources, setConfirmationResources] = useState<
    PublicBookingType["confirmationPage"] | null
  >(null);
  const [extraRecipients, setExtraRecipients] = useState<
    Array<{ name: string; email: string; phone: string }>
  >([]);
  const [entitlements, setEntitlements] = useState<BookingEntitlements | null>(null);
  const [entitlementMethod, setEntitlementMethod] = useState<"none" | "package" | "gift">("none");
  const [packageBalanceId, setPackageBalanceId] = useState("");
  const [giftCertificateCode, setGiftCertificateCode] = useState("");
  const [useSavedCard, setUseSavedCard] = useState(false);
  const [walletApplyCents, setWalletApplyCents] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [lineStaffIds, setLineStaffIds] = useState<Record<string, string>>({});
  const [dynamicPriceCents, setDynamicPriceCents] = useState<number | null>(null);
  const [loyaltyProgramId, setLoyaltyProgramId] = useState("");
  const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState(0);
  const [entitlementsLoading, setEntitlementsLoading] = useState(false);
  const [addOnCatalog, setAddOnCatalog] = useState<import("./types").PublicBookingAddOn[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<
    import("./types").PublicCustomFieldDefinition[]
  >([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [intakeCatalog, setIntakeCatalog] = useState<import("./types").PublicIntakeForm[]>([]);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, Record<string, string>>>({});
  const [additionalServices, setAdditionalServices] = useState<PublicBookingType[]>([]);
  const [addingAdditionalService, setAddingAdditionalService] = useState(false);
  const [slotHoldId, setSlotHoldId] = useState("");

  const effectiveSingleUseToken = singleUseToken || urlSingleUseToken || undefined;
  const deepLinkStaffId = initialStaffId || "";
  const deepLinkLocationId = initialLocationId || "";

  const activeDurationOptions = useMemo(() => {
    const opts = selectedType?.durationOptions || selectedType?.config?.durationOptions || [];
    const active = opts.filter((o) => o.active !== false && o.minutes > 0);
    if (active.length) return active;
    if (selectedType) {
      return [
        {
          id: "default",
          label: `${selectedType.durationMinutes} min`,
          minutes: selectedType.durationMinutes,
        },
      ];
    }
    return [];
  }, [selectedType]);

  const effectiveDurationMinutes =
    selectedDuration || activeDurationOptions[0]?.minutes || selectedType?.durationMinutes || 30;

  const activeQuestions = useMemo(
    () =>
      (selectedType?.config?.bookingQuestions || [])
        .filter((q) => q.active !== false)
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)),
    [selectedType],
  );

  const eligibleStaff = useMemo(() => {
    const ids = selectedType?.config?.staffIds;
    let list = staffOptions;
    if (ids?.length) list = list.filter((s) => ids.includes(s.id));
    return list;
  }, [selectedType, staffOptions]);

  const eligibleLocations = useMemo(() => {
    const ids = selectedType?.config?.locationIds;
    if (!ids?.length) return locationOptions;
    return locationOptions.filter((l) => ids.includes(l.id));
  }, [selectedType, locationOptions]);

  const eligibleAddOns = useMemo(() => {
    if (!selectedType) return [];
    const typeAddOnIds = (selectedType.config as { addOnIds?: string[] } | undefined)?.addOnIds;
    return addOnCatalog.filter((a) => {
      if (typeAddOnIds?.length) return typeAddOnIds.includes(a.id);
      if (!a.eligibleTypeIds?.length) return true;
      return a.eligibleTypeIds.includes(selectedType.id);
    });
  }, [addOnCatalog, selectedType]);

  const showStaffPicker =
    selectedType?.config?.staffAssignment === "customer_chooses" && eligibleStaff.length > 0;
  const showLocationPicker = eligibleLocations.length > 1;
  const groupEnabled = Boolean(selectedType?.config?.groupBooking?.enabled);
  const groupCapacity = selectedType?.config?.groupBooking?.capacity || 1;
  const recurringEnabled = Boolean(selectedType?.config?.recurring?.enabled);
  const paymentLabel = formatPrice(selectedType?.config?.payment);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, PublicSlot[]>();
    for (const slot of slots) {
      const key = new Date(slot.startsAt).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      const list = map.get(key) || [];
      list.push(slot);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [slots]);

  useEffect(() => {
    if (!recurringEnabled || recurringMode === "once" || !startsAt || !selectedType) {
      setRecurringPreview(null);
      return;
    }
    let cancelled = false;
    setRecurringPreviewLoading(true);
    void fetch(`/api/public/book/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preview_recurring",
        startsAt,
        frequency: recurringMode,
        occurrences: recurringOccurrences,
        serviceName: selectedType.name,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.data) {
          setRecurringPreview({
            dates: json.data.dates || [],
            conflicts: json.data.conflicts || [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setRecurringPreview(null);
      })
      .finally(() => {
        if (!cancelled) setRecurringPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    slug,
    recurringEnabled,
    recurringMode,
    recurringOccurrences,
    startsAt,
    selectedType,
  ]);

  const smsDisclosure = workspace
    ? appointmentSmsConsentDisclosure(workspace.name)
    : appointmentSmsConsentDisclosure("this business");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const singleUse = params.get("singleUse");
    if (singleUse) setUrlSingleUseToken(singleUse);
    const captured: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const v = params.get(key);
      if (v) captured[key.replace("utm_", "")] = v;
    }
    if (Object.keys(captured).length) setUtm(captured);
    const cookie = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`transovo_invitee_`));
    if (cookie) {
      try {
        const raw = cookie.split("=")[1];
        const parsed = JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/")));
        if (parsed.firstName) setFirstName(parsed.firstName);
        if (parsed.lastName) setLastName(parsed.lastName);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.email) setEmail(parsed.email);
      } catch {
        // ignore malformed cookie
      }
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else if (theme === "light") document.documentElement.classList.remove("dark");
  }, [theme]);

  const fetchAvailability = useCallback(
    async (
      type: PublicBookingType,
      durationMinutes: number,
      overrides?: { staffId?: string; locationId?: string },
    ) => {
      setLoadingSlots(true);
      setError("");
      try {
        const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "availability",
            serviceId: type.id,
            serviceName: type.name,
            daysAhead: 14,
            durationMinutes,
            staffId: overrides?.staffId ?? (selectedStaffId || undefined),
            locationId: overrides?.locationId ?? (selectedLocationId || undefined),
          }),
        });
        const json = await res.json();
        setSlots(json.data?.slots || []);
      } catch {
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [slug, selectedStaffId, selectedLocationId],
  );

  useEffect(() => {
    if (step !== "datetime" || !selectedType) return;
    void fetchAvailability(selectedType, effectiveDurationMinutes);
  }, [step, selectedType, selectedStaffId, selectedLocationId, effectiveDurationMinutes, fetchAvailability]);

  const selectSlot = useCallback(
    async (iso: string) => {
      setStartsAt(iso);
      setSlotHoldId("");
      if (!selectedType || !iso) return;
      try {
        const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "hold_slot",
            serviceId: selectedType.id,
            serviceName: selectedType.name,
            startsAt: iso,
            durationMinutes: effectiveDurationMinutes,
            staffId: selectedStaffId || undefined,
            locationId: selectedLocationId || undefined,
            phone: phone || undefined,
          }),
        });
        const json = await res.json();
        if (res.ok && json.data?.holdId) setSlotHoldId(String(json.data.holdId));
        const baseCents = selectedType.config?.payment?.priceCents;
        if (baseCents && baseCents > 0) {
          const priceRes = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "evaluate_price",
              serviceId: selectedType.id,
              serviceName: selectedType.name,
              startsAt: iso,
              staffId: selectedStaffId || undefined,
              locationId: selectedLocationId || undefined,
            }),
          });
          const priceJson = await priceRes.json().catch(() => ({}));
          if (priceRes.ok && priceJson.data?.finalPriceCents != null) {
            setDynamicPriceCents(Number(priceJson.data.finalPriceCents));
          } else {
            setDynamicPriceCents(null);
          }
        } else {
          setDynamicPriceCents(null);
        }
      } catch {
        // Hold is best-effort; booking still validates slot at checkout
      }
    },
    [
      slug,
      selectedType,
      effectiveDurationMinutes,
      selectedStaffId,
      selectedLocationId,
      phone,
    ],
  );

  const pickType = useCallback(
    async (type: PublicBookingType) => {
      if (addingAdditionalService && selectedType && type.id !== selectedType.id) {
        setAdditionalServices((prev) =>
          prev.some((s) => s.id === type.id) ? prev : [...prev, type],
        );
        setAddingAdditionalService(false);
        setStep("datetime");
        return;
      }

      const normalized: PublicBookingType = {
        ...type,
        durationOptions: type.durationOptions || type.config?.durationOptions,
        confirmationPage: type.confirmationPage || type.config?.confirmationPage,
      };
      setAdditionalServices([]);
      setSelectedType(normalized);
      setStartsAt("");
      setBookingAnswers({});
      setSelectedStaffId(deepLinkStaffId);
      setSelectedLocationId(deepLinkLocationId);
      setRecurringMode("once");
      setAttendeeCount(1);
      const opts = (normalized.durationOptions || []).filter((o) => o.active !== false && o.minutes > 0);
      setSelectedDuration(opts[0]?.minutes ?? normalized.durationMinutes);
      setStep("datetime");
      setSlotHoldId("");
      await fetchAvailability(normalized, opts[0]?.minutes ?? normalized.durationMinutes, {
        staffId: deepLinkStaffId || undefined,
        locationId: deepLinkLocationId || undefined,
      });
    },
    [slug, deepLinkStaffId, deepLinkLocationId, addingAdditionalService, selectedType, fetchAvailability],
  );

  const activeIntakeForms = useMemo(() => {
    const ids = new Set<string>();
    const collect = (cfg?: { intakeFormIds?: string[] }) => {
      for (const id of cfg?.intakeFormIds || []) ids.add(id);
    };
    collect(selectedType?.config);
    for (const svc of additionalServices) collect(svc.config);
    if (!ids.size) return [];
    return intakeCatalog.filter((f) => ids.has(f.id));
  }, [intakeCatalog, selectedType, additionalServices]);

  const lookupEntitlements = useCallback(
    async (phoneValue: string, emailValue?: string) => {
      if (!phoneValue.trim() || phoneValue.replace(/\D/g, "").length < 10) {
        setEntitlements(null);
        setEntitlementMethod("none");
        setPackageBalanceId("");
        setGiftCertificateCode("");
        setUseSavedCard(false);
        setWalletApplyCents(0);
        setLoyaltyProgramId("");
        setLoyaltyRedeemPoints(0);
        return;
      }
      setEntitlementsLoading(true);
      try {
        const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "entitlements",
            phone: phoneValue,
            email: emailValue,
            serviceId: selectedType?.id,
            serviceName: selectedType?.name,
          }),
        });
        const json = await res.json();
        const data = (json.data || {}) as BookingEntitlements & {
          autoSuggestion?: { method: "package" | "gift" | "none"; packageBalanceId?: string; giftCode?: string };
        };
        setEntitlements(data);
        if (data.autoSuggestion?.method === "package" && data.autoSuggestion.packageBalanceId) {
          setEntitlementMethod("package");
          setPackageBalanceId(data.autoSuggestion.packageBalanceId);
        } else if (data.autoSuggestion?.method === "gift" && data.autoSuggestion.giftCode) {
          setEntitlementMethod("gift");
          setGiftCertificateCode(data.autoSuggestion.giftCode);
        } else if (!data.packages?.length && !data.gifts?.length) {
          setEntitlementMethod("none");
          setPackageBalanceId("");
          setGiftCertificateCode("");
        }
      } catch {
        setEntitlements(null);
      } finally {
        setEntitlementsLoading(false);
      }
    },
    [slug, selectedType],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`/api/public/book/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) {
          const json = await r.json().catch(() => ({}));
          throw new Error(json.error || "Booking unavailable");
        }
        return r.json();
      })
      .then((json) => {
        const ws: PublicBookingWorkspace = {
          name: json.data.workspace.name,
          slug: json.data.workspace.slug || slug,
          timezone: json.data.timezone || "",
          businessPhone: json.data.businessPhone || "",
          businessAddress: json.data.businessAddress || "",
          consentText: json.data.consentText || "",
          termsUrl: json.data.termsUrl || "/terms",
          termsVersion: json.data.termsVersion,
          privacyUrl: json.data.privacyUrl || "/privacy",
          aiBookingEnabled: json.data.aiBookingEnabled !== false,
          waitlistEnabled: json.data.waitlistEnabled !== false,
        };
        setWorkspace(ws);
        const list = (json.data.types || []) as PublicBookingType[];
        setTypes(list);
        setCategories(json.data.categories || []);
        setAddOnCatalog(json.data.addOns || []);
        setCustomFieldDefinitions(json.data.customFieldDefinitions || []);
        setIntakeCatalog(json.data.intakeForms || []);
        setStaffOptions(json.data.staff || []);
        setLocationOptions(json.data.locations || []);
        if (deepLinkStaffId) setSelectedStaffId(deepLinkStaffId);
        if (deepLinkLocationId) setSelectedLocationId(deepLinkLocationId);
        if (initialServiceId || preselectTypeId) {
          const match = list.find((t) => t.id === (preselectTypeId || initialServiceId));
          if (match) void pickType(match);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, initialServiceId, preselectTypeId, pickType, deepLinkStaffId, deepLinkLocationId]);

  useEffect(() => {
    load();
  }, [load]);

  const sendOtp = useCallback(async () => {
    if (!email.trim()) {
      setError("Enter your email to receive a verification code.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || "Could not send verification code");
      return;
    }
    setOtpSent(true);
    setError("");
  }, [email, slug]);

  const verifyOtp = useCallback(async () => {
    if (!otpCode.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", email, code: otpCode }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || "Invalid code");
      return;
    }
    setOtpVerified(true);
    setChallengeRequired(false);
    setError("");
  }, [email, otpCode, slug]);

  const sendAiMessage = useCallback(async () => {
    const text = aiInput.trim();
    if (!text) return;
    setAiLoading(true);
    setError("");
    setAiInput("");
    const nextHistory = [...aiHistory, { role: "user" as const, content: text }];
    setAiHistory(nextHistory);
    try {
      const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, conversationHistory: nextHistory }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI booking unavailable");
      const data = json.data;
      setAiHistory((h) => [...h, { role: "assistant", content: data.message || "" }]);
      if (data.slots?.length) setAiSlots(data.slots);
      if (data.serviceName && !selectedType) {
        const match = types.find((t) => t.name === data.serviceName);
        if (match) setSelectedType(match);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process request");
    } finally {
      setAiLoading(false);
    }
  }, [aiHistory, aiInput, selectedType, slug, types]);

  const selectAiSlot = useCallback(
    (slot: PublicSlot) => {
      setStartsAt(slot.startsAt);
      if (selectedType) setStep("info");
      else if (types.length === 1) {
        setSelectedType(types[0]);
        setStep("info");
      } else {
        setStep("service");
        setError("Please select a service type first.");
      }
    },
    [selectedType, types],
  );

  const joinWaitlist = useCallback(async (): Promise<boolean> => {
    if (!selectedType || !phone.trim() || !firstName.trim()) {
      setError("Name and phone are required to join the waitlist.");
      return false;
    }
    if (!smsConsent) {
      setError("Please accept SMS consent to join the waitlist.");
      return false;
    }
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentTypeId: selectedType.id,
        serviceName: selectedType.name,
        preferredDate: waitlistPreferredDate || undefined,
        preferredTimeStart: waitlistTimeStart,
        preferredTimeEnd: waitlistTimeEnd,
        staffPreference: selectedStaffId || undefined,
        locationId: selectedLocationId || undefined,
        phone,
        email,
        firstName,
        lastName,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || "Could not join waitlist");
      return false;
    }
    setWaitlistSubmitted(true);
    return true;
  }, [
    selectedType,
    phone,
    firstName,
    smsConsent,
    slug,
    waitlistPreferredDate,
    waitlistTimeStart,
    waitlistTimeEnd,
    selectedStaffId,
    selectedLocationId,
    email,
    lastName,
  ]);

  const book = useCallback(async (override?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    notes?: string;
    smsConsent?: boolean;
    bookingAnswers?: Record<string, string>;
  }) => {
    const bookFirstName = override?.firstName ?? firstName;
    const bookLastName = override?.lastName ?? lastName;
    const bookPhone = override?.phone ?? phone;
    const bookEmail = override?.email ?? email;
    const bookNotes = override?.notes ?? notes;
    const bookSmsConsent = override?.smsConsent ?? smsConsent;
    const bookAnswers = override?.bookingAnswers ?? bookingAnswers;

    for (const q of activeQuestions) {
      if (q.required && !bookAnswers[q.id]?.trim()) {
        setError(`Please answer: ${q.label}`);
        return;
      }
    }
    for (const form of activeIntakeForms) {
      const fields = (form.fields || []) as Array<{ id: string; label: string; required?: boolean }>;
      for (const field of fields) {
        if (!field.required) continue;
        const val = (intakeAnswers[form.id]?.[field.id] || "").trim();
        if (!val) {
          setError(`Please complete required field: ${field.label}`);
          return;
        }
      }
    }
    for (const svc of additionalServices) {
      if (svc.config?.staffAssignment === "customer_chooses" && !lineStaffIds[svc.id]) {
        setError(`Please select staff for ${svc.name}.`);
        return;
      }
    }
    if (!selectedType || !startsAt || !bookPhone.trim() || !bookFirstName.trim()) {
      setError("Please complete all required fields.");
      return;
    }
    if (showStaffPicker && !selectedStaffId) {
      setError("Please select a staff member.");
      return;
    }
    if (showLocationPicker && !selectedLocationId) {
      setError("Please select a location.");
      return;
    }
    if (workspace?.termsVersion && !termsAccepted) {
      setError("Please accept the terms and conditions to complete your booking.");
      return;
    }
    setSubmitting(true);
    setError("");
    setBookingConflicts([]);
    const payload: Record<string, unknown> = {
      serviceId: selectedType.id,
      serviceName: selectedType.name,
      startsAt,
      firstName: bookFirstName,
      lastName: bookLastName,
      phone: bookPhone,
      email: bookEmail,
      notes: bookNotes,
      bookingAnswers: Object.keys(bookAnswers).length ? bookAnswers : undefined,
      smsConsent: bookSmsConsent,
      termsAccepted: termsAccepted || undefined,
      termsVersion: workspace?.termsVersion,
      humanVerification: challengeRequired ? humanVerification : undefined,
      formStartedAt,
      website: honeypot,
      staffId: selectedStaffId || undefined,
      locationId: selectedLocationId || undefined,
      holdId: slotHoldId || undefined,
      attendeeCount: groupEnabled ? attendeeCount : undefined,
      durationMinutes: effectiveDurationMinutes,
      utm: Object.keys(utm).length ? utm : undefined,
      emailOtpVerified: otpVerified || undefined,
      singleUseToken: effectiveSingleUseToken,
    };
    if (extraRecipients.length) {
      payload.extraRecipients = extraRecipients
        .map((r) => ({
          name: r.name.trim() || undefined,
          email: r.email.trim() || undefined,
          phone: r.phone.trim() || undefined,
        }))
        .filter((r) => r.email || r.phone);
    }
    if (recurringMode !== "once" && recurringEnabled) {
      payload.recurring = {
        frequency: recurringMode,
        occurrences: recurringOccurrences,
      };
    }
    if (entitlementMethod === "package" && packageBalanceId) {
      payload.entitlementMethod = "package";
      payload.packageBalanceId = packageBalanceId;
    } else if (entitlementMethod === "gift" && giftCertificateCode) {
      payload.entitlementMethod = "gift";
      payload.giftCertificateCode = giftCertificateCode;
    }
    if (useSavedCard && entitlements?.hasSavedCard) {
      payload.useSavedCard = true;
    }
    if (walletApplyCents > 0) {
      payload.walletApplyCents = walletApplyCents;
    }
    if (loyaltyRedeemPoints > 0 && loyaltyProgramId) {
      payload.loyaltyProgramId = loyaltyProgramId;
      payload.loyaltyRedeemPoints = loyaltyRedeemPoints;
    }
    if (couponCode.trim()) {
      payload.couponCode = couponCode.trim();
    }
    const addOnSelections = Object.entries(selectedAddOns)
      .filter(([, qty]) => qty > 0)
      .map(([addOnId, quantity]) => ({ addOnId, quantity }));
    if (addOnSelections.length) {
      payload.addOnSelections = addOnSelections;
    }
    if (Object.keys(customFieldValues).length) {
      payload.customFieldValues = customFieldValues;
    }
    if (activeIntakeForms.length) {
      const responses = activeIntakeForms
        .map((form) => ({
          formId: form.id,
          answers: intakeAnswers[form.id] || {},
        }))
        .filter((r) => Object.keys(r.answers).length > 0);
      if (responses.length) payload.intakeResponses = responses;
    }
    if (additionalServices.length && startsAt) {
      const primaryStart = new Date(startsAt);
      const primaryEnd = new Date(primaryStart.getTime() + effectiveDurationMinutes * 60_000);
      let cursor = primaryEnd.getTime();
      payload.multiServiceLines = [
        {
          appointmentTypeId: selectedType.id,
          serviceName: selectedType.name,
          staffId: selectedStaffId || undefined,
          startsAt: primaryStart.toISOString(),
          endsAt: primaryEnd.toISOString(),
          displayOrder: 0,
        },
        ...additionalServices.map((svc, index) => {
          const dur = svc.durationMinutes || 30;
          const lineStart = new Date(cursor);
          const lineEnd = new Date(cursor + dur * 60_000);
          cursor = lineEnd.getTime();
          return {
            appointmentTypeId: svc.id,
            serviceName: svc.name,
            staffId: lineStaffIds[svc.id] || selectedStaffId || undefined,
            startsAt: lineStart.toISOString(),
            endsAt: lineEnd.toISOString(),
            displayOrder: index + 1,
          };
        }),
      ];
    }
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 428 && json.challengeRequired) {
      setChallengeRequired(true);
      setError("Email verification is required to complete your booking.");
      setSubmitting(false);
      return;
    }
    if (!res.ok) {
      setError(json.error || "Could not complete booking");
      setSubmitting(false);
      return;
    }
    if (json.data?.conflicts?.length) {
      setBookingConflicts(json.data.conflicts);
    }
    if (json.data?.checkoutUrl) {
      setPaymentPending(true);
      window.location.href = json.data.checkoutUrl;
      return;
    }
    if (json.data?.square && json.data?.appointmentId) {
      setPendingAppointmentId(json.data.appointmentId);
      setSquareConfig(json.data.square);
      setStep("payment");
      setSubmitting(false);
      return;
    }
    setBookingMeetingLink(json.data?.meetingLink || json.data?.joinUrl || null);
    setBookingIsTransovoVideo(Boolean(json.data?.isTransovoVideo));
    if (json.data?.redirectUrl) setRedirectUrl(json.data.redirectUrl);
    setConfirmationResources(
      json.data?.confirmationResources ||
        selectedType?.confirmationPage ||
        selectedType?.config?.confirmationPage ||
        null,
    );
    if (json.data?.returningInviteeCookie) {
      const c = json.data.returningInviteeCookie as { key: string; value: string };
      const maxAge = 365 * 24 * 60 * 60;
      document.cookie = `${c.key}=${c.value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
    setStep("done");
    setSubmitting(false);
    if (json.data?.redirectUrl) {
      setTimeout(() => {
        window.location.href = json.data.redirectUrl as string;
      }, 2500);
    }
  }, [
    activeQuestions,
    bookingAnswers,
    selectedType,
    startsAt,
    phone,
    firstName,
    showStaffPicker,
    selectedStaffId,
    showLocationPicker,
    selectedLocationId,
    lastName,
    email,
    notes,
    smsConsent,
    challengeRequired,
    humanVerification,
    formStartedAt,
    honeypot,
    groupEnabled,
    attendeeCount,
    effectiveDurationMinutes,
    utm,
    otpVerified,
    effectiveSingleUseToken,
    extraRecipients,
    recurringMode,
    recurringEnabled,
    recurringOccurrences,
    entitlementMethod,
    packageBalanceId,
    giftCertificateCode,
    useSavedCard,
    entitlements,
    slug,
    customFieldValues,
    activeIntakeForms,
    intakeAnswers,
    additionalServices,
    lineStaffIds,
    selectedAddOns,
    slotHoldId,
    termsAccepted,
    workspace,
    loyaltyProgramId,
    loyaltyRedeemPoints,
  ]);

  const onPaymentSuccess = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/public/appointment-payment/status?appointmentId=${encodeURIComponent(pendingAppointmentId)}`,
      );
      const json = await res.json();
      setBookingMeetingLink(json.data?.meetingLink || null);
      setBookingIsTransovoVideo(Boolean(json.data?.isTransovoVideo));
    } catch {
      setBookingMeetingLink(null);
      setBookingIsTransovoVideo(false);
    }
    setStep("done");
  }, [pendingAppointmentId]);

  const selectedWhen = startsAt
    ? new Date(startsAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return {
    slug,
    step,
    setStep,
    workspace,
    types,
    categories,
    initialCategorySlug,
    staffOptions,
    locationOptions,
    selectedType,
    setSelectedType,
    selectedStaffId,
    setSelectedStaffId,
    selectedLocationId,
    setSelectedLocationId,
    slots,
    startsAt,
    setStartsAt,
    selectSlot,
    recurringMode,
    setRecurringMode,
    recurringOccurrences,
    setRecurringOccurrences,
    attendeeCount,
    setAttendeeCount,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    phone,
    setPhone,
    email,
    setEmail,
    notes,
    setNotes,
    bookingAnswers,
    setBookingAnswers,
    smsConsent,
    setSmsConsent,
    termsAccepted,
    setTermsAccepted,
    humanVerification,
    setHumanVerification,
    challengeRequired,
    honeypot,
    setHoneypot,
    loading,
    loadingSlots,
    submitting,
    error,
    setError,
    bookingConflicts,
    paymentPending,
    pendingAppointmentId,
    squareConfig,
    bookingMeetingLink,
    bookingIsTransovoVideo,
    aiInput,
    setAiInput,
    aiLoading,
    aiHistory,
    aiSlots,
    waitlistPreferredDate,
    setWaitlistPreferredDate,
    waitlistTimeStart,
    setWaitlistTimeStart,
    waitlistTimeEnd,
    setWaitlistTimeEnd,
    waitlistSubmitted,
    otpCode,
    setOtpCode,
    otpSent,
    otpVerified,
    selectedDuration,
    setSelectedDuration,
    redirectUrl,
    confirmationResources,
    extraRecipients,
    setExtraRecipients,
    activeDurationOptions,
    effectiveDurationMinutes,
    activeQuestions,
    eligibleStaff,
    eligibleLocations,
    showStaffPicker,
    showLocationPicker,
    groupEnabled,
    groupCapacity,
    recurringEnabled,
    paymentLabel,
    slotsByDay,
    smsDisclosure,
    selectedWhen,
    load,
    pickType,
    sendOtp,
    verifyOtp,
    sendAiMessage,
    selectAiSlot,
    joinWaitlist,
    book,
    onPaymentSuccess,
    entitlements,
    entitlementsLoading,
    entitlementMethod,
    setEntitlementMethod,
    packageBalanceId,
    setPackageBalanceId,
    giftCertificateCode,
    setGiftCertificateCode,
    useSavedCard,
    setUseSavedCard,
    walletApplyCents,
    setWalletApplyCents,
    loyaltyProgramId,
    setLoyaltyProgramId,
    loyaltyRedeemPoints,
    setLoyaltyRedeemPoints,
    couponCode,
    setCouponCode,
    lineStaffIds,
    setLineStaffId: (serviceId: string, staffId: string) => {
      setLineStaffIds((prev) => ({ ...prev, [serviceId]: staffId }));
    },
    dynamicPriceCents,
    lookupEntitlements,
    eligibleAddOns,
    selectedAddOns,
    setSelectedAddOns,
    customFieldDefinitions,
    customFieldValues,
    setCustomFieldValues,
    activeIntakeForms,
    intakeAnswers,
    setIntakeAnswers,
    additionalServices,
    addingAdditionalService,
    setAddingAdditionalService,
    addAdditionalService: () => {
      setAddingAdditionalService(true);
      setStep("service");
    },
    recurringPreview,
    recurringPreviewLoading,
    sessionLines,
    addToSessionCart: () => {
      if (!selectedType || !startsAt) return;
      setSessionLines((prev) => [
        ...prev,
        {
          serviceId: selectedType.id,
          serviceName: selectedType.name,
          startsAt,
          durationMinutes: effectiveDurationMinutes,
        },
      ]);
      setStartsAt("");
      setStep("service");
    },
    checkoutSession: async () => {
      if (!selectedType || !startsAt || !phone.trim() || !firstName.trim()) {
        setError("Complete contact details before checkout.");
        return;
      }
      const lines = [
        ...sessionLines,
        {
          serviceId: selectedType.id,
          serviceName: selectedType.name,
          startsAt,
          durationMinutes: effectiveDurationMinutes,
          staffId: selectedStaffId || undefined,
          locationId: selectedLocationId || undefined,
        },
      ];
      setSubmitting(true);
      setError("");
      try {
        const res = await fetch(`/api/public/book/${slug}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            firstName,
            lastName,
            email,
            smsConsent,
            bookingAnswers: Object.keys(bookingAnswers).length ? bookingAnswers : undefined,
            lines,
            payment: selectedType.config?.payment,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Checkout failed");
        if (json.data?.checkoutUrl) {
          window.location.href = json.data.checkoutUrl;
          return;
        }
        setSessionLines([]);
        setStep("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checkout failed");
      } finally {
        setSubmitting(false);
      }
    },
  };
}

export type PublicBookingFlow = ReturnType<typeof usePublicBookingFlow>;
