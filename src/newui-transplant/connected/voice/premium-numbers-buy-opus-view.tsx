"use client";

import Link from "next/link";
import { Heart, Wand2 } from "lucide-react";
import { usePremiumNumberSearch } from "@/lib/premium-numbers/use-premium-number-search";
import { formatPremiumPrice } from "@/lib/premium-numbers/premium-pricing";
import { buildVanityDisplay } from "@/lib/premium-numbers/vanity-display";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import {
  TOLL_FREE_AREA_CODES,
  type TollFreePrefix,
} from "@/lib/premium-numbers/toll-free";
import { EmptyState, FieldRow, Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { Textarea } from "@/newui-transplant/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/newui-transplant/components/ui/select";
import { PremiumCheckoutOpusDialog } from "@/newui-transplant/components/voice/premium-checkout-opus-dialog";
import { PremiumSuccessOpus } from "@/newui-transplant/components/voice/premium-success-opus";
import { cn } from "@/lib/utils";

const TOLL_FREE_OPTIONS: { value: TollFreePrefix; label: string }[] = [
  { value: "all", label: "All toll-free" },
  ...TOLL_FREE_AREA_CODES.map((code) => ({ value: code as TollFreePrefix, label: code })),
];

function Segmented({
  value,
  options,
  onChange,
  label,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              value === o.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberResultRow({
  result,
  favorited,
  loading,
  onFavorite,
  onSelect,
}: {
  result: PremiumNumberProductResult;
  favorited: boolean;
  loading: boolean;
  onFavorite: () => void;
  onSelect: () => void;
}) {
  const vanityTitle =
    result.vanityDisplay ??
    (result.displayWord ? buildVanityDisplay(result.phoneNumber, [result.displayWord]) : undefined);
  const title = vanityTitle ?? result.displayNumber;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold">{title}</p>
        {vanityTitle && result.displayNumber ? (
          <p className="text-xs text-muted-foreground">{result.displayNumber}</p>
        ) : null}
        <p className="mt-0.5 text-xs text-muted-foreground">{formatPremiumPrice(result.premiumPriceCents)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={onFavorite} aria-label={favorited ? "Remove favorite" : "Favorite"}>
          <Heart className={cn("size-4", favorited ? "fill-primary text-primary" : "text-muted-foreground")} />
        </Button>
        <Button type="button" size="sm" disabled={loading} onClick={onSelect}>
          {loading ? "Reserving…" : "Get number"}
        </Button>
      </div>
    </div>
  );
}

function ResultBlock({
  title,
  results,
  reserving,
  favorites,
  onFavorite,
  onGetNumber,
}: {
  title: string;
  results: PremiumNumberProductResult[];
  reserving: string | null;
  favorites: Set<string>;
  onFavorite: (phone: string) => void;
  onGetNumber: (r: PremiumNumberProductResult) => void;
}) {
  if (!results.length) return null;
  return (
    <Panel title={title} description={`${results.length} numbers`} bodyClassName="px-5 py-2">
      {results.map((r) => (
        <NumberResultRow
          key={r.phoneNumber}
          result={r}
          favorited={favorites.has(r.phoneNumber)}
          loading={reserving === r.phoneNumber}
          onFavorite={() => onFavorite(r.phoneNumber)}
          onSelect={() => onGetNumber(r)}
        />
      ))}
    </Panel>
  );
}

export function PremiumNumbersBuyOpusView({ workspaceId }: { workspaceId: string }) {
  const s = usePremiumNumberSearch(workspaceId, "business");

  return (
    <div className="space-y-6">
      <Panel title="Search numbers" description="Business local or toll-free numbers ranked for your industry.">
        <Segmented
          label="Number type"
          value={s.numberType}
          options={[
            { id: "local", label: "Local" },
            { id: "tollfree", label: "Toll-free" },
          ]}
          onChange={(id) => s.setNumberType(id as "local" | "tollfree")}
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {s.numberType === "local" ? (
            <div className="space-y-1.5">
              <Label htmlFor="area-codes">Area codes</Label>
              <Input
                id="area-codes"
                value={s.areaCodesInput}
                onChange={(e) => s.setAreaCodesInput(e.target.value.replace(/[^\d,\s]/g, ""))}
                placeholder="571, 703, 540"
              />
              <p className="text-xs text-muted-foreground">Comma-separated area codes.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="tf-prefix">Toll-free prefix</Label>
              <Select value={s.tollFreePrefix} onValueChange={(v) => s.setTollFreePrefix(v as TollFreePrefix)}>
                <SelectTrigger id="tf-prefix">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOLL_FREE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={s.industry}
              onChange={(e) => s.setIndustry(e.target.value)}
              placeholder="Plumbing, roofing, junk removal…"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="keywords">Keyword ideas</Label>
            <Textarea
              id="keywords"
              value={s.suggestedKeywords}
              onChange={(e) => s.setSuggestedKeywords(e.target.value)}
              placeholder="Filled automatically or edit manually"
              rows={3}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={s.suggestingKeywords || s.industry.trim().length < 2}
              onClick={() => void s.onSuggestKeywords()}
            >
              <Wand2 className="size-3.5" />
              {s.suggestingKeywords ? "Suggesting…" : "Suggest keywords"}
            </Button>
            {s.suggestError ? <p className="text-xs text-destructive">{s.suggestError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="extra-kw">Extra keywords (optional)</Label>
            <Input
              id="extra-kw"
              value={s.extraKeywords}
              onChange={(e) => s.setExtraKeywords(e.target.value)}
              placeholder="Business name, nicknames"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="button" disabled={s.loading || !s.canSearch} onClick={() => void s.onSearch()}>
            {s.loading ? "Searching…" : "Search numbers"}
          </Button>
        </div>

        {s.searchingMore ? (
          <p className="mt-2 text-xs text-muted-foreground">Still searching providers for more numbers…</p>
        ) : null}
        {s.error ? <p className="mt-2 text-sm text-destructive" role="alert">{s.error}</p> : null}
        {s.reserveError ? <p className="mt-2 text-sm text-destructive" role="alert">{s.reserveError}</p> : null}
      </Panel>

      {s.showPreSearch ? (
        <Panel>
          <EmptyState
            icon={Heart}
            title="Find a number customers remember"
            description="Search live inventory for industry words and memorable patterns ranked for your business."
            action={
              <p className="text-xs text-muted-foreground">
                Enter area codes and industry, then search.
              </p>
            }
          />
        </Panel>
      ) : null}

      {s.success ? <PremiumSuccessOpus state={s.success} onClose={() => s.setSuccess(null)} /> : null}

      {s.searchResponse && !s.success ? (
        <div className="space-y-4">
          {(s.searchResponse.topPicks ?? []).length > 0 ? (
            <ResultBlock
              title="Top picks"
              results={s.searchResponse.topPicks ?? []}
              reserving={s.reserving}
              favorites={s.favorites}
              onFavorite={s.toggleFavorite}
              onGetNumber={(r) => void s.onGetNumber(r)}
            />
          ) : null}
          <ResultBlock
            title="Best matches for your business"
            results={s.searchResponse.bestMatches}
            reserving={s.reserving}
            favorites={s.favorites}
            onFavorite={s.toggleFavorite}
            onGetNumber={(r) => void s.onGetNumber(r)}
          />
          <ResultBlock
            title="Other memorable numbers"
            results={s.searchResponse.memorableAlternatives}
            reserving={s.reserving}
            favorites={s.favorites}
            onFavorite={s.toggleFavorite}
            onGetNumber={(r) => void s.onGetNumber(r)}
          />
        </div>
      ) : null}

      {s.checkout && !s.success ? (
        <PremiumCheckoutOpusDialog
          state={s.checkout}
          workspaceId={workspaceId}
          onClose={() => s.setCheckout(null)}
          onComplete={(result) => {
            s.setSuccess({ ...s.checkout!, ...result });
            s.setCheckout(null);
          }}
        />
      ) : null}
    </div>
  );
}
