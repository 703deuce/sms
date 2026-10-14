"use client";

import Link from "next/link";
import { Check, QrCode, Star, Wallet } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import { cn } from "@/lib/utils";

export function QrCampaignTypeSelector({ businessId }: { businessId: string }) {
  const base = `/businesses/${businessId}/reputation/qr-campaigns`;

  return (
    <ModulePage className="space-y-8">
      <div>
        <Link
          href={base}
          className="text-sm font-medium text-[#64748B] hover:text-[#0B1B32]"
        >
          ← Back to QR campaigns
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold text-[#0B1B32]">Create QR campaign</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Choose the type of QR campaign you want to create.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href={`${base}/new/review`}
          className={cn(
            qrUi.card,
            "group block p-6 transition hover:border-[#16A34A] hover:shadow-[0_12px_40px_rgba(22,163,74,0.12)]"
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#16A34A] shadow-sm">
            <Star className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-[#0B1B32]">Google Review QR</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
            Collect Google reviews with a tracked QR code and printable poster. Customers scan
            and leave a review on Google.
          </p>
          <span className="mt-4 inline-flex text-sm font-semibold text-[#16A34A] group-hover:underline">
            Select →
          </span>
        </Link>

        <Link
          href={`${base}/new/payment`}
          className={cn(
            qrUi.card,
            "group relative block border-2 border-[#2563EB] p-6 shadow-[0_12px_40px_rgba(37,99,235,0.14)] transition hover:shadow-[0_16px_48px_rgba(37,99,235,0.2)]"
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#2563EB] shadow-sm">
            <Wallet className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-[#0B1B32]">Pay &amp; Review QR</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
            One hosted page for payment links, Google and Facebook reviews, and social connections.
            Money goes directly to your accounts — we track clicks, not payments.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[#344054]">
            {["Venmo, Cash App, PayPal, Zelle, Stripe", "Google & Facebook review buttons", "Social & contact links"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-[#2563EB]" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#EFF6FF] p-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white shadow-sm">
              <QrCode className="h-7 w-7 text-[#2563EB]" />
            </div>
            <p className="text-xs font-medium text-[#1E40AF]">
              QR points to your branded Pay &amp; Review page — not directly to payment apps.
            </p>
          </div>
          <span className="mt-4 inline-flex text-sm font-semibold text-[#2563EB] group-hover:underline">
            Select →
          </span>
        </Link>
      </div>
    </ModulePage>
  );
}
