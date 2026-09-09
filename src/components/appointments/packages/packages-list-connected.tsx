"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Copy, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import {
  formatPackagePrice,
  packageCreditsSummary,
  packageIsActive,
  packageValidityLabel,
  type PackageProductRow,
} from "@/lib/appointments/packages/package-display";
import "@/components/appointments/kimi-ui/overview/reference.css";

export function PackagesListConnected() {
  const [rows, setRows] = useState<PackageProductRow[]>([]);
  const [customerCounts, setCustomerCounts] = useState<Map<string, number>>(new Map());
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [pkgRes, settingsRes] = await Promise.all([
        fetch("/api/appointments/service-booking/packages"),
        fetch("/api/appointments/settings"),
      ]);
      if (!pkgRes.ok) throw new Error("failed");
      const pkgJson = await pkgRes.json();
      const products = (pkgJson.data || pkgJson || []) as PackageProductRow[];
      setRows(products);

      const counts = new Map<string, number>();
      await Promise.all(
        products.map(async (p) => {
          const detailRes = await fetch(`/api/appointments/service-booking/packages/${p.id}`);
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            const detail = detailJson.data || detailJson;
            counts.set(p.id, detail.activeCustomerCount || 0);
          }
        }),
      );
      setCustomerCounts(counts);

      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        setWorkspaceSlug(settingsJson.data?.workspaceSlug || settingsJson.workspaceSlug || "");
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const storeUrl = workspaceSlug && typeof window !== "undefined"
    ? `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}/store`
    : null;

  const duplicateRow = useCallback(
    async (row: PackageProductRow) => {
      await fetch("/api/appointments/service-booking/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${row.name} (copy)`,
          priceCents: row.priceCents,
          creditRules: row.creditRules,
          expirationDays: row.expirationDays,
        }),
      });
      await load();
    },
    [load],
  );

  const toggleActive = useCallback(
    async (row: PackageProductRow, active: boolean) => {
      await fetch("/api/appointments/service-booking/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, name: row.name, active, priceCents: row.priceCents }),
      });
      await load();
    },
    [load],
  );

  if (loading) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="mt-6 h-64 rounded-xl border border-[var(--border)] bg-white" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 py-12 flex items-center justify-center">
        <div className="max-w-md text-center rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-12">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 appt-pilot-text-section">Could not load packages</p>
          <button type="button" className="mt-5 appt-pilot-primary-btn" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  const activeCount = rows.filter(packageIsActive).length;

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/products-offers" className="appt-pilot-back-link">
        <ArrowLeft size={14} aria-hidden />
        Products & Offers
      </Link>

      <RefDecoPageHeader
        title="Packages"
        description="Sell a set number of services or classes together and track how many credits each customer has remaining."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {storeUrl ? (
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(storeUrl);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Copy size={14} aria-hidden /> {copied ? "Copied" : "Copy store link"}
              </button>
            ) : null}
            <Link href="/appointments/packages/new" className="appt-pilot-primary-btn">
              <Plus size={15} strokeWidth={2.5} aria-hidden />
              Create package
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <div className="appt-pilot-empty-state mt-6">
          <h2 className="appt-pilot-text-section">Sell multiple sessions together</h2>
          <p className="mx-auto mt-2 max-w-lg appt-pilot-text-body text-[var(--text-secondary)]">
            Packages let customers prepay for a set number of services or classes. Example: 10 Personal Training Sessions.
          </p>
          <Link href="/appointments/packages/new" className="appt-pilot-primary-btn mt-5">
            Create your first package
          </Link>
        </div>
      ) : (
        <div className="appt-pilot-data-table-wrap mt-6">
          <div className="appt-pilot-data-table-meta">{activeCount} active · {rows.length} total</div>
          <table className="appt-pilot-data-table">
            <thead>
              <tr>
                <th scope="col">Package</th>
                <th scope="col">Price</th>
                <th scope="col">Included</th>
                <th scope="col">Validity</th>
                <th scope="col">Customers</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const active = packageIsActive(row);
                return (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/appointments/packages/${row.id}`} className="appt-pilot-muted-link font-medium !text-[var(--text-primary)]">
                        {row.name}
                      </Link>
                    </td>
                    <td>{formatPackagePrice(row.priceCents)}</td>
                    <td>{packageCreditsSummary(row.creditRules)}</td>
                    <td>{packageValidityLabel(row.expirationDays)}</td>
                    <td>{customerCounts.get(row.id) ?? "—"}</td>
                    <td>
                      <span className={active ? "appt-pilot-status-active" : "appt-pilot-status-inactive"}>
                        {active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link href={`/appointments/packages/${row.id}`} className="appt-pilot-outline-btn !min-h-8 !px-2" aria-label={`Edit ${row.name}`}>
                          <Pencil size={14} aria-hidden />
                        </Link>
                        <div className="relative">
                          <button
                            type="button"
                            className="appt-pilot-outline-btn !min-h-8 !px-2"
                            aria-label={`More actions for ${row.name}`}
                            onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                          >
                            <MoreHorizontal size={14} aria-hidden />
                          </button>
                          {openMenuId === row.id ? (
                            <div className="absolute right-0 z-10 mt-1 min-w-[9rem] rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
                              <button type="button" className="block w-full px-3 py-2 text-left appt-pilot-text-list hover:bg-[var(--surface-muted)]" onClick={() => { setOpenMenuId(null); void duplicateRow(row); }}>
                                Duplicate
                              </button>
                              <button type="button" className="block w-full px-3 py-2 text-left appt-pilot-text-list hover:bg-[var(--surface-muted)]" onClick={() => { setOpenMenuId(null); void toggleActive(row, !active); }}>
                                {active ? "Disable" : "Enable"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
