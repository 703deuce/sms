"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import {
  formatMembershipPrice,
  membershipBenefitsSummary,
  membershipBillingLabel,
  membershipIsActive,
  type MembershipProductRow,
} from "@/lib/appointments/memberships/membership-display";
import "@/components/appointments/kimi-ui/overview/reference.css";

export function MembershipsListConnected() {
  const [rows, setRows] = useState<MembershipProductRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/appointments/service-booking/memberships");
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      const products = (json.data || json || []) as MembershipProductRow[];
      setRows(products);
      const counts = new Map<string, number>();
      await Promise.all(
        products.map(async (p) => {
          const dRes = await fetch(`/api/appointments/service-booking/memberships/${p.id}`);
          if (dRes.ok) {
            const dJson = await dRes.json();
            const detail = dJson.data || dJson;
            counts.set(p.id, detail.activeMemberCount || 0);
          }
        }),
      );
      setMemberCounts(counts);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5 animate-pulse"><div className="h-8 w-48 rounded bg-gray-200" /></div>;
  }

  if (failed) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 py-12 flex items-center justify-center">
        <p className="appt-pilot-text-section">Could not load memberships</p>
      </div>
    );
  }

  const activeCount = rows.filter(membershipIsActive).length;

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/products-offers" className="appt-pilot-back-link"><ArrowLeft size={14} aria-hidden /> Products & Offers</Link>
      <RefDecoPageHeader
        title="Memberships"
        description="Create recurring memberships with included credits, discounts, or member-only access."
        action={<Link href="/appointments/memberships/new" className="appt-pilot-primary-btn"><Plus size={15} aria-hidden /> Create membership</Link>}
      />
      {rows.length === 0 ? (
        <div className="appt-pilot-empty-state mt-6">
          <h2 className="appt-pilot-text-section">Create recurring memberships</h2>
          <p className="mx-auto mt-2 max-w-lg appt-pilot-text-body text-[var(--text-secondary)]">
            Charge customers regularly and include credits, discounts, or access to member-only services and classes.
          </p>
          <Link href="/appointments/memberships/new" className="appt-pilot-primary-btn mt-5">Create your first membership</Link>
        </div>
      ) : (
        <div className="appt-pilot-data-table-wrap mt-6">
          <div className="appt-pilot-data-table-meta">{activeCount} active · {rows.length} total</div>
          <table className="appt-pilot-data-table">
            <thead>
              <tr>
                <th scope="col">Membership</th>
                <th scope="col">Price</th>
                <th scope="col">Billing</th>
                <th scope="col">Benefits</th>
                <th scope="col">Members</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const active = membershipIsActive(row);
                return (
                  <tr key={row.id}>
                    <td><Link href={`/appointments/memberships/${row.id}`} className="appt-pilot-muted-link font-medium !text-[var(--text-primary)]">{row.name}</Link></td>
                    <td>{formatMembershipPrice(row.priceCents, row.billingInterval)}</td>
                    <td>{membershipBillingLabel(row.billingInterval)}</td>
                    <td>{membershipBenefitsSummary(row.benefits)}</td>
                    <td>{memberCounts.get(row.id) ?? "—"}</td>
                    <td><span className={active ? "appt-pilot-status-active" : "appt-pilot-status-inactive"}>{active ? "Active" : "Inactive"}</span></td>
                    <td className="text-right">
                      <Link href={`/appointments/memberships/${row.id}`} className="appt-pilot-outline-btn !min-h-8 !px-2"><Pencil size={14} aria-hidden /></Link>
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
