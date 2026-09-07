"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { appointmentSmsConsentDisclosure } from "@/lib/appointments/sms-consent-disclosure";
import type {
  PublicBookingFlowOptions,
  PublicBookingStep,
  PublicBookingType,
  PublicBookingWorkspace,
  PublicLocationOption,
  PublicSlot,
  PublicStaffOption,
  SquarePaymentConfig,
} from "./types";

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
  const { slug, initialServiceId, preselectTypeId, singleUseToken, theme } = options;

  const [step, setStep] = useState<PublicBookingStep>("service");
  const [workspace, setWorkspace] = useState<PublicBookingWorkspace | null>(null);
  const [types, setTypes] = useState<PublicBookingType[]>([]);
  const [staffOptions, setStaffOptions] = useState<PublicStaffOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<PublicLocationOption[]>([]);
  const [selectedType, setSelectedType] = useState<PublicBookingType | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [recurringMode, setRecurringMode] = useState<"once" | "weekly" | "biweekly" | "monthly">("once");
  const [recurringOccurrences, setRecurringOccurrences] = useState(4);
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingAnswers, setBookingAnswers] = useState<Record<string, string>>({});
  const [smsConsent, setSmsConsent] = useState(false);
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

  const effectiveSingleUseToken = singleUseToken || urlSingleUseToken || undefined;

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

  const pickType = useCallback(
    async (type: PublicBookingType) => {
      const normalized: PublicBookingType = {
        ...type,
        durationOptions: type.durationOptions || type.config?.durationOptions,
        confirmationPage: type.confirmationPage || type.config?.confirmationPage,
      };
      setSelectedType(normalized);
      setStartsAt("");
      setBookingAnswers({});
      setSelectedStaffId("");
      setSelectedLocationId("");
      setRecurringMode("once");
      setAttendeeCount(1);
      const opts = (normalized.durationOptions || []).filter((o) => o.active !== false && o.minutes > 0);
      setSelectedDuration(opts[0]?.minutes ?? normalized.durationMinutes);
      setStep("datetime");
      setLoadingSlots(true);
      setError("");
      const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "availability",
          serviceId: type.id,
          serviceName: type.name,
          daysAhead: 14,
          durationMinutes: opts[0]?.minutes ?? type.durationMinutes,
        }),
      });
      const json = await res.json();
      setSlots(json.data?.slots || []);
      setLoadingSlots(false);
    },
    [slug],
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
          privacyUrl: json.data.privacyUrl || "/privacy",
          aiBookingEnabled: json.data.aiBookingEnabled !== false,
          waitlistEnabled: json.data.waitlistEnabled !== false,
        };
        setWorkspace(ws);
        const list = (json.data.types || []) as PublicBookingType[];
        setTypes(list);
        setStaffOptions(json.data.staff || []);
        setLocationOptions(json.data.locations || []);
        if (initialServiceId || preselectTypeId) {
          const match = list.find((t) => t.id === (preselectTypeId || initialServiceId));
          if (match) void pickType(match);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, initialServiceId, preselectTypeId, pickType]);

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
      humanVerification: challengeRequired ? humanVerification : undefined,
      formStartedAt,
      website: honeypot,
      staffId: selectedStaffId || undefined,
      locationId: selectedLocationId || undefined,
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
    slug,
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
  };
}

export type PublicBookingFlow = ReturnType<typeof usePublicBookingFlow>;
