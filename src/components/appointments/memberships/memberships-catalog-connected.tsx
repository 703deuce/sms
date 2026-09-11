"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, MoreHorizontal, Plus, Search } from "lucide-react";
import {
  accessLabelFromBenefits,
  formatBillingInterval,
  formatMoney,
  type MembershipProductApiRow,
} from "@/lib/appointments/memberships/membership-form";
import type { MembershipBenefits } from "@/lib/appointments/service-booking/types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS = "appt-overview-pilot bookable-workspace-pilot ws-pilot ref-root";
const API = "/api/appointments/service-booking/memberships";

type CatalogStats = {
  activeMemberships: number;
  activeMembers: number;
  pastDue: number;
  monthlyRecurringRevenueCents: number;
  renewalsThisMonth: number;
};

export function MembershipsCatalogConnected() {
  const [rows, setRows] = useState<MembershipProductApiRow[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [intervalFilter, setIntervalFilter] = useState<"all" | "month" | "quarter" | "year">("all");
  const [sort, setSort] = useState<"newest" | "name" | "price" | "members">("name");
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
      const listJson = (await listRes.json()) as { data?: MembershipProductApiRow[] };
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
    if (intervalFilter !== "all") {
      next = next.filter((row) => row.billingInterval === intervalFilter);
    }
    next.sort((a, b) => {
      if (sort === "price") return b.priceCents - a.priceCents;
      if (sort === "members") return (b.activeMemberCount ?? 0) - (a.activeMemberCount ?? 0);
      if (sort === "newest") return String(b.id).localeCompare(String(a.id));
      return a.name.localeCompare(b.name);
    });
    return next;
  }, [rows, search, sort, statusFilter, intervalFilter]);

  async function duplicateRow(id: string) {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", productId: id }),
    });
    void load();
    setMenuId(null);
  }

  async function toggleActive(row: MembershipProductApiRow) {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: row.id,
        name: row.name,
        priceCents: row.priceCents,
        billingInterval: row.billingInterval,
        benefits: row.benefits,
        active: !row.active,
      }),
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
              <CreditCard className="h-4 w-4" />
            </span>
            <div>
              <h1 className="ws-event-title">Memberships</h1>
              <p className="ws-event-subtitle">
                Offer recurring access and benefits to customers.
              </p>
            </div>
          </div>
          <Link href="/appointments/memberships/new" className="appt-pilot-primary-btn">
            <Plus className="h-4 w-4" aria-hidden />
            New membership
          </Link>
        </header>

        {stats ? (
          <div className="ws-inline-metrics" role="group" aria-label="Membership summary">
            <div className="ws-inline-metric">
              <span className="ws-inline-metric-label">Active memberships</span>
              <span className="ws-inline-metric-value">{stats.activeMemberships}</span>
            </div>
            <div className="ws-inline-metric">
              <span className="ws-inline-metric-label">Active members</span>
              <span className="ws-inline-metric-value">{stats.activeMembers}</span>
            </div>
            <div className="ws-inline-metric">
              <span className="ws-inline-metric-label">Past due</span>
              <span className="ws-inline-metric-value">{stats.pastDue}</span>
            </div>
            {stats.monthlyRecurringRevenueCents > 0 ? (
              <div className="ws-inline-metric">
                <span className="ws-inline-metric-label">Monthly recurring revenue</span>
                <span className="ws-inline-metric-value">
                  {formatMoney(stats.monthlyRecurringRevenueCents)}
                </span>
              </div>
            ) : null}
            {stats.renewalsThisMonth > 0 ? (
              <div className="ws-inline-metric">
                <span className="ws-inline-metric-label">Renewals this month</span>
                <span className="ws-inline-metric-value">{stats.renewalsThisMonth}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="ws-list-filters">
          <label className="relative min-w-[12rem] flex-1">
            <span className="sr-only">Search memberships</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              className="input pl-9"
              placeholder="Search memberships"
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
          <select
            className="input w-auto"
            value={intervalFilter}
            onChange={(e) => setIntervalFilter(e.target.value as typeof intervalFilter)}
            aria-label="Billing interval"
          >
            <option value="all">All intervals</option>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="year">Annual</option>
          </select>
          <select
            className="input w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort memberships"
          >
            <option value="name">Name</option>
            <option value="price">Price</option>
            <option value="members">Members</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {loading ? (
          <div className="ws-panel p-8 text-[var(--text-secondary)]">Loading memberships…</div>
        ) : failed ? (
          <div className="ws-panel p-8">
            <p className="text-[var(--state-error)]">Could not load memberships.</p>
            <button type="button" className="ws-text-btn mt-2" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ws-empty-state">
            <CreditCard className="h-8 w-8 text-[var(--text-tertiary)]" aria-hidden />
            <h2 className="ws-empty-title">No memberships yet</h2>
            <p className="ws-empty-copy">
              Create recurring plans that give customers booking access and benefits.
            </p>
            <Link href="/appointments/memberships/new" className="appt-pilot-primary-btn">
              Create membership
            </Link>
          </div>
        ) : (
          <div className="ws-panel overflow-hidden">
            <table className="ws-table">
              <thead>
                <tr>
                  <th scope="col">Membership</th>
                  <th scope="col">Price</th>
                  <th scope="col">Billing</th>
                  <th scope="col">Access</th>
                  <th scope="col">Active members</th>
                  <th scope="col">Past due</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="w-16 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const benefits = (row.benefits || {}) as MembershipBenefits;
                  return (
                    <tr key={row.id} className="ws-row-item is-selectable">
                      <th scope="row">
                        <Link href={`/appointments/memberships/${row.id}`} className="flex items-center gap-2">
                          <span className="ws-icon-tile is-compact" aria-hidden>
                            <CreditCard className="h-3.5 w-3.5" />
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
                      <td>{formatMoney(row.priceCents)}</td>
                      <td>{formatBillingInterval(row.billingInterval)}</td>
                      <td>{accessLabelFromBenefits(benefits)}</td>
                      <td>{row.activeMemberCount ?? 0}</td>
                      <td>{row.pastDueCount ?? 0}</td>
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
                              <Link href={`/appointments/memberships/${row.id}`} className="ws-menu-item">
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
