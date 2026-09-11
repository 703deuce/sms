"use client";

import type { OfferingAssignment, OfferingKind } from "@/lib/appointments/forms-documents/forms-workspace";
import { Briefcase, Calendar, Users, Video } from "lucide-react";

type Props = {
  assignments: OfferingAssignment[];
  formNames: Map<string, string>;
  onManageForm: (formId: string) => void;
};

const GROUP_ORDER: OfferingKind[] = ["service", "class", "workshop", "meeting"];

function groupIcon(kind: OfferingKind) {
  if (kind === "meeting") return Video;
  if (kind === "class" || kind === "workshop") return Users;
  return Briefcase;
}

export function FormsAssignmentsSection({ assignments, formNames, onManageForm }: Props) {
  const withForms = assignments.filter((a) => a.formIds.length > 0);
  const empty = assignments.filter((a) => a.formIds.length === 0);

  return (
    <div className="space-y-4">
      {GROUP_ORDER.map((kind) => {
        const rows = withForms.filter((r) => r.offeringKind === kind);
        if (!rows.length) return null;
        const Icon = groupIcon(kind);
        const title =
          kind === "service"
            ? "Services"
            : kind === "class"
              ? "Classes"
              : kind === "workshop"
                ? "Workshops"
                : "Meetings";
        return (
          <div key={kind} className="ws-panel">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <Icon className="h-4 w-4 text-[var(--accent)]" aria-hidden />
              <h2 className="text-sm font-semibold">{title}</h2>
            </div>
            <table className="ws-table w-full">
              <thead>
                <tr>
                  <th>Offering</th>
                  <th>Forms &amp; documents</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.offeringId}>
                    <td>
                      <div className="font-medium">{row.offeringName}</div>
                      {row.durationLabel ? (
                        <div className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                          {row.durationLabel}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <ul className="flex flex-wrap gap-1.5">
                        {row.formIds.map((fid) => (
                          <li key={fid}>
                            <button type="button" className="ws-chip ws-chip-neutral" onClick={() => onManageForm(fid)}>
                              {formNames.get(fid) || "Form"} · During booking
                            </button>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {withForms.length === 0 ? (
        <div className="ws-panel px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
          No forms assigned to offerings yet. Attach forms from a Service, Class, or Workshop customer setup, or
          from the library.
        </div>
      ) : null}

      {empty.length > 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">
          {empty.length} offering{empty.length === 1 ? "" : "s"} without intake forms.{" "}
          <Calendar className="inline h-3 w-3" aria-hidden />
        </p>
      ) : null}
    </div>
  );
}
