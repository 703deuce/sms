import Link from "next/link";
import { mctbShellHome } from "@/lib/products/product-shell";
import { ArrowRight, PhoneMissed } from "lucide-react";

type Props = {
  variant: "mctb_on_mass_sms" | "mass_sms_on_mctb";
  detail?: string;
};

export function CrossProductBanner({ variant, detail }: Props) {
  if (variant === "mctb_on_mass_sms") {
    return (
      <div className="rounded-[14px] border border-sky-200 bg-sky-50/80 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
              <PhoneMissed className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-sky-950">Missed Call Engine is active</p>
              <p className="mt-0.5 text-[13px] text-sky-900/85">
                {detail ||
                  "Review missed calls, consent logs, and press-1 text-back setup in your voice workspace."}
              </p>
            </div>
          </div>
          <Link
            href={mctbShellHome()}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-sky-700 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-sky-800 sm:self-center"
          >
            View Missed Call Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-violet-200 bg-violet-50/80 px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[14px] font-semibold text-violet-950">Mass SMS Platform</p>
          <p className="mt-0.5 text-[13px] text-violet-900/85">
            {detail || "Launch broadcast campaigns, manage contacts, and track delivery from Mass SMS."}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-violet-700 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-violet-800 sm:self-center"
        >
          Open Mass SMS Dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
