"use client";

import Link from "next/link";
import { summarizeWeeklyHours } from "@/lib/appointments/availability/availability-workspace";
import type { AvailabilityFormState } from "@/features/appointments/kimi/availability/types";

type LocationRow = {
  id: string;
  name: string;
  weeklyHours?: Record<string, Array<{ open: string; close: string }>>;
  staffIds?: string[];
  appointmentTypeIds?: string[];
};

type ResourceRow = {
  id: string;
  name: string;
  quantity: number;
  eligibleTypeIds?: string[];
};

type Props = {
  form: AvailabilityFormState;
  locations: LocationRow[];
  resources: ResourceRow[];
  staffCountByLocation: Map<string, number>;
  serviceCountByLocation: Map<string, number>;
};

export function AvailabilityLocationsSection({
  form,
  locations,
  resources,
  staffCountByLocation,
  serviceCountByLocation,
}: Props) {
  const businessSummary = summarizeWeeklyHours(form.weeklyHours);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="ws-panel">
        <div className="ws-panel-head">
          <h2 className="ws-panel-title">Locations</h2>
        </div>
        {locations.length === 0 ? (
          <div className="px-4 py-6">
            <p className="ws-stat-note">No locations configured.</p>
            <Link href="/appointments/locations" className="ws-text-btn mt-2 inline-flex">Manage locations</Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {locations.map((location) => {
              const hours = location.weeklyHours && Object.keys(location.weeklyHours).length
                ? summarizeWeeklyHours(location.weeklyHours)
                : businessSummary;
              return (
                <li key={location.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{location.name}</p>
                    <p className="ws-stat-note">{hours}</p>
                    <p className="ws-stat-note">
                      {staffCountByLocation.get(location.id) ?? 0} staff · {serviceCountByLocation.get(location.id) ?? 0} services
                    </p>
                  </div>
                  <span className="ws-badge is-success">Ready</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="ws-panel">
        <div className="ws-panel-head">
          <h2 className="ws-panel-title">Rooms & equipment</h2>
        </div>
        {resources.length === 0 ? (
          <div className="px-4 py-6">
            <p className="ws-stat-note">No room or equipment constraints are configured.</p>
            <Link href="/appointments/resources" className="ws-text-btn mt-2 inline-flex">Manage resources</Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {resources.map((resource) => (
              <li key={resource.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{resource.name}</p>
                  <p className="ws-stat-note">
                    Quantity {resource.quantity} · Used by {(resource.eligibleTypeIds || []).length} service(s)
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-[var(--border)] px-4 py-3">
          <Link href="/appointments/resources" className="ws-text-btn">Manage resources</Link>
        </div>
      </div>
    </div>
  );
}
