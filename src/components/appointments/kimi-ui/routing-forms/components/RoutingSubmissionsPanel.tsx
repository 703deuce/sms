"use client";

type Submission = {
  id: string;
  submittedAt: string;
  visitorName?: string;
  visitorEmail?: string;
  answers: Record<string, string>;
  destinationLabel?: string;
  outcome: string;
};

export default function RoutingSubmissionsPanel({ submissions }: { submissions: Submission[] }) {
  if (!submissions.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
        <p className="text-[13px] font-medium text-foreground">No submissions yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Responses appear here when customers complete your public routing form.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-[12.5px]">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            <th className="px-3 py-2 font-semibold" scope="col">Date</th>
            <th className="px-3 py-2 font-semibold" scope="col">Visitor</th>
            <th className="px-3 py-2 font-semibold" scope="col">Destination</th>
            <th className="px-3 py-2 font-semibold" scope="col">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((row) => (
            <tr key={row.id} className="border-b border-border/60">
              <td className="px-3 py-2 whitespace-nowrap">
                {new Date(row.submittedAt).toLocaleString()}
              </td>
              <td className="px-3 py-2">
                {row.visitorName || row.visitorEmail || "Anonymous visitor"}
              </td>
              <td className="px-3 py-2">{row.destinationLabel || "—"}</td>
              <td className="px-3 py-2 capitalize">{row.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
