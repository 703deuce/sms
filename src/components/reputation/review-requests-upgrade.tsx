import Link from "next/link";
import { CheckCircle2, MessageSquareText, ShieldCheck, Upload } from "lucide-react";

const BENEFITS = [
  "Send automated SMS and email review requests for your clients",
  "Pace sends safely with quiet hours, daily limits, and opt-out handling",
  "Track delivery, clicks, and replies without claiming unverifiable attribution",
  "Import contacts, use templates, and enroll via webhooks",
];

/**
 * Visible upgrade preview — Review Requests stays in the nav with an Add-on badge.
 * Do not hide the tool; show the workflow and an upgrade path.
 */
export function ReviewRequestsUpgrade({ businessId }: { businessId: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Review Requests — Upgrade
          </p>
          <h1 className="mt-1 text-[18px] font-semibold text-zinc-900">
            Automated review requests for clients
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
            Send SMS and email review requests as part of your monthly client workflow.
            Available with the Reputation add-on.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 p-4">
        <p className="text-[12px] font-semibold text-zinc-800">Workflow preview</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] text-zinc-600">
          <li>Import or add contacts for the client</li>
          <li>Choose a template (SMS / email)</li>
          <li>Quick Send or enroll a campaign</li>
          <li>Track delivery and replies</li>
          <li>Include review momentum in the monthly report</li>
        </ol>
      </div>

      <ul className="mt-5 space-y-2">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-[13px] text-zinc-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
          <Upload className="h-3.5 w-3.5 text-zinc-500" />
          <p className="mt-1 text-[12px] font-medium text-zinc-800">CSV import</p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
          <MessageSquareText className="h-3.5 w-3.5 text-zinc-500" />
          <p className="mt-1 text-[12px] font-medium text-zinc-800">SMS + email</p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" />
          <p className="mt-1 text-[12px] font-medium text-zinc-800">STOP / opt-out</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href={`/businesses/${businessId}/settings`}
          className="inline-flex items-center rounded-full bg-[#137752] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#0f6344]"
        >
          Upgrade / enable add-on
        </Link>
        <Link
          href={`/businesses/${businessId}/review-momentum`}
          className="inline-flex items-center rounded-md border border-zinc-200 px-3.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Open Review Momentum
        </Link>
        <Link
          href={`/businesses/${businessId}/reviews`}
          className="inline-flex items-center rounded-md border border-zinc-200 px-3.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Review Feed
        </Link>
      </div>
    </div>
  );
}
