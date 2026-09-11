"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layers, MoreHorizontal, Package, Plus, Search } from "lucide-react";
import {
  eligibilitySummary,
  formatMoney,
  type PackageProductApiRow,
} from "@/lib/appointments/packages/package-form";
import type { PackageCreditRule } from "@/lib/appointments/service-booking/types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS = "appt-overview-pilot bookable-workspace-pilot ws-pilot ref-root";
const API = "/api/appointments/service-booking/packages";

type CatalogStats = {
  activePackages: number;
  customerPackages: number;
  availableCredits: number;
  redeemedThisMonth: number;
  packageRevenueCents: number;
};

function eligibleLabel(rules: PackageCreditRule[]): string {
  const summary = eligibilitySummary(rules);
  const parts: string[] = [];
  if (summary.services) parts.push(`${summary.services} Service${summary.services === 1 ? "" : "s"}`);
  if (summary.meetings) parts.push(`${summary.meetings} Meeting${summary.meetings === 1 ? "" : "s"}`);
  if (summary.classes) parts.push(`${summary.classes} Class${summary.classes === 1 ? "" : "es"}`);
  if (summary.workshops) parts.push(`${summary.workshops} Workshop${summary.workshops === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" · ") : "None yet";
}

export function PackagesCatalogConnected() {
  const [rows, setRows] = useState<PackageProductApiRow[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<"newest" | "name" | "price">("name");
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch(API),
        fetch(`${API}?view=stats`),
      ]);
      if (!listRes.ok) throw new Error("failed");
      const listJson = (await listRes.json()) as { data?: PackageProductApiRow[] };
      const statsJson = statsRes.ok
        ? ((await statsRes.json()) as { data?: CatalogStats })
        : { data: null };
      setRows(listJson.data || []);
      setStats(statsJson.data || null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let next = [...rows];
    const q = search.trim().toLowerCase();
    if (q) {
      next = next.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          (row.description || "").toLowerCase().includes(q),
      );
    }
    if (statusFilter === "active") next = next.filter((row) => row.active);
    if (statusFilter === "inactive") next = next.filter((row) => !row.active);
    next.sort((a, b) => {
      if (sort === "price") return b.priceCents - a.priceCents;
      if (sort === "newest") return String(b.id).localeCompare(String(a.id));
      return a.name.localeCompare(b.name);
    });
    return next;
  }, [rows, search, sort, statusFilter]);

  async function duplicateRow(id: string) {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", productId: id }),
    });
    void load();
    setMenuId(null);
  }

  async function toggleActive(row: PackageProductApiRow) {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, name: row.name, active: !row.active }),
    });
    void load();
    setMenuId(null);
  }

  return (
    <div className={`${SHELL_CLASS} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-4 px-4 py-5 lg:px-6">
        <header className="ws-event-head">
          <div className="ws-event-head-main">
            <span className="ws-icon-tile" aria-hidden>
              <Package className="h-4 w-4" />
            </span>
            <div>
              <h1 className="ws-event-title">Packages</h1>
              <p className="ws-event-subtitle">
                Sell prepaid bundles of bookings and manage customer credits.
              </p>
            </div>
          </div>
          <Link href="/appointments/packages/new" className="appt-pilot-primary-btn">
            <Plus className="h-4 w-4" aria-hidden />
            New package
          </Link>
        </header>

        {stats ? (
          <div className="ws-inline-metrics" role="group" aria-label="Package summary">
            <div className="ws-inline-metric">
              <span className="ws-inline-metric-label">Active packages</span>
              <span className="ws-inline-metric-value">{stats.activePackages}</span>
            </div>
            <div className="ws-inline-metric">
              <span className="ws-inline-metric-label">Customer packages</span>
              <span className="ws-inline-metric-value">{stats.customerPackages}</span>
            </div>
            <div className="ws-inline-metric">
              <span className="ws-inline-metric-label">Available credits</span>
              <span className="ws-inline-metric-value">{stats.availableCredits}</span>
            </div>
            <div className="ws-inline-metric">
              <span className="ws-inline-metric-label">Redeemed this month</span>
              <span className="ws-inline-metric-value">{stats.redeemedThisMonth}</span>
            </div>
            {stats.packageRevenueCents > 0 ? (
              <div className="ws-inline-metric">
                <span className="ws-inline-metric-label">Package revenue</span>
                <span className="ws-inline-metric-value">{formatMoney(stats.packageRevenueCents)}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="ws-list-filters">
          <label className="relative min-w-[12rem] flex-1">
            <span className="sr-only">Search packages</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              className="input pl-9"
              placeholder="Search packages"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="ws-list-filters" role="group" aria-label="Status">
            {(["all", "active", "inactive"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className="ws-list-filter"
                aria-selected={statusFilter === value}
                onClick={() => setStatusFilter(value)}
              >
                {value === "all" ? "All" : value === "active" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="pkg-sort">Sort packages</label>
          <select
            id="pkg-sort"
            className="input w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="name">Name</option>
            <option value="price">Price</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {loading ? (
          <div className="ws-panel p-8 text-[var(--text-secondary)]">Loading packages…</div>
        ) : failed ? (
          <div className="ws-panel p-8">
            <p className="text-[var(--state-error)]">Could not load packages.</p>
            <button type="button" className="ws-text-btn mt-2" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ws-empty-state">
            <Package className="h-8 w-8 text-[var(--text-tertiary)]" aria-hidden />
            <h2 className="ws-empty-title">No packages yet</h2>
            <p className="ws-empty-copy">
              Sell prepaid bundles customers can redeem for eligible bookings.
            </p>
            <Link href="/appointments/packages/new" className="appt-pilot-primary-btn">
              Create package
            </Link>
          </div>
        ) : (
          <div className="ws-panel overflow-hidden">
            <table className="ws-table">
              <thead>
                <tr>
                  <th scope="col">Package</th>
                  <th scope="col">Credits / uses</th>
                  <th scope="col">Price</th>
                  <th scope="col">Eligible bookings</th>
                  <th scope="col">Customers</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="w-16 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const rules = (row.creditRules || []) as PackageCreditRule[];
                  const credits = rules
                    .filter((r) => r.quantity > 0)
                    .reduce((sum, r) => sum + r.quantity, 0);
                  return (
                    <tr key={row.id} className="ws-row-item is-selectable">
                      <th scope="row">
                        <Link href={`/appointments/packages/${row.id}`} className="flex items-center gap-2">
                          <span className="ws-icon-tile is-compact" aria-hidden>
                            <Layers className="h-3.5 w-3.5" />
                          </span>
                          <span>
                            <span className="block font-medium text-[var(--text-primary)]">{row.name}</span>
                            {row.description ? (
                              <span className="block text-[var(--type-helper)] text-[var(--text-secondary)]">
                                {row.description}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </th>
                      <td>{credits || "—"} uses</td>
                      <td>{formatMoney(row.priceCents)}</td>
                      <td>{eligibleLabel(rules)}</td>
                      <td>{row.ownerCount ?? 0} active</td>
                      <td>
                        <span className={row.active ? "ws-badge is-success" : "ws-badge"}>
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="relative inline-block">
                          <button
                            type="button"
                            className="ws-icon-btn"
                            aria-label={`Actions for ${row.name}`}
                            onClick={() => setMenuId(menuId === row.id ? null : row.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {menuId === row.id ? (
                            <div className="ws-menu-popover right-0">
                              <Link href={`/appointments/packages/${row.id}`} className="ws-menu-item">
                                Edit
                              </Link>
                              <button
                                type="button"
                                className="ws-menu-item"
                                onClick={() => void duplicateRow(row.id)}
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                className="ws-menu-item"
                                onClick={() => void toggleActive(row)}
                              >
                                {row.active ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          ) : null}
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
    </div>
  );
}
