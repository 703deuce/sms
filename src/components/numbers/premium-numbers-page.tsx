"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  PREMIUM_INDUSTRY_OPTIONS,
  type PremiumNumberProductResult,
  type PremiumSearchProductResponse,
} from "@/lib/premium-numbers/product-api";
import { inferIndustryFromText } from "@/lib/premium-numbers/business-name-keywords";
import { formatPremiumPrice } from "@/lib/premium-numbers/premium-pricing";
import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Forward,
  Heart,
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
  const [pattern, setPattern] = useState("contains");
  const [searchTerm, setSearchTerm] = useState("roof, roofer, home");
  const [preferences, setPreferences] = useState<PersonalPreference[]>(["surprise_me"]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [searchDurationSec, setSearchDurationSec] = useState<number | null>(null);
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
    setSearchDurationSec(null);
    const started = performance.now();
    try {
      const customList = searchTerm
        .split(/[,]+/)
        .map((k) => k.trim())
        .filter(Boolean);
      const inferredIndustry = inferIndustryFromText(searchTerm) ?? "roofing";

      const res = await fetch("/api/numbers/premium/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          mode,
          areaCode: areaCode.trim(),
          industry: mode === "business" ? inferredIndustry : undefined,
          customKeywords: mode === "business" ? customList : undefined,
          preferences: mode === "personal" ? preferences : undefined,
        }),
      });
      const data = (await res.json()) as PremiumSearchProductResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Search failed");
      setSearchResponse(data);
      setSearchDurationSec(Math.round(((performance.now() - started) / 1000) * 10) / 10);
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
    if (!searchResponse || searchDurationSec === null) return "";
    const keyword = inferIndustryFromText(searchTerm) ?? searchTerm.split(",")[0]?.trim() ?? "your search";
    if (mode === "business") {
      return `${searchResponse.resultCount} results found in ${searchDurationSec} seconds for keyword: ${keyword}`;
    }
    return `${searchResponse.resultCount} results found in ${searchDurationSec} seconds for area ${areaCode}`;
  }, [searchResponse, searchDurationSec, mode, areaCode, searchTerm]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-5">
          <header>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[10px] bg-violet-50 text-violet-600">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-[24px] font-bold tracking-tight text-foreground">
                  Premium Numbers
                </h1>
                <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
                  Find and select the perfect phone number for your business or personal use.
                </p>
              </div>
            </div>
          </header>

          <div className="flex gap-6 border-b border-border">
            <UnderlineTab active={mode === "business"} onClick={() => setMode("business")}>
              Business
            </UnderlineTab>
            <UnderlineTab active={mode === "personal"} onClick={() => setMode("personal")}>
              Personal
            </UnderlineTab>
          </div>

          <div className="rounded-[12px] border border-[#e5e7eb] bg-[#fafafa] p-4 md:p-5">
            {mode === "business" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Area Code" required>
                  <select
                    className="border-input bg-card flex h-10 w-full rounded-[10px] border px-3 text-[13px]"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  >
                    <option value="571">571</option>
                    <option value="540">540</option>
                    <option value="703">703</option>
                    <option value="415">415</option>
                    <option value="310">310</option>
                  </select>
                </Field>
                <Field label="Pattern">
                  <select
                    className="border-input bg-card flex h-10 w-full rounded-[10px] border px-3 text-[13px]"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                  >
                    <option value="contains">Contains</option>
                    <option value="ends_with">Ends with</option>
                  </select>
                </Field>
                <Field label="Search Term / Keyword">
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="any, blue, roofing"
                    className="h-10 rounded-[10px] bg-card"
                  />
                </Field>
                <Field label="Select Phone Number">
                  <select
                    className="border-input bg-card flex h-10 w-full rounded-[10px] border px-3 text-[13px]"
                    defaultValue="US"
                  >
                    <option value="US">🇺🇸 United States</option>
                  </select>
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
              <Button variant="outline" className="h-10 rounded-[10px] border-dashed text-[13px]">
                Add Filter +
              </Button>
              <Button
                onClick={onSearch}
                disabled={loading || areaCode.length !== 3}
                className="h-10 min-w-[200px] rounded-[10px] bg-[#6B46C1] px-8 hover:bg-[#5b3ba8]"
              >
                {loading ? "Searching…" : "Search for numbers"}
              </Button>
            </div>
            {loading && (
              <p className="mt-3 text-[12px] text-muted-foreground">
                Checking business-word and memorable-number combinations…
              </p>
            )}
            {searchResponse && resultSummary && (
              <p className="mt-3 text-[12px] text-muted-foreground">{resultSummary}</p>
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
              favorites={favorites}
              onToggleFavorite={(phone) => {
                setFavorites((prev) => {
                  const next = new Set(prev);
                  if (next.has(phone)) next.delete(phone);
                  else next.add(phone);
                  return next;
                });
              }}
              onGetNumber={onGetNumber}
            />
          )}

          {searchResponse && !success && mode === "personal" && (
            <PersonalResults
              response={searchResponse}
              reserving={reserving}
              favorites={favorites}
              onToggleFavorite={(phone) => {
                setFavorites((prev) => {
                  const next = new Set(prev);
                  if (next.has(phone)) next.delete(phone);
                  else next.add(phone);
                  return next;
                });
              }}
              onGetNumber={onGetNumber}
            />
          )}
        </div>

        <aside className="w-full shrink-0 space-y-4 xl:w-[280px]">
          <PromoPanel />
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

function UnderlineTab({
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
        "pb-2.5 text-[14px] font-semibold transition",
        active
          ? "border-b-[3px] border-[#6B46C1] text-foreground"
          : "border-b-[3px] border-transparent text-muted-foreground hover:text-foreground",
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
  favorites,
  onToggleFavorite,
  onGetNumber,
}: {
  response: PremiumSearchProductResponse;
  reserving: string | null;
  favorites: Set<string>;
  onToggleFavorite: (phone: string) => void;
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
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
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
          title="Other Memorable Numbers For The City"
          icon={Lightbulb}
          subtitle="See all"
          results={response.memorableAlternatives}
          reserving={reserving}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onGetNumber={onGetNumber}
        />
      ) : null}
    </div>
  );
}

