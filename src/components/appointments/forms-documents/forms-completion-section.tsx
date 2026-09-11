"use client";

import Link from "next/link";

type PendingContract = {
  id: string;
  templateId: string;
  appointmentId?: string | null;
  status: string;
  signerName?: string | null;
};

type Props = {
  signedContracts: PendingContract[];
  templateNames: Map<string, string>;
};

export function FormsCompletionSection({ signedContracts, templateNames }: Props) {
  const pending = signedContracts.filter((c) => c.status === "unsigned");

  return (
    <div className="ws-panel overflow-x-auto">
      {pending.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
          Everything required is complete.
        </p>
      ) : (
        <table className="ws-table w-full min-w-[720px]">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Booking</th>
              <th>Required item</th>
              <th>Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((row) => (
              <tr key={row.id}>
                <td>{row.signerName || "Customer"}</td>
                <td>
                  {row.appointmentId ? (
                    <Link href={`/appointments/${row.appointmentId}`} className="ws-text-btn">
                      View appointment
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{templateNames.get(row.templateId) || "Contract"}</td>
                <td className="text-[var(--text-secondary)]">Before appointment</td>
                <td><span className="ws-chip ws-chip-warning">Pending signature</span></td>
                <td>
                  <Link href="/appointments/reminders" className="ws-text-btn">
                    Manage reminders
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
