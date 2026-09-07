import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { MctbPageHeader } from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import "./kimi-ui/reference.css";

type NumberRow = {
  id: string;
  e164: string;
  friendlyName: string | null;
  type: string | null;
  status: string | null;
  sourceLabel?: string | null;
  messagingStatus?: { label: string } | null;
  a2pStatus?: string | null;
};

function fmtPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

export function MctbNumbersView({ numbers }: { numbers: NumberRow[] }) {
  return (
    <div className="mctb-page">
      <div className="mctb-page-inner max-w-4xl">
        <MctbPageHeader
          title="Numbers"
          description="Business lines and text-back senders used for missed-call recovery."
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/numbers/buy"
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(79,70,229,0.25)] hover:bg-primary/90"
              >
                Add number
              </Link>
              <Link
                href={MCTB_ROUTES.numbers}
                className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-4 text-[13px] font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Refresh list
              </Link>
            </div>
          }
        />

        <div className="ref-deco-table-wrap mt-6">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Number</th>
                <th scope="col" className="px-4 py-3 font-medium">Label</th>
                <th scope="col" className="px-4 py-3 font-medium">Type</th>
                <th scope="col" className="px-4 py-3 font-medium">Messaging status</th>
                <th scope="col" className="px-4 py-3 font-medium">Line status</th>
              </tr>
            </thead>
            <tbody>
              {numbers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No numbers yet.{" "}
                    <Link href="/numbers/buy" className="font-semibold text-primary hover:underline">
                      Add your first business number
                    </Link>{" "}
                    to start missed-call recovery.
                  </td>
                </tr>
              ) : (
                numbers.map((n) => (
                  <tr key={n.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{fmtPhone(n.e164)}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p>{n.friendlyName || "—"}</p>
                        {n.sourceLabel ? (
                          <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                            {n.sourceLabel}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">{n.type || "Local"}</td>
                    <td className="px-4 py-3">
                      <Link href="/compliance" className="font-medium text-primary hover:underline">
                        {n.messagingStatus?.label || n.a2pStatus || "Not started"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{n.status || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[13px] text-muted-foreground">
          Choose which number sends recovery texts in{" "}
          <Link href={MCTB_ROUTES.setupPhone} className="font-semibold text-primary hover:underline">
            Phone & Forwarding
          </Link>
          . Complete{" "}
          <Link href="/compliance" className="font-semibold text-primary hover:underline">
            Messaging Compliance
          </Link>{" "}
          before going live.
        </p>
      </div>
    </div>
  );
}