function PersonalResults({
  response,
  reserving,
  favorites,
  onToggleFavorite,
  onGetNumber,
}: {
  response: PremiumSearchProductResponse;
  reserving: string | null;
  favorites: Set<string>;
  onToggleFavorite: (phone: string) => void;
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
      favorites={favorites}
      onToggleFavorite={onToggleFavorite}
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
  favorites,
  onToggleFavorite,
  onGetNumber,
}: {
  title: string;
  icon: typeof Trophy;
  subtitle?: string;
  results: PremiumNumberProductResult[];
  reserving: string | null;
  favorites: Set<string>;
  onToggleFavorite: (phone: string) => void;
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
          <button type="button" className="text-[12px] font-medium text-[#6B46C1] hover:underline">
            {subtitle}
          </button>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {results.map((result) => (
          <NumberCard
            key={result.phoneNumber}
            result={result}
            loading={reserving === result.phoneNumber}
            favorited={favorites.has(result.phoneNumber)}
            onToggleFavorite={() => onToggleFavorite(result.phoneNumber)}
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
  favorited,
  onToggleFavorite,
  onGetNumber,
}: {
  result: PremiumNumberProductResult;
  loading: boolean;
  favorited: boolean;
  onToggleFavorite: () => void;
  onGetNumber: () => void;
}) {
  const badge =
    result.premiumPriceBand === "strong" || result.premiumPriceBand === "exceptional"
      ? "BEST DEAL"
      : result.businessMatchScore >= 55
        ? "MATCH"
        : null;

  const features = ["Instant activation", "Mobile ready", "Free setup"];

  return (
    <div className="relative flex flex-col rounded-[12px] border border-border bg-card p-4 shadow-sm">
      {badge ? (
        <span className="absolute left-3 top-3 rounded-md bg-[#6B46C1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {badge}
        </span>
      ) : null}

      <div className="mt-5 flex-1">
        <p className="text-[22px] font-bold tracking-tight text-foreground">{result.displayNumber}</p>
        {result.vanityDisplay && (
          <p className="mt-1 text-[14px] font-semibold text-emerald-600">{result.vanityDisplay}</p>
        )}
        <ul className="mt-3 space-y-1">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[18px] font-bold text-foreground">
            {formatPremiumPrice(result.premiumPriceCents)}
          </p>
          <StarRow rating={result.starRating} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          className="h-10 flex-1 rounded-[10px] bg-[#6B46C1] hover:bg-[#5b3ba8]"
          disabled={loading}
          onClick={onGetNumber}
        >
          {loading ? "Reserving…" : "Get this number"}
        </Button>
        <button
          type="button"
          onClick={onToggleFavorite}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-[10px] border border-border transition",
            favorited ? "bg-rose-50 text-rose-500" : "bg-card text-muted-foreground hover:text-rose-500",
          )}
          aria-label="Favorite"
        >
          <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
        </button>
      </div>
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
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
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
    <div className="rounded-[12px] border border-violet-100 bg-violet-50 p-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
        <Phone className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-[14px] font-bold text-foreground">Get the perfect number</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Our experts help you find a brand-specific number customers will remember on the first call.
      </p>
    </div>
  );
}

function HowItWorksPanel() {
  const steps = [
    "Search for keyword",
    "Choose a number",
    "Pay & Activate",
    "Use it!",
  ];
  const checks = [
    "Next day activation",
    "No hidden costs",
    "Cancel anytime",
    "Local & Toll-free",
  ];
  return (
    <div className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
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
      <ul className="mt-4 space-y-2 border-t border-border pt-4">
        {checks.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {item}
          </li>
        ))}
      </ul>
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
