import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarX2,
  Check,
  Clock,
  Link2Off,
  MapPin,
  Phone,
} from "lucide-react";
import { Button, Card, cn } from "./ui";
import {
  AppointmentStatusBadge,
  formatAppointmentDate,
  formatAppointmentTime,
  formatTimezoneLabel,
} from "./appointment-ui";
import {
  AppointmentPreview,
  cancellationPolicy,
  mockAppointment,
  PageState,
} from "../mock-data";

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function TransovoMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg btn-primary text-[13px] font-bold text-white">
        T
      </span>
      <span className="text-[13px] font-semibold tracking-tight text-muted-foreground">
        Powered by Transovo
      </span>
    </span>
  );
}

function ContactBusiness({
  className,
  businessName,
  businessPhone,
}: {
  className?: string;
  businessName?: string | null;
  businessPhone?: string | null;
}) {
  const phone = businessPhone;
  const name = businessName || "the business";
  return (
    <p className={cn("text-[13px] leading-relaxed text-muted-foreground", className)}>
      Contact{" "}
      <span className="font-semibold text-foreground">{name}</span>
      {phone ? (
        <>
          {" "}
          at{" "}
          <a
            href={`tel:${phone}`}
            className="font-semibold text-link underline-offset-2 hover:underline"
          >
            {formatPhone(phone)}
          </a>
        </>
      ) : null}{" "}
      directly and they&rsquo;ll help you make a change.
    </p>
  );
}

function AppointmentSummary({
  appt,
  icon,
}: {
  appt: AppointmentPreview;
  icon?: "check" | "x";
}) {
  const tzLabel = formatTimezoneLabel(appt.timezone);
  const Icon = icon === "x" ? CalendarX2 : CalendarCheck;
  const iconClass = icon === "x" ? "icon-slate-soft" : "icon-primary-soft";
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3.5 text-left">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          iconClass,
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {appt.serviceName || "Appointment"}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {formatAppointmentDate(appt.startsAt, appt.timezone)} ·{" "}
          {formatAppointmentTime(appt.startsAt, appt.timezone)}
          {tzLabel ? ` (${tzLabel})` : ""}
        </p>
      </div>
      <AppointmentStatusBadge status={appt.status} />
    </div>
  );
}

