"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { numberTabs } from "@/lib/number-tabs";
import {
  PREMIUM_INDUSTRY_OPTIONS,
  type PremiumNumberProductResult,
  type PremiumSearchProductResponse,
} from "@/lib/premium-numbers/product-api";
import { formatPremiumPrice } from "@/lib/premium-numbers/premium-pricing";
import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Forward,
  Lightbulb,
  MessageSquare,
  Phone,
  Sparkles,
  Star,
  Trophy,
  Vault,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type SearchMode = "business" | "personal";

const PERSONAL_CHIPS: { id: PersonalPreference; label: string }[] = [
  { id: "repeating_digits", label: "Repeating Digits" },
  { id: "ends_0000", label: "Ends in 0000" },
  { id: "easy_sequence", label: "Easy Sequence" },
  { id: "repeating_pair", label: "Repeating Pair" },
  { id: "very_memorable", label: "Very Memorable" },
  { id: "surprise_me", label: "Surprise Me" },
];

type Props = {
  workspaceId: string;
};

type CheckoutState = {
  reservationId: string;
  phoneNumber: string;
  vanityDisplay?: string;
  displayNumber?: string;
  premiumPriceCents: number;
  expiresAt: string;
};

export function PremiumNumbersPageClient({ workspaceId }: Props) {
  const [mode, setMode] = useState<SearchMode>("business");
  const [areaCode, setAreaCode] = useState("571");
  const [industry, setIndustry] = useState("roofing");
  const [businessName, setBusinessName] = useState("");
  const [customKeywords, setCustomKeywords] = useState("");
  const [preferences, setPreferences] = useState<PersonalPreference[]>(["surprise_me"]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchResponse, setSearchResponse] = useState<PremiumSearchProductResponse | null>(null);
  const [reserving, setReserving] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [success, setSuccess] = useState<CheckoutState | null>(null);
  const [reserveError, setReserveError] = useState("");

  async function onSearch() {
    setLoading(true);
    setError("");
    setSearchResponse(null);
    setSuccess(null);
    try {
      const customList = customKeywords
        .split(/[,]+/)
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch("/api/numbers/premium/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          mode,
          areaCode: areaCode.trim(),
          industry: mode === "business" ? industry : undefined,
          businessName: mode === "business" ? businessName : undefined,
          customKeywords: mode === "business" ? customList : undefined,
          preferences: mode === "personal" ? preferences : undefined,
        }),
      });
      const data = (await res.json()) as PremiumSearchProductResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Search failed");
      setSearchResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGetNumber(result: PremiumNumberProductResult) {
    if (!searchResponse?.searchLogId) return;
    setReserving(result.phoneNumber);
    setReserveError("");
    try {
      const res = await fetch("/api/numbers/premium/reserve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          phoneNumber: result.phoneNumber,
          searchLogId: searchResponse.searchLogId,
          searchMode: mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not reserve this number");
      }
      if (!data.expiresAt) throw new Error("Reservation did not return an expiration time");
      setCheckout({
        reservationId: data.reservationId,
        phoneNumber: result.phoneNumber,
        vanityDisplay: data.vanityDisplay ?? result.vanityDisplay,
        displayNumber: data.displayNumber ?? result.displayNumber,
        premiumPriceCents: data.premiumPriceCents ?? result.premiumPriceCents,
        expiresAt: data.expiresAt,
      });
    } catch (err) {
      setReserveError(err instanceof Error ? err.message : "Reservation failed");
    } finally {
      setReserving(null);
    }
  }

  const resultSummary = useMemo(() => {
    if (!searchResponse) return "";
    const industryLabel =
      PREMIUM_INDUSTRY_OPTIONS.find((o) => o.value === industry)?.label ?? industry;
    if (mode === "business") {
      return `${searchResponse.resultCount} results found for ${areaCode} · ${industryLabel}`;
    }
    return `${searchResponse.resultCount} memorable numbers found for ${areaCode}`;
  }, [searchResponse, mode, areaCode, industry]);

  return (
    <div className="space-y-5">
      <Tabs items={numberTabs} />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[10px] bg-violet-50 text-violet-600">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-[24px] font-bold tracking-tight text-foreground">
                  Premium Numbers
                </h1>
                <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
                  Find a memorable number that fits your business — or choose an easy-to-remember
                  personal number.
                </p>
              </div>
            </div>
            <Link href="/numbers">
              <Button variant="outline" className="h-9 rounded-[10px] text-[13px]">
                <Phone className="h-4 w-4" />
                My Numbers
              </Button>
            </Link>
          </header>

          <div className="inline-flex rounded-[10px] border border-border bg-card p-1">
            <ModeToggle active={mode === "business"} onClick={() => setMode("business")}>
              Business
            </ModeToggle>
            <ModeToggle active={mode === "personal"} onClick={() => setMode("personal")}>
              Personal
            </ModeToggle>
          </div>

          <div className="rounded-[12px] border border-border bg-card p-4 md:p-5">
            {mode === "business" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Area Code" required>
                  <Input
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="571"
                    className="h-10 rounded-[10px]"
                  />
                </Field>
                <Field label="Industry">
                  <select
                    className="border-input bg-background flex h-10 w-full rounded-[10px] border px-3 text-[13px]"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  >
                    {PREMIUM_INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Business Name (optional)">
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Johnson Roofing"
                    className="h-10 rounded-[10px]"
                  />
                </Field>
                <Field label="Words I want (optional)">
                  <Input
                    value={customKeywords}
                    onChange={(e) => setCustomKeywords(e.target.value)}
                    placeholder="roof, roofer, home"
                    className="h-10 rounded-[10px]"
                  />
                </Field>
              </div>
            ) : (
              <div className="space-y-4">
                <Field label="Area Code" required>
                  <Input
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="571"
                    className="h-10 max-w-[140px] rounded-[10px]"
                  />
                </Field>
                <div>
                  <p className="mb-2 text-[12px] font-medium text-muted-foreground">I like:</p>
                  <div className="flex flex-wrap gap-2">
                    {PERSONAL_CHIPS.map((chip) => {
                      const active = preferences.includes(chip.id);
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => {
                            setPreferences((prev) => {
                              if (chip.id === "surprise_me") return ["surprise_me"];
                              const next = prev.filter((p) => p !== "surprise_me");
                              if (active) {
                                const filtered = next.filter((p) => p !== chip.id);
                                return filtered.length ? filtered : ["surprise_me"];
                              }
                              return [...next, chip.id];
                            });
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                            active
                              ? "border-violet-600 bg-violet-600 text-white"
                              : "border-border bg-background text-foreground hover:border-violet-300",
                          )}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-muted-foreground">
                {loading ? "Searching available numbers…" : searchResponse ? resultSummary : ""}
              </p>
              <Button
                onClick={onSearch}
                disabled={loading || areaCode.length !== 3}
                className="h-10 rounded-[10px] bg-violet-600 px-6 hover:bg-violet-700"
              >
                {loading ? "Searching…" : mode === "business" ? "Find Premium Numbers" : "Find Numbers"}
              </Button>
            </div>
            {loading && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Checking business-word and memorable-number combinations.
              </p>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
          {reserveError && <p className="text-destructive text-sm">{reserveError}</p>}

          {success ? (
            <SuccessPanel state={success} onClose={() => setSuccess(null)} />
          ) : null}

          {searchResponse && !success && mode === "business" && (
            <BusinessResults
              response={searchResponse}
              reserving={reserving}
              onGetNumber={onGetNumber}
            />
          )}

          {searchResponse && !success && mode === "personal" && (
            <PersonalResults
              response={searchResponse}
              reserving={reserving}
              onGetNumber={onGetNumber}
            />
          )}
        </div>

        <aside className="w-full shrink-0 space-y-4 xl:w-[280px]">
          <PromoPanel />
          <WhyPremiumPanel />
          <HowItWorksPanel />
        </aside>
      </div>

      {checkout && !success && (
        <CheckoutModal
          state={checkout}
          workspaceId={workspaceId}
          onClose={() => setCheckout(null)}
          onComplete={() => {
            setSuccess(checkout);
            setCheckout(null);
          }}
        />
      )}
    </div>
  );
}

function ModeToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[8px] px-4 py-2 text-[13px] font-medium transition",
        active ? "bg-violet-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

function BusinessResults({
  response,
  reserving,
  onGetNumber,
}: {
  response: PremiumSearchProductResponse;
  reserving: string | null;
  onGetNumber: (r: PremiumNumberProductResult) => void;
}) {
  const hasBusiness = response.bestMatches.length > 0;
  const hasMemorable = response.memorableAlternatives.length > 0;

  return (
    <div className="space-y-8">
      {hasBusiness ? (
        <ResultSection
          title="Best Matches For Your Business"
          icon={Trophy}
          results={response.bestMatches}
          reserving={reserving}
          onGetNumber={onGetNumber}
        />
      ) : (
        <div className="rounded-[12px] border border-dashed border-border bg-card p-6 text-center">
          <p className="text-[14px] font-medium text-foreground">
            We didn&apos;t find an exact business-word match in this area code.
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Try another keyword or area code — memorable alternatives may still be available below.
          </p>
        </div>
      )}

      {hasMemorable ? (
        <ResultSection
          title="Other Memorable Numbers You May Like"
          icon={Lightbulb}
          subtitle="See all results"
          results={response.memorableAlternatives}
          reserving={reserving}
          onGetNumber={onGetNumber}
        />
      ) : null}
    </div>
  );
}

function PersonalResults({
  response,
  reserving,
  onGetNumber,
}: {
  response: PremiumSearchProductResponse;
  reserving: string | null;
  onGetNumber: (r: PremiumNumberProductResult) => void;
}) {
  const picks = response.topPicks ?? [];
  if (!picks.length) {
    return (
      <div className="rounded-[12px] border border-dashed border-border bg-card p-6 text-center">
        <p className="text-[14px] font-medium">No memorable numbers found in this area code.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Try another area code or preference.</p>
      </div>
    );
  }

  return (
    <ResultSection
      title="Top Picks"
      icon={Star}
      results={picks}
      reserving={reserving}
      onGetNumber={onGetNumber}
    />
  );
}

function ResultSection({
  title,
  icon: Icon,
  subtitle,
  results,
  reserving,
  onGetNumber,
}: {
  title: string;
  icon: typeof Trophy;
  subtitle?: string;
  results: PremiumNumberProductResult[];
  reserving: string | null;
  onGetNumber: (r: PremiumNumberProductResult) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-violet-600" />
          <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
        </div>
        {subtitle ? (
          <span className="text-[12px] text-violet-600">{subtitle}</span>
        ) : (
          <span className="text-[12px] text-muted-foreground">Sort by: Relevance</span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {results.map((result) => (
          <NumberCard
            key={result.phoneNumber}
            result={result}
            loading={reserving === result.phoneNumber}
            onGetNumber={() => onGetNumber(result)}
          />
        ))}
      </div>
    </section>
  );
}

function NumberCard({
  result,
  loading,
  onGetNumber,
}: {
  result: PremiumNumberProductResult;
  loading: boolean;
  onGetNumber: () => void;
}) {
  const headline = result.vanityDisplay ?? result.displayNumber;
  const hasVanity = Boolean(result.vanityDisplay);
  const badge = hasVanity
    ? result.matchedWords.length
      ? "WORD MATCH"
      : "VANITY"
    : null;

  return (
    <div className="relative flex flex-col rounded-[12px] border border-border bg-card p-4 shadow-sm">
      {badge ? (
        <span
          className={cn(
            "absolute left-3 top-3 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            badge === "WORD MATCH"
              ? "bg-blue-100 text-blue-700"
              : "bg-violet-100 text-violet-700",
          )}
        >
          {badge}
        </span>
      ) : null}

      <div className="mt-6 flex-1">
        <p className="text-[20px] font-bold tracking-tight text-foreground">{headline}</p>
        {hasVanity && (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{result.displayNumber}</p>
        )}
        <StarRow rating={result.starRating} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <TagPill>{result.businessMatchLabel}</TagPill>
          {result.memorabilityLabel !== "Standard" && (
            <TagPill>{result.memorabilityLabel}</TagPill>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-[18px] font-bold text-foreground">
          {formatPremiumPrice(result.premiumPriceCents)}
          <span className="text-[12px] font-normal text-muted-foreground"> one-time</span>
        </p>
        <Button
          className="mt-3 w-full rounded-[10px] bg-violet-600 hover:bg-violet-700"
          disabled={loading}
          onClick={onGetNumber}
        >
          {loading ? "Reserving…" : "Get This Number"}
        </Button>
        {result.whyReasons.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] text-muted-foreground">
              Why this number?
            </summary>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {result.whyReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="mt-2 flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < rating ? "fill-amber-400 text-amber-400" : "text-border",
          )}
        />
      ))}
    </div>
  );
}

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function CheckoutModal({
  state,
  workspaceId,
  onClose,
  onComplete,
}: {
  state: CheckoutState;
  workspaceId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [remaining, setRemaining] = useState(() => calcRemaining(state.expiresAt));

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/numbers/premium/reservation/${state.reservationId}?workspaceId=${workspaceId}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.reservationStatus === "reservation_expired") {
        setRemaining(0);
      }
      if (data.reservationExpiresAt) {
        setRemaining(calcRemaining(data.reservationExpiresAt));
      }
    } catch {
      // ignore polling errors
    }
  }, [state.reservationId, workspaceId]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(calcRemaining(state.expiresAt));
      refresh();
    }, 1000);
    return () => clearInterval(id);
  }, [state.expiresAt, refresh]);

  const headline = state.vanityDisplay ?? state.displayNumber ?? state.phoneNumber;
  const expired = remaining <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[16px] border border-border bg-card p-6 shadow-xl">
        <h3 className="text-[18px] font-bold">Reserved for you</h3>
        <p className="mt-2 text-[22px] font-bold text-violet-700">{headline}</p>
        {state.vanityDisplay && (
          <p className="text-[13px] text-muted-foreground">{state.displayNumber}</p>
        )}

        <div className="mt-4 rounded-[10px] bg-violet-50 p-4">
          <p className="text-[12px] font-medium text-violet-800">Premium number</p>
          <p className="text-[20px] font-bold text-foreground">
            One-time premium: {formatPremiumPrice(state.premiumPriceCents)}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Service: Choose after purchase
          </p>
        </div>

        <p className="mt-4 text-[13px] text-muted-foreground">
          {expired
            ? "This reservation has expired. Search again to re-select this number."
            : `Time remaining: ${formatCountdown(remaining)}`}
        </p>

        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-[10px]" onClick={onClose}>
            Back
          </Button>
          <Button
            className="flex-1 rounded-[10px] bg-violet-600 hover:bg-violet-700"
            disabled={expired}
            onClick={onComplete}
          >
            Continue setup
          </Button>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Payment integration coming soon — setup flow preview only.
        </p>
      </div>
    </div>
  );
}

