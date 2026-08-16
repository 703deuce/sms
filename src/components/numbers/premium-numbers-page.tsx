"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { srCard } from "@/components/smart-routing/shared";
import {
  type PremiumNumberProductResult,
  type PremiumSearchProductResponse,
} from "@/lib/premium-numbers/product-api";
import { formatPremiumPrice } from "@/lib/premium-numbers/premium-pricing";
import { buildVanityDisplay } from "@/lib/premium-numbers/vanity-display";
import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import {
  TOLL_FREE_AREA_CODES,
  parseAreaCodesInput,
  type NumberType,
  type TollFreePrefix,
} from "@/lib/premium-numbers/toll-free";
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
  Trophy,
  Vault,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

const TOLL_FREE_OPTIONS: { value: TollFreePrefix; label: string }[] = [
  { value: "all", label: "All toll-free (800, 833, 866, …)" },
  ...TOLL_FREE_AREA_CODES.map((code) => ({ value: code as TollFreePrefix, label: code })),
];

function splitKeywordInput(text: string): string[] {
  return text
    .split(/[,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

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
  initialMode?: SearchMode;
};

type CheckoutState = {
  reservationId: string;
  phoneNumber: string;
  vanityDisplay?: string;
  displayNumber?: string;
  premiumPriceCents: number;
  expiresAt: string;
  phoneNumberId?: string;
  e164?: string;
};

export function PremiumNumbersPageClient({ workspaceId, initialMode = "business" }: Props) {
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [numberType, setNumberType] = useState<NumberType>("local");
  const [areaCodesInput, setAreaCodesInput] = useState("");
  const [tollFreePrefix, setTollFreePrefix] = useState<TollFreePrefix>("all");
  const [industry, setIndustry] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState("");
  const [extraKeywords, setExtraKeywords] = useState("");
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [preferences, setPreferences] = useState<PersonalPreference[]>(["surprise_me"]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [searchingMore, setSearchingMore] = useState(false);
  const [searchDurationSec, setSearchDurationSec] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [searchResponse, setSearchResponse] = useState<PremiumSearchProductResponse | null>(null);
  const [reserving, setReserving] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [success, setSuccess] = useState<CheckoutState | null>(null);
  const [reserveError, setReserveError] = useState("");

  const parsedAreaCodes = useMemo(() => parseAreaCodesInput(areaCodesInput), [areaCodesInput]);

  const canSearch =
    mode === "personal"
      ? parsedAreaCodes.length > 0
      : numberType === "local"
        ? parsedAreaCodes.length > 0 && industry.trim().length >= 2
        : industry.trim().length >= 2;

  async function onSuggestKeywords() {
    const industryText = industry.trim();
    if (industryText.length < 2) {
      setSuggestError("Enter your industry first");
      return;
    }
    setSuggestingKeywords(true);
    setSuggestError("");
    try {
      const res = await fetch("/api/numbers/premium/suggest-keywords", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ industry: industryText }),
      });
      const data = (await res.json()) as { keywords?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not suggest keywords");
      if (data.keywords?.length) {
        setSuggestedKeywords(data.keywords.join(", "));
      } else {
        setSuggestError("No keyword ideas returned — try different wording.");
      }
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Suggestion failed");
    } finally {
      setSuggestingKeywords(false);
    }
  }

  async function onSearch() {
    setLoading(true);
    setSearchingMore(false);
    setError("");
    setSearchResponse(null);
    setSuccess(null);
    setSearchDurationSec(null);
    const started = performance.now();

    const body =
      mode === "business"
        ? {
            workspaceId,
            mode,
            numberType,
            areaCodes: parsedAreaCodes,
            tollFreePrefix: numberType === "tollfree" ? tollFreePrefix : undefined,
            industry: industry.trim(),
            suggestedKeywords: splitKeywordInput(suggestedKeywords),
            extraKeywords: splitKeywordInput(extraKeywords),
          }
        : {
            workspaceId,
            mode,
            areaCodes: parsedAreaCodes,
            preferences,
          };

    try {
      const res = await fetch("/api/numbers/premium/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Search failed");
      }

      if (contentType.includes("application/x-ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let gotFirst = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const msg = JSON.parse(line) as {
              type: string;
              data?: PremiumSearchProductResponse;
              error?: string;
            };
            if (msg.type === "error") throw new Error(msg.error || "Search failed");
            if (!msg.data) continue;

            setSearchResponse(msg.data);
            setSearchingMore(msg.data.searchStatus === "searching");

            if (!gotFirst) {
              gotFirst = true;
              setLoading(false);
            }
            if (msg.type === "complete" || msg.data.searchStatus === "complete") {
              setSearchingMore(false);
              setSearchDurationSec(Math.round(((performance.now() - started) / 1000) * 10) / 10);
            }
          }
        }

        if (!gotFirst) {
          setSearchDurationSec(Math.round(((performance.now() - started) / 1000) * 10) / 10);
        }
      } else {
        const data = (await res.json()) as PremiumSearchProductResponse & { error?: string };
        setSearchResponse(data);
        setSearchDurationSec(Math.round(((performance.now() - started) / 1000) * 10) / 10);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
      setSearchingMore(false);
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
      if (!res.ok) throw new Error(data.error || "Could not reserve this number");
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
    if (mode === "business") {
      const location =
        numberType === "tollfree"
          ? tollFreePrefix === "all"
            ? "toll-free numbers"
            : `toll-free ${tollFreePrefix}`
          : parsedAreaCodes.length === 1
            ? `area ${parsedAreaCodes[0]}`
            : `areas ${parsedAreaCodes.join(", ")}`;
      const ind = industry.trim();
      const shown = searchResponse.resultCount;
      const business = searchResponse.businessMatchCount;
      const memorable = searchResponse.memorableCount;
      const scanned = searchResponse.inventoryScannedCount;
      const scannedNote =
        scanned != null && scanned > shown ? ` · ${scanned} scanned` : "";
      return `${shown} numbers shown (${business} business, ${memorable} memorable)${scannedNote} in ${searchDurationSec}s for ${ind} · ${location}`;
    }
    const areas =
      parsedAreaCodes.length === 1
        ? `area ${parsedAreaCodes[0]}`
        : `areas ${parsedAreaCodes.join(", ")}`;
    return `${searchResponse.resultCount} memorable numbers found in ${searchDurationSec}s for ${areas}`;
  }, [
    searchResponse,
    searchDurationSec,
    mode,
    parsedAreaCodes,
    numberType,
    tollFreePrefix,
    industry,
  ]);

  const showPreSearch = !searchResponse && !loading && !success;

  return (
    <div className="mx-auto max-w-[1320px] space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-5">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#6366f1]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-[#111827]">
                  Premium Numbers
                </h1>
                <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-[#6b7280]">
                  Find and activate the perfect phone number to stand out and increase caller trust.
                </p>
              </div>
            </div>
            <Link href="/numbers">
              <Button variant="outline" className="h-9 rounded-lg border-[#e5e7eb] text-[13px]">
                <Phone className="h-4 w-4" />
                My Numbers
              </Button>
            </Link>
          </header>

          <div className={cn(srCard, "p-5 md:p-6")}>
            <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
              <PillTab active={mode === "business"} onClick={() => setMode("business")}>
                Business
              </PillTab>
              <PillTab active={mode === "personal"} onClick={() => setMode("personal")}>
                Personal
              </PillTab>
            </div>

            <div className="mt-5">
              {mode === "business" ? (
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">
                      Number type
                    </p>
                    <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
                      <PillTab active={numberType === "local"} onClick={() => setNumberType("local")}>
                        Local number
                      </PillTab>
                      <PillTab active={numberType === "tollfree"} onClick={() => setNumberType("tollfree")}>
                        Toll-free
                      </PillTab>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {numberType === "local" ? (
                      <Field
                        label="Area codes"
                        required
                        hint="Add multiple — comma separated"
                      >
                        <Input
                          value={areaCodesInput}
                          onChange={(e) =>
                            setAreaCodesInput(e.target.value.replace(/[^\d,\s]/g, ""))
                          }
                          placeholder="e.g. 571, 703, 540"
                          className="h-11 rounded-lg border-[#e5e7eb] bg-white text-[14px]"
                        />
                      </Field>
                    ) : (
                      <Field label="Toll-free prefix" required>
                        <select
                          className="flex h-11 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px]"
                          value={tollFreePrefix}
                          onChange={(e) => setTollFreePrefix(e.target.value as TollFreePrefix)}
                        >
                          {TOLL_FREE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </Field>
                    )}

                    <Field label="Industry" required hint="What type of business are you?">
                      <Input
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        placeholder="e.g. Plumbing, Roofing, Junk removal"
                        className="h-11 rounded-lg border-[#e5e7eb] bg-white text-[14px]"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field
                      label="Keyword ideas"
                      hint="We’ll search words that fit your industry"
                    >
                      <Textarea
                        value={suggestedKeywords}
                        onChange={(e) => setSuggestedKeywords(e.target.value)}
                        placeholder="Filled automatically — or click Suggest keywords"
                        className="min-h-[88px] rounded-lg border-[#e5e7eb] bg-white text-[14px]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={suggestingKeywords || industry.trim().length < 2}
                        onClick={onSuggestKeywords}
                        className="mt-2 h-9 rounded-lg border-[#e5e7eb] text-[13px]"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        {suggestingKeywords ? "Finding keyword ideas…" : "Suggest keywords"}
                      </Button>
                      {suggestError ? (
                        <p className="mt-1 text-[12px] text-destructive">{suggestError}</p>
                      ) : null}
                    </Field>

                    <Field
                      label="Extra keywords (optional)"
                      hint="Business name, nicknames — e.g. MIKE for Mike’s Plumbing"
                    >
                      <Input
                        value={extraKeywords}
                        onChange={(e) => setExtraKeywords(e.target.value)}
                        placeholder="e.g. MIKE, PRO"
                        className="h-11 rounded-lg border-[#e5e7eb] bg-white text-[14px]"
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Field
                    label="Area codes"
                    required
                    hint="Add multiple — comma separated"
                  >
                    <Input
                      value={areaCodesInput}
                      onChange={(e) =>
                        setAreaCodesInput(e.target.value.replace(/[^\d,\s]/g, ""))
                      }
                      placeholder="e.g. 571, 703, 540"
                      className="h-11 max-w-md rounded-lg border-[#e5e7eb] bg-white text-[14px]"
                    />
                  </Field>
                  <div>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">
                      Pattern preferences
                    </p>
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
                              "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition",
                              active
                                ? "border-[#6366f1] bg-[#6366f1] text-white shadow-sm"
                                : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#c7d2fe]",
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
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button
                onClick={onSearch}
                disabled={loading || !canSearch}
                className="h-11 min-w-[220px] rounded-lg bg-[#6366f1] px-8 text-[14px] font-semibold shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:bg-[#5558e3]"
              >
                {loading ? "Searching live inventory…" : "Find Premium Numbers"}
              </Button>
            </div>

            {loading && (
              <p className="mt-3 text-[13px] text-[#6b7280]">
                Checking business-word and memorable-number combinations…
              </p>
            )}
            {searchResponse && resultSummary && (
              <p className="mt-3 text-[13px] font-medium text-[#6366f1]">{resultSummary}</p>
            )}
            {searchingMore && (
              <p className="mt-2 text-[13px] text-[#6b7280]">
                Still searching
                {searchResponse?.pendingProviders?.length
                  ? ` ${searchResponse.pendingProviders.join(" and ")}`
                  : " providers"}
                for more numbers…
              </p>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
          {reserveError && <p className="text-destructive text-sm">{reserveError}</p>}

          {showPreSearch && <PreSearchHero />}

          {success ? <SuccessPanel state={success} onClose={() => setSuccess(null)} /> : null}

          {searchResponse && !success && mode === "business" && (
            <BusinessResults
              response={searchResponse}
              reserving={reserving}
              favorites={favorites}
              onToggleFavorite={(phone) => toggleFavorite(phone, setFavorites)}
              onGetNumber={onGetNumber}
            />
          )}

          {searchResponse && !success && mode === "personal" && (
            <PersonalResults
              response={searchResponse}
              reserving={reserving}
              favorites={favorites}
              onToggleFavorite={(phone) => toggleFavorite(phone, setFavorites)}
              onGetNumber={onGetNumber}
            />
          )}
        </div>

        <aside className="w-full shrink-0 space-y-4 xl:w-[272px]">
          <GuidanceRail />
        </aside>
      </div>

      {checkout && !success && (
        <CheckoutModal
          state={checkout}
          workspaceId={workspaceId}
          onClose={() => setCheckout(null)}
          onComplete={(result) => {
            setSuccess({ ...checkout, ...result });
            setCheckout(null);
          }}
        />
      )}
    </div>
  );
}

function toggleFavorite(
  phone: string,
  setFavorites: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  setFavorites((prev) => {
    const next = new Set(prev);
    if (next.has(phone)) next.delete(phone);
    else next.add(phone);
    return next;
  });
}

function PillTab({
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
        "rounded-md px-4 py-2 text-[13px] font-semibold transition",
        active
          ? "bg-white text-[#111827] shadow-sm ring-1 ring-[#e5e7eb]"
          : "text-[#6b7280] hover:text-[#111827]",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {hint ? <p className="text-[11px] text-[#9ca3af]">{hint}</p> : null}
      {children}
    </div>
  );
}

function PreSearchHero() {
  const examples = [
    { vanity: "571-704-ROOF", numeric: "571-704-7663", tag: "Business word" },
    { vanity: "571-240-1111", numeric: "571-240-1111", tag: "Memorable" },
    { vanity: "866-296-MOWER", numeric: "866-296-6937", tag: "Toll-free" },
  ];
  return (
    <div className={cn(srCard, "p-6 md:p-8")}>
      <h2 className="text-[20px] font-bold text-[#111827]">
        Find a number customers remember
      </h2>
      <p className="mt-2 max-w-xl text-[14px] text-[#6b7280]">
        Search live inventory for industry words, vanity spellings, and highly memorable numeric patterns — ranked for your business.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {examples.map((ex) => (
          <div
            key={ex.vanity}
            className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4"
          >
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#6366f1]">
              {ex.tag}
            </span>
            <p className="mt-2 text-[18px] font-bold text-[#111827]">{ex.vanity}</p>
            <p className="text-[12px] text-[#9ca3af]">{ex.numeric}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-6 text-[13px] text-[#6b7280]">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef2ff] text-[11px] font-bold text-[#6366f1]">1</span>
          Search by area & industry
        </span>
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef2ff] text-[11px] font-bold text-[#6366f1]">2</span>
          Choose your number
        </span>
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef2ff] text-[11px] font-bold text-[#6366f1]">3</span>
          Reserve & activate
        </span>
      </div>
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
  return (
    <div className="space-y-8">
      {response.bestMatches.length > 0 ? (
        <ResultSection
          title="Best Matches For Your Business"
          count={response.bestMatches.length}
          icon={Trophy}
          results={response.bestMatches}
          reserving={reserving}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onGetNumber={onGetNumber}
          variant="business"
        />
      ) : (
        <div className={cn(srCard, "border-dashed p-6 text-center")}>
          <p className="text-[15px] font-semibold text-[#111827]">
            No exact business-word matches in this area code
          </p>
          <p className="mt-1 text-[13px] text-[#6b7280]">
            Try another keyword or area code — memorable alternatives may appear below.
          </p>
        </div>
      )}

      {response.memorableAlternatives.length > 0 && (
        <ResultSection
          title="Other Memorable Numbers"
          count={response.memorableAlternatives.length}
          icon={Lightbulb}
          subtitle="See all"
          results={response.memorableAlternatives}
          reserving={reserving}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onGetNumber={onGetNumber}
          variant="memorable"
        />
      )}
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
      <div className={cn(srCard, "border-dashed p-6 text-center")}>
        <p className="text-[15px] font-semibold">No memorable numbers in this area code.</p>
        <p className="mt-1 text-[13px] text-[#6b7280]">Try different preferences or another area code.</p>
      </div>
    );
  }

  return (
    <ResultSection
      title="Top Picks"
      count={picks.length}
      icon={Sparkles}
      results={picks}
      reserving={reserving}
      favorites={favorites}
      onToggleFavorite={onToggleFavorite}
      onGetNumber={onGetNumber}
      variant="memorable"
    />
  );
}

function ResultSection({
  title,
  count,
  icon: Icon,
  subtitle,
  results,
  reserving,
  favorites,
  onToggleFavorite,
  onGetNumber,
  variant,
}: {
  title: string;
  count: number;
  icon: typeof Trophy;
  subtitle?: string;
  results: PremiumNumberProductResult[];
  reserving: string | null;
  favorites: Set<string>;
  onToggleFavorite: (phone: string) => void;
  onGetNumber: (r: PremiumNumberProductResult) => void;
  variant: "business" | "memorable";
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef2ff] text-[#6366f1]">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[16px] font-bold text-[#111827]">{title}</h2>
            <p className="text-[12px] text-[#6b7280]">{count} numbers</p>
          </div>
        </div>
        {subtitle ? (
          <button type="button" className="text-[13px] font-medium text-[#6366f1] hover:underline">
            {subtitle}
          </button>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => (
          <NumberCard
            key={result.phoneNumber}
            result={result}
            variant={variant}
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
  variant,
  loading,
  favorited,
  onToggleFavorite,
  onGetNumber,
}: {
  result: PremiumNumberProductResult;
  variant: "business" | "memorable";
  loading: boolean;
  favorited: boolean;
  onToggleFavorite: () => void;
  onGetNumber: () => void;
}) {
  const vanityTitle =
    result.vanityDisplay ??
    (result.displayWord
      ? buildVanityDisplay(result.phoneNumber, [result.displayWord])
      : undefined);
  const heroTitle = vanityTitle ?? result.displayNumber;
  const subNumber = vanityTitle ? result.displayNumber : null;

  const badge =
    variant === "business" &&
    result.displayWord &&
    result.wordPlacement === "ending" &&
    result.businessMatchScore >= 75
      ? "EXACT MATCH"
      : variant === "business" &&
          result.displayWord &&
          result.wordPlacement === "ending" &&
          result.businessMatchScore >= 55
        ? "STRONG MATCH"
        : variant === "business" &&
            result.displayWord &&
            result.wordPlacement === "embedded"
          ? "KEYWORD MATCH"
        : result.premiumPriceBand === "exceptional" || result.numberQualityScore >= 80
          ? "BEST MATCH"
          : null;

  const bullets = result.cardBullets.length ? result.cardBullets : result.whyReasons.slice(0, 3);

  return (
    <div className={cn(srCard, "relative flex flex-col p-5 transition hover:shadow-md")}>
      {badge ? (
        <span className="absolute left-4 top-4 rounded-md bg-[#6366f1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {badge}
        </span>
      ) : null}

      <div className={cn("flex-1", badge && "pt-6")}>
        <p className="text-[28px] font-bold leading-tight tracking-tight text-[#111827]">
          {heroTitle}
        </p>
        {subNumber && (
          <p className="mt-1 text-[14px] font-medium text-[#9ca3af]">{subNumber}</p>
        )}

        <p className="mt-3 text-[13px] font-semibold text-[#6366f1]">{result.headlineLabel}</p>

        {bullets.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[12px] leading-snug text-[#6b7280]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#6366f1]" />
                {b}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <p className="text-[22px] font-bold text-[#111827]">
            {formatPremiumPrice(result.premiumPriceCents)}
          </p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af]">
            one-time premium
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Button
          className="h-11 w-full rounded-lg bg-[#6366f1] text-[14px] font-semibold hover:bg-[#5558e3]"
          disabled={loading}
          onClick={onGetNumber}
        >
          {loading ? "Reserving…" : "Get This Number"}
        </Button>
        <div className="flex items-center justify-between gap-2">
          {result.whyReasons.length > 0 ? (
            <details className="min-w-0 flex-1">
              <summary className="cursor-pointer text-[11px] font-medium text-[#9ca3af] hover:text-[#6366f1]">
                Why this number?
              </summary>
              <ul className="mt-1 space-y-0.5 text-[11px] text-[#6b7280]">
                {result.whyReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </details>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onToggleFavorite}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] transition",
              favorited ? "bg-rose-50 text-rose-500 border-rose-200" : "text-[#9ca3af] hover:text-rose-500",
            )}
            aria-label="Save favorite"
          >
            <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
          </button>
        </div>
      </div>
    </div>
  );
}

function GuidanceRail() {
  const steps = ["Search", "Choose", "Reserve", "Pay", "Activate"];
  return (
  <>
    <div className={cn(srCard, "border-[#e0e7ff] bg-[#f5f3ff] p-4")}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6366f1] text-white">
        <Phone className="h-4 w-4" />
      </div>
      <h3 className="mt-3 text-[14px] font-bold text-[#111827]">Find the perfect number</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-[#6b7280]">
        Vanity words and memorable patterns ranked for your business — not raw carrier search.
      </p>
    </div>
    <div className={cn(srCard, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">How it works</h3>
      <ol className="mt-3 space-y-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2.5 text-[12px]">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[10px] font-bold text-[#6366f1]">
              {i + 1}
            </span>
            <span className="text-[#374151]">{step}</span>
          </li>
        ))}
      </ol>
      <ul className="mt-4 space-y-2 border-t border-[#e5e7eb] pt-3">
        {["Next-day activation", "No hidden costs", "Cancel anytime"].map((item) => (
          <li key={item} className="flex items-center gap-2 text-[11px] text-[#6b7280]">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  </>
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
  onComplete: (result: { phoneNumberId?: string; e164?: string }) => void;
}) {
  const [remaining, setRemaining] = useState(() => calcRemaining(state.expiresAt));
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/numbers/premium/reservation/${state.reservationId}?workspaceId=${workspaceId}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.reservationExpiresAt) {
        setRemaining(calcRemaining(data.reservationExpiresAt));
      }
    } catch {
      // ignore
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
      <div className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
        <h3 className="text-[18px] font-bold">Reserved for you</h3>
        <p className="mt-2 text-[26px] font-bold text-[#6366f1]">{headline}</p>
        {state.vanityDisplay && (
          <p className="text-[14px] text-[#6b7280]">{state.displayNumber}</p>
        )}
        <div className="mt-4 rounded-lg bg-[#f5f3ff] p-4">
          <p className="text-[20px] font-bold">
            {formatPremiumPrice(state.premiumPriceCents)}
            <span className="text-[12px] font-normal text-[#6b7280]"> one-time premium</span>
          </p>
        </div>
        <p className="mt-4 text-[13px] text-[#6b7280]">
          {expired ? "Reservation expired — search again." : `Time remaining: ${formatCountdown(remaining)}`}
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-lg" onClick={onClose} disabled={purchasing}>
            Back
          </Button>
          <Button
            className="flex-1 rounded-lg bg-[#6366f1] hover:bg-[#5558e3]"
            disabled={expired || purchasing}
            onClick={async () => {
              setPurchasing(true);
              setPurchaseError("");
              try {
                const res = await fetch("/api/numbers/premium/complete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    workspaceId,
                    reservationId: state.reservationId,
                    idempotencyKey: `premium:${state.reservationId}`,
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  throw new Error(data.error || data.status || "Purchase failed");
                }
                onComplete({ phoneNumberId: data.phoneNumberId, e164: data.e164 });
              } catch (err) {
                setPurchaseError(err instanceof Error ? err.message : "Purchase failed");
              } finally {
                setPurchasing(false);
              }
            }}
          >
            {purchasing ? "Purchasing…" : "Complete purchase (test payment)"}
          </Button>
        </div>
        {purchaseError ? (
          <p className="mt-3 text-[13px] text-red-600">{purchaseError}</p>
        ) : null}
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
    { label: "Park This Number", href: "/numbers", icon: Vault },
    { label: "Forward Calls", href: "/phone/settings", icon: Forward },
    { label: "Smart Routing", href: "/smart-routing", icon: Phone },
    { label: "AI Receptionist", href: "/voice/receptionist", icon: Brain },
    { label: "Business Texting", href: "/compliance", icon: MessageSquare },
  ];

  return (
    <div className={cn(srCard, "border-[#e0e7ff] bg-[#faf5ff] p-6")}>
      <CheckCircle2 className="h-6 w-6 text-[#6366f1]" />
      <h2 className="mt-2 text-[18px] font-bold">Your number is ready</h2>
      <p className="mt-1 text-[24px] font-bold">{headline}</p>
      {state.vanityDisplay && (
        <p className="text-[13px] text-[#6b7280]">{state.displayNumber}</p>
      )}
      <p className="mt-4 text-[14px] font-semibold">What would you like this number to do?</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {services.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white p-3 text-[13px] font-medium hover:border-[#c7d2fe]"
          >
            <s.icon className="h-4 w-4 text-[#6366f1]" />
            {s.label}
            <ArrowRight className="ml-auto h-3.5 w-3.5 text-[#9ca3af]" />
          </Link>
        ))}
      </div>
      <Button variant="outline" className="mt-4 rounded-lg" onClick={onClose}>Close</Button>
    </div>
  );
}

function calcRemaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
