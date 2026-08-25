"use client";

import { Button } from "@/components/ui/button";
import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

const CRM_PROVIDERS = [
  { id: "salesforce", label: "Salesforce" },
  { id: "zoho", label: "Zoho" },
  { id: "pipedrive", label: "Pipedrive" },
  { id: "calendly", label: "Calendly" },
];

/**
 * Client-side controls for the contacts table CRM columns + filters.
 * State lives entirely in the URL query string so the server component can
 * batch-load and filter without any client data fetching.
 */
export function ContactCrmControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const showCrm = searchParams.get("crm") === "1";
  const crmConnected = searchParams.get("crmConnected") || "";
  const provider = searchParams.get("provider") || "";
  const syncError = searchParams.get("syncError") === "1";
  const unmapped = searchParams.get("unmapped") === "1";

  const activeFilters =
    (crmConnected ? 1 : 0) +
    (provider ? 1 : 0) +
    (syncError ? 1 : 0) +
    (unmapped ? 1 : 0);

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const anyCrmView = showCrm || activeFilters > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={showCrm ? "primary" : "outline"}
          size="sm"
          className="text-[13px]"
          onClick={() => setParam({ crm: showCrm ? null : "1" })}
        >
          {showCrm ? "Hide CRM columns" : "Show CRM columns"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-[13px]"
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          CRM filters
          {activeFilters > 0 ? (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {activeFilters}
            </span>
          ) : null}
        </Button>
        {activeFilters > 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() =>
              setParam({
                crmConnected: null,
                provider: null,
                syncError: null,
                unmapped: null,
              })
            }
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-border bg-muted/30 p-3">
          <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
            CRM-connected
            <select
              className="h-8 rounded-[8px] border border-border bg-card px-2 text-[13px] text-foreground"
              value={crmConnected}
              onChange={(e) =>
                setParam({ crmConnected: e.target.value || null, crm: "1" })
              }
            >
              <option value="">Any</option>
              <option value="yes">Connected</option>
              <option value="no">Not connected</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
            Provider
            <select
              className="h-8 rounded-[8px] border border-border bg-card px-2 text-[13px] text-foreground"
              value={provider}
              onChange={(e) =>
                setParam({ provider: e.target.value || null, crm: "1" })
              }
            >
              <option value="">Any provider</option>
              {CRM_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={syncError}
              onChange={(e) =>
                setParam({ syncError: e.target.checked ? "1" : null, crm: "1" })
              }
            />
            Sync error
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={unmapped}
              onChange={(e) =>
                setParam({ unmapped: e.target.checked ? "1" : null, crm: "1" })
              }
            />
            Unmapped (no CRM link)
          </label>
        </div>
      ) : null}

      {anyCrmView ? (
        <p className="text-[12px] text-muted-foreground">
          CRM columns are read from the last successful sync. Provider, mapping,
          and appointment data load in a single batched query.
        </p>
      ) : null}
    </div>
  );
}