function SuccessPanel({
  state,
  onClose,
}: {
  state: CheckoutState;
  onClose: () => void;
}) {
  const headline = state.vanityDisplay ?? state.displayNumber ?? state.phoneNumber;

  const services = [
    { label: "Park This Number", href: "/numbers", icon: Vault, desc: "Store without full service" },
    { label: "Forward Calls", href: "/phone/settings", icon: Forward, desc: "Send calls to another phone" },
    { label: "Smart Routing", href: "/smart-routing", icon: Phone, desc: "IVR and call routing" },
    { label: "AI Receptionist", href: "/voice/receptionist", icon: Brain, desc: "Have Amy answer calls" },
    { label: "Business Texting", href: "/compliance", icon: MessageSquare, desc: "SMS with A2P compliance" },
  ];

  return (
    <div className="rounded-[12px] border border-violet-200 bg-violet-50/50 p-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-violet-600" />
        <div className="flex-1">
          <h2 className="text-[18px] font-bold">Your number is ready</h2>
          <p className="mt-1 text-[22px] font-bold text-foreground">{headline}</p>
          {state.vanityDisplay && (
            <p className="text-[13px] text-muted-foreground">{state.displayNumber}</p>
          )}
          <p className="mt-4 text-[14px] font-medium">What would you like this number to do?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="flex items-center gap-3 rounded-[10px] border border-border bg-card p-3 transition hover:border-violet-300 hover:shadow-sm"
              >
                <s.icon className="h-4 w-4 text-violet-600" />
                <div>
                  <p className="text-[13px] font-semibold">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
          <Button variant="outline" className="mt-4 rounded-[10px]" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function PromoPanel() {
  return (
    <div className="rounded-[12px] border border-violet-100 bg-violet-50 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
        <Phone className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-[14px] font-bold text-foreground">First impressions matter</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        A memorable number builds trust, improves recall, and helps customers reach you without
        hunting for digits.
      </p>
    </div>
  );
}

function WhyPremiumPanel() {
  const items = [
    { title: "Trust", desc: "Build immediate credibility" },
    { title: "Recall", desc: "7× more likely to be remembered" },
    { title: "Direct", desc: "No need for extensions" },
    { title: "Market", desc: "Secure a local presence" },
    { title: "Unique", desc: "Stand out from competitors" },
  ];
  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <h3 className="text-[13px] font-bold">Why a premium number?</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.title} className="text-[12px]">
            <span className="font-semibold text-foreground">{item.title}</span>
            <span className="text-muted-foreground"> — {item.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HowItWorksPanel() {
  const steps = ["Search & select", "Instant Reservation", "Secure Payment", "Ready to Use"];
  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <h3 className="text-[13px] font-bold">How it works</h3>
      <ol className="mt-3 space-y-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2 text-[12px]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
              {i + 1}
            </span>
            <span className="text-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function calcRemaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")} remaining`;
}