export function PublicCancelClient({ token, live = false }: { token?: string; live?: boolean }) {
  const [state, setState] = useState<PageState>("loading");
  const [appt, setAppt] = useState<AppointmentPreview | null>(null);
  const [acting, setActing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [kept, setKept] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [error, setError] = useState("");

  // Load appointment preview
  useEffect(() => {
    if (!live || !token) {
      setState("loading");
      const t = setTimeout(() => {
        setAppt(mockAppointment);
        setState("normal");
      }, 900);
      return () => clearTimeout(t);
    }

    setState("loading");
    setError("");
    fetch(`/api/public/appointments/cancel/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) {
          const json = await r.json().catch(() => ({}));
          throw new Error(json.error || "Invalid link");
        }
        return r.json();
      })
      .then((json) => {
        const preview = json.data as AppointmentPreview;
        setAppt(preview);
        const status = preview.status?.toLowerCase() || "";
        if (status === "canceled" || status === "cancelled") {
          setState("already");
        } else {
          setState("normal");
        }
      })
      .catch((err: Error) => {
        setAppt(null);
        setError(err.message);
        setState("error");
      });
  }, [live, token]);

  function submit() {
    setActing(true);
    setSubmitError("");
    if (live && token) {
      fetch(`/api/public/appointments/cancel/${encodeURIComponent(token)}`, { method: "POST" })
        .then(async (r) => {
          const json = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(json.error || "Something went wrong");
          setAppt((prev) => (prev ? { ...prev, status: "canceled" } : prev));
          setConfirming(false);
          setState("success");
        })
        .catch((err: Error) => setSubmitError(err.message))
        .finally(() => setActing(false));
      return;
    }
    setTimeout(() => {
      setActing(false);
      setConfirming(false);
      setAppt((prev) => (prev ? { ...prev, status: "canceled" } : prev));
      setState("success");
    }, 1100);
  }

  // ---- Demo state switcher (sandbox only) ----
  function simulate(next: PageState) {
    setConfirming(false);
    setActing(false);
    setKept(false);
    setSubmitError("");
    if (next === "loading") {
      setState("loading");
      setTimeout(() => {
        setAppt(mockAppointment);
        setState("normal");
      }, 900);
      return;
    }
    if (next === "error") {
      setAppt(null);
      setError("This cancellation link is invalid or has expired.");
      setState("error");
      return;
    }
    if (next === "success") {
      setAppt({ ...mockAppointment, status: "canceled" });
      setState("success");
      return;
    }
    if (next === "already") {
      setAppt({ ...mockAppointment, status: "canceled" });
      setState("already");
      return;
    }
    if (next === "blocked") {
      setAppt(mockAppointment);
      setState("blocked");
      return;
    }
    setAppt(mockAppointment);
    setState("normal");
  }

  const stateOptions: Array<{ key: PageState; label: string }> = [
    { key: "loading", label: "Loading" },
    { key: "normal", label: "Normal" },
    { key: "blocked", label: "Blocked" },
    { key: "already", label: "Already canceled" },
    { key: "success", label: "Success" },
    { key: "error", label: "Error" },
  ];

  const tzLabel = formatTimezoneLabel(appt?.timezone);

  const displayBusinessName = appt?.businessName || mockAppointment.businessName;
  const displayBusinessPhone = appt?.businessPhone || mockAppointment.businessPhone;

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      {/* Minimal public header */}
      <header className="w-full border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md btn-primary text-[11px] font-bold text-white">
              T
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {displayBusinessName || "Appointments"}
            </span>
          </span>
          <span className="hidden text-[12px] font-medium text-muted-foreground sm:block">
            Appointment management
          </span>
        </div>
      </header>

      {/* Sandbox state switcher */}
      {!live ? (
      <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-1.5 px-4">
        {stateOptions.map((s) => (
          <button
            key={s.key}
            onClick={() => simulate(s.key)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ring-1 ring-inset",
              state === s.key
                ? "btn-primary text-white ring-transparent"
                : "bg-card text-muted-foreground ring-border hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      ) : null}

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-8">
        {/* ---------- LOADING ---------- */}
        {state === "loading" ? (
          <div
            className="flex items-center gap-2.5 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 spinner-track" />
            Loading appointment…
          </div>
        ) : null}

        {/* ---------- ERROR (invalid/expired token) ---------- */}
        {state === "error" ? (
          <Card className="fade-up w-full max-w-md p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl icon-rose-soft">
              <Link2Off className="h-5 w-5" />
            </div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              This link doesn&rsquo;t work
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {error || "This cancellation link is invalid or has expired."}
            </p>
            <div className="mt-4">
              <ContactBusiness businessName={displayBusinessName} businessPhone={displayBusinessPhone} />
            </div>
          </Card>
        ) : null}

        {/* ---------- BLOCKED (degraded: cancel window passed / policy disabled) ---------- */}
        {state === "blocked" && appt ? (
          <Card className="fade-up w-full max-w-md p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl icon-amber-soft">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              Online cancellation isn&rsquo;t available
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This appointment is inside the {cancellationPolicy.cutoffHours}-hour
              cancellation window, so it can no longer be canceled online.
            </p>

            <div className="mt-5">
              <AppointmentSummary appt={appt} />
            </div>

            {displayBusinessPhone ? (
              <a
                href={`tel:${displayBusinessPhone}`}
                className="btn-primary mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98]"
              >
                <Phone className="h-4 w-4" />
                Call {displayBusinessName}
              </a>
            ) : null}
            <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
              {cancellationPolicy.policyText}
            </p>
          </Card>
        ) : null}

        {/* ---------- ALREADY CANCELED (idempotent token re-visit) ---------- */}
        {state === "already" && appt ? (
          <Card className="fade-up w-full max-w-md p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl icon-slate-soft">
              <CalendarX2 className="h-5 w-5" />
            </div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              This appointment is already canceled
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              There&rsquo;s nothing more to do — this appointment was canceled
              earlier and no reminders will be sent.
            </p>

            <div className="mt-5">
              <AppointmentSummary appt={appt} icon="x" />
            </div>

            <div className="mt-6">
              <p className="text-[13px] text-muted-foreground">
                Need to schedule a new time?
              </p>
              <ContactBusiness className="mt-1" businessName={displayBusinessName} businessPhone={displayBusinessPhone} />
            </div>
          </Card>
        ) : null}

        {/* ---------- SUCCESS ---------- */}
        {state === "success" && appt ? (
          <Card className="fade-up w-full max-w-md p-8 text-center sm:p-9">
            <div className="scale-in mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full icon-emerald-soft ring-8 ring-emerald-50">
              <Check className="h-7 w-7" />
            </div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
              Your appointment has been canceled
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We&rsquo;ve let {displayBusinessName} know. Any scheduled
              reminders for this appointment have been stopped.
            </p>

            <div className="mt-6">
              <AppointmentSummary appt={appt} icon="x" />
            </div>

            <div className="mt-6">
              <p className="text-[13px] text-muted-foreground">
                Changed your mind?
              </p>
              <ContactBusiness className="mt-1" businessName={displayBusinessName} businessPhone={displayBusinessPhone} />
            </div>
          </Card>
        ) : null}

        {/* ---------- NORMAL / CONFIRM ---------- */}
        {state === "normal" && appt ? (
          <Card className="fade-up w-full max-w-md p-6 sm:p-8">
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              Cancel your appointment
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {appt.customerFirstName
                ? `Hi ${appt.customerFirstName}, review`
                : "Review"}{" "}
              the details below before canceling. This can&rsquo;t be undone.
            </p>

            {kept ? (
              <div
                className="fade-up mt-4 flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3.5 py-3 ring-1 ring-inset ring-emerald-600/15"
                role="status"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-[12px] leading-relaxed text-emerald-900">
                  No changes made — your appointment is still on. You can close
                  this page.
                </p>
              </div>
            ) : null}

            {/* Appointment summary */}
            <div className="mt-4 rounded-xl border border-border/70 bg-muted/40 px-4 py-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg icon-primary-soft">
                  <CalendarCheck className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {appt.serviceName || "Appointment"}
                    </p>
                    <AppointmentStatusBadge status={appt.status} />
                  </div>
                  <div className="mt-1.5 space-y-1">
                    <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {formatAppointmentDate(appt.startsAt, appt.timezone)} at{" "}
                      {formatAppointmentTime(appt.startsAt, appt.timezone)}
                      {tzLabel ? ` · ${tzLabel}` : ""}
                    </p>
                    {appt.locationLabel ? (
                      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {appt.locationLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Policy note */}
            <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-amber-50/70 px-3.5 py-3 ring-1 ring-inset ring-amber-600/15">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-[12px] leading-relaxed text-amber-900">
                {cancellationPolicy.policyText}
              </p>
            </div>

            {submitError ? (
              <div
                className="fade-up mt-4 flex items-start gap-2.5 rounded-lg bg-rose-50/70 px-3.5 py-3 ring-1 ring-inset ring-rose-600/15"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <p className="text-[12px] leading-relaxed text-rose-900">
                  {submitError}
                </p>
              </div>
            ) : null}

            {!confirming ? (
              <div className="mt-6 space-y-2.5">
                <Button
                  variant="danger"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setKept(false);
                    setConfirming(true);
                  }}
                >
                  Cancel appointment
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setConfirming(false);
                    setKept(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Keep my appointment
                </Button>
                <p className="pt-1 text-center text-[12px] leading-relaxed text-muted-foreground">
                  Keeping your appointment? You can simply close this page —
                  nothing will change.
                </p>
              </div>
            ) : (
              <div
                className="fade-up mt-6 rounded-xl border border-rose-200/80 bg-rose-50/50 px-4 py-4"
                role="alertdialog"
                aria-label="Confirm cancellation"
              >
                <p className="text-sm font-semibold text-foreground">
                  Cancel this appointment?
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  {formatAppointmentDate(appt.startsAt, appt.timezone)} at{" "}
                  {formatAppointmentTime(appt.startsAt, appt.timezone)} will be
                  canceled and {displayBusinessName} will be notified.
                </p>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => setConfirming(false)}
                    disabled={acting}
                  >
                    Go back
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    onClick={submit}
                    disabled={acting}
                  >
                    {acting ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Canceling…
                      </>
                    ) : (
                      "Yes, cancel appointment"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ) : null}
      </main>

      <footer className="pb-8 pt-2 text-center">
        <TransovoMark />
      </footer>
    </div>
  );
}
