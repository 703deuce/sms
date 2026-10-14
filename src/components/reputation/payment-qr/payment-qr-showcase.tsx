"use client";

import {
  BarChart3,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  Gift,
  Heart,
  Plus,
  QrCode,
  Star,
  Wallet,
} from "lucide-react";
import { PaymentPublicPage } from "@/components/reputation/payment-qr/payment-public-page";
import { PaymentProviderIcon } from "@/components/reputation/payment-qr/payment-provider-icons";
import { QrCampaignTypeSelector } from "@/components/reputation/payment-qr/qr-campaign-type-selector";
import {
  QrKpiCard,
  QrStatusBadge,
  qrUi,
} from "@/components/reputation/qr-campaigns/qr-ui";
import {
  PAYMENT_PURPOSE_LABELS,
  PAYMENT_PURPOSES,
  PAYMENT_PROVIDERS,
} from "@/lib/reputation/payment-qr/types";
import { getPaymentProvider } from "@/lib/reputation/payment-qr/providers";
import { cn } from "@/lib/utils";

import { MOCK_CAMPAIGN, MOCK_CONFIG } from "@/lib/reputation/payment-qr/showcase-mock";

export { MOCK_CAMPAIGN, MOCK_CONFIG, MOCK_REQUEST_SESSION } from "@/lib/reputation/payment-qr/showcase-mock";

const PURPOSE_ICONS: Record<string, { icon: typeof Wallet; color: string; bg: string }> = {
  pay: { icon: Wallet, color: "#16A34A", bg: "#ECFDF3" },
  tip: { icon: DollarSign, color: "#D97706", bg: "#FFFAEB" },
  donate: { icon: Heart, color: "#DC2626", bg: "#FEF2F2" },
  pay_invoice: { icon: CreditCard, color: "#2563EB", bg: "#EFF6FF" },
  leave_deposit: { icon: QrCode, color: "#7C3AED", bg: "#F5F3FF" },
  support_us: { icon: Heart, color: "#0F172A", bg: "#F1F5F9" },
  custom: { icon: Gift, color: "#0F172A", bg: "#F1F5F9" },
};

function ShowcaseSection({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-[#0B1B32]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[#64748B]">{description}</p> : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#E6EAF0] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        {children}
      </div>
    </section>
  );
}

function WizardStepMock({
  step,
  active,
  label,
}: {
  step: number;
  active?: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-sm",
        active
          ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] shadow-[0_4px_12px_rgba(37,99,235,0.15)]"
          : "border-[#D0D5DD] bg-white text-[#344054]"
      )}
    >
      <span
        className={cn(
          "mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
          active ? "bg-[#2563EB] text-white" : "bg-[#F2F4F7] text-[#667085]"
        )}
      >
        {step}
      </span>
      {label}
    </span>
  );
}

function ToggleMock({ on = true }: { on?: boolean }) {
  return (
    <div
      className={cn(
        "relative h-7 w-12 rounded-full transition",
        on ? "bg-[#2563EB]" : "bg-[#E4E7EC]"
      )}
    >
      <div
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition",
          on ? "right-0.5" : "left-0.5"
        )}
      />
    </div>
  );
}

function SidebarMock() {
  return (
    <aside className="hidden w-56 shrink-0 rounded-2xl bg-[#0B1B32] p-4 text-white lg:block">
      <p className="text-xs font-bold uppercase tracking-wider text-white/50">Local SEO Express</p>
      <nav className="mt-6 space-y-1 text-sm">
        {["Overview", "QR Campaigns", "Reviews", "Analytics"].map((item, i) => (
          <div
            key={item}
            className={cn(
              "rounded-lg px-3 py-2 font-semibold",
              i === 1 ? "bg-white/10 text-white" : "text-white/60"
            )}
          >
            {item}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function DonutChartMock() {
  const segments = [
    { pct: 42, color: "#00D632", label: "Cash App" },
    { pct: 31, color: "#6D1ED4", label: "Zelle" },
    { pct: 22, color: "#3D95CE", label: "Venmo" },
    { pct: 11, color: "#003087", label: "PayPal" },
  ];
  let offset = 0;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0">
        {segments.map((s) => {
          const dash = (s.pct / 100) * 283;
          const el = (
            <circle
              key={s.label}
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={`${dash} 283`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += dash;
          return el;
        })}
        <circle cx="60" cy="60" r="32" fill="white" />
      </svg>
      <ul className="space-y-2 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-[#667085]">{s.label}</span>
            <strong className="ml-auto text-[#0B1B32]">{s.pct}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PaymentQrShowcase() {
  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <div className="border-b border-[#E2E8F0] bg-white px-6 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
          Payment, Tip &amp; Review QR — UI showcase
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#0B1B32]">
          All screens (dev preview)
        </h1>
      </div>

      <div className="mx-auto max-w-6xl space-y-10 p-6">
        <ShowcaseSection
          id="campaign-list"
          title="1. QR Campaign dashboard"
          description="List view with payment campaign badge and scan totals."
        >
          <div className="flex gap-6 p-6">
            <SidebarMock />
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className={qrUi.title}>QR Campaigns</h3>
                  <p className={qrUi.subtitle}>
                    Google review QR and Pay &amp; Review QR campaigns.
                  </p>
                </div>
                <button type="button" className={cn(qrUi.btnPrimary, "bg-[#2563EB] shadow-[0_8px_20px_rgba(37,99,235,0.28)] hover:bg-[#1D4ED8]")}>
                  <Plus className="h-4 w-4" /> Create New Campaign
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <QrKpiCard label="Total Campaigns" value="3" trend="+1" />
                <QrKpiCard label="Total Scans" value="204" trend="+12%" />
                <QrKpiCard label="Est. Unique" value="156" />
                <QrKpiCard label="Active Campaigns" value="2" />
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-xs uppercase text-[#98A2B3]">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Scans</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#E6EAF0] hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0B1B32]">The Local Shop — Counter</p>
                      <p className="text-xs text-[#667085]">lse.app/p/thelocalshop</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-xs font-bold text-[#1D4ED8] ring-1 ring-[#BFDBFE]">
                        Pay &amp; Review
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">148</td>
                    <td className="px-4 py-3"><QrStatusBadge status="active" /></td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="text-sm font-semibold text-[#2563EB]">View</button>
                    </td>
                  </tr>
                  <tr className="border-b border-[#E6EAF0] hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3 font-semibold">Front desk review poster</td>
                    <td className="px-4 py-3 text-[#64748B]">Review QR</td>
                    <td className="px-4 py-3 font-semibold">56</td>
                    <td className="px-4 py-3"><QrStatusBadge status="active" /></td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="text-sm font-semibold text-[#2563EB]">View</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="type-selector"
          title="2. Create campaign — choose type"
          description="Google Review QR or Pay &amp; Review QR."
        >
          <div className="p-6">
            <QrCampaignTypeSelector businessId="preview-business" />
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="wizard-basic"
          title="3. Wizard — page purpose"
          description="Choose what customers can do on your hosted page."
        >
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap gap-2">
              <WizardStepMock step={1} active label="Business details" />
              <WizardStepMock step={2} label="Payment options" />
              <WizardStepMock step={3} label="Amount settings" />
              <WizardStepMock step={4} label="Reviews & links" />
              <WizardStepMock step={5} label="Preview & publish" />
            </div>
            <h3 className="text-lg font-bold text-[#0B1B32]">What&apos;s the page for?</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PAYMENT_PURPOSES.slice(0, 6).map((p) => {
                const meta = PURPOSE_ICONS[p] ?? PURPOSE_ICONS.pay;
                const Icon = meta.icon;
                const selected = p === "pay";
                return (
                  <div
                    key={p}
                    className={cn(
                      "rounded-2xl border-2 p-4 shadow-sm transition",
                      selected
                        ? "border-[#2563EB] bg-[#EFF6FF] shadow-[0_8px_24px_rgba(37,99,235,0.12)]"
                        : "border-[#E6EAF0] bg-white"
                    )}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-[#0B1B32]">
                      {PAYMENT_PURPOSE_LABELS[p]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="wizard-methods"
          title="4. Wizard — Payment methods"
          description="Toggle providers and paste handles or payment links."
        >
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <WizardStepMock step={1} label="Business details" />
              <WizardStepMock step={2} active label="Payment options" />
              <WizardStepMock step={3} label="Amount settings" />
              <WizardStepMock step={4} label="Reviews & links" />
              <WizardStepMock step={5} label="Preview & publish" />
            </div>
            {PAYMENT_PROVIDERS.map((provider) => {
              const def = getPaymentProvider(provider);
              const enabled = provider !== "paypal";
              return (
                <div
                  key={provider}
                  className="rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <PaymentProviderIcon provider={provider} className="h-11 w-11" />
                      <div>
                        <p className="font-bold text-[#0B1B32]">{def.displayName}</p>
                        <p className="text-xs text-[#667085]">{def.buttonLabel}</p>
                      </div>
                    </div>
                    <ToggleMock on={enabled} />
                  </div>
                  {enabled ? (
                    <input
                      readOnly
                      value={
                        provider === "stripe"
                          ? "https://buy.stripe.com/preview"
                          : provider === "cash_app"
                            ? "$thelocalshop"
                            : provider === "zelle"
                              ? "pay@thelocalshop.com"
                              : "thelocalshop"
                      }
                      className={cn(qrUi.input, "mt-3")}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="wizard-preview"
          title="5. Wizard — Preview & publish"
          description="Mobile preview and page summary before going live."
        >
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
            <div className="flex justify-center">
              <div className="overflow-visible rounded-[2.5rem] p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)] ring-1 ring-[#CBD5E1]">
                <div className="h-[640px] w-[300px] overflow-y-auto overflow-x-visible rounded-[2rem] bg-white">
                  <PaymentPublicPage
                    slug="thelocalshop"
                    campaign={MOCK_CAMPAIGN}
                    config={MOCK_CONFIG}
                    businessName="The Local Shop"
                    isPreview
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <WizardStepMock step={5} active label="Preview & publish" />
              </div>
              <div className={cn(qrUi.cardPad, "space-y-3")}>
                <h4 className="text-sm font-bold text-[#0B1B32]">Page details</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#667085]">Slug</dt>
                    <dd className="font-semibold text-[#0B1B32]">thelocalshop</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#667085]">Theme</dt>
                    <dd className="font-semibold text-[#0B1B32]">Clean &amp; Modern</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#667085]">Amount mode</dt>
                    <dd className="font-semibold text-[#0B1B32]">Suggested tips</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#667085]">Methods</dt>
                    <dd className="font-semibold text-[#0B1B32]">5 enabled</dd>
                  </div>
                </dl>
              </div>
              <button type="button" className={cn(qrUi.btnPrimary, "w-full bg-[#2563EB] shadow-[0_8px_20px_rgba(37,99,235,0.28)]")}>
                Publish campaign
              </button>
            </div>
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="campaign-editor"
          title="6. Campaign editor — QR & poster"
          description="Download QR code and scan-to-pay poster."
        >
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-extrabold text-[#0B1B32]">The Local Shop — Counter</h3>
                <QrStatusBadge status="active" />
                <span className="rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-xs font-bold text-[#1D4ED8] ring-1 ring-[#BFDBFE]">
                  Pay &amp; Review
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <QrKpiCard label="QR scans" value="148" trend="+8%" />
                <QrKpiCard label="Est. unique" value="112" />
                <QrKpiCard label="Short code" value="abc123" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={cn(qrUi.btnSecondary, "inline-flex gap-2")}>
                  <BarChart3 className="h-4 w-4" /> Analytics
                </button>
                <button type="button" className={cn(qrUi.btnSecondary, "inline-flex gap-2")}>
                  <Copy className="h-4 w-4" /> Copy link
                </button>
                <button type="button" className={cn(qrUi.btnPrimary, "inline-flex gap-2 bg-[#2563EB]")}>
                  <ExternalLink className="h-4 w-4" /> Open public page
                </button>
              </div>
              <div className={cn(qrUi.cardPad, "flex items-center gap-4")}>
                <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-[#E6EAF0] bg-white shadow-inner">
                  <QrCode className="h-16 w-16 text-[#0B1B32]" />
                </div>
                <div>
                  <p className="font-bold text-[#0B1B32]">QR code</p>
                  <p className="mt-1 text-sm text-[#667085]">Points to your hosted Pay &amp; Review page.</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className={qrUi.btnSecondary}>PNG</button>
                    <button type="button" className={qrUi.btnSecondary}>SVG</button>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="flex flex-col items-center justify-center rounded-2xl p-8 text-center text-white shadow-[0_20px_50px_rgba(15,23,42,0.25)]"
              style={{ background: "linear-gradient(160deg, #1e3a5f 0%, #0B1B32 100%)" }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Scan to</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight">TIP &amp; PAY</p>
              <p className="mt-1 text-sm text-white/75">The Local Shop</p>
              <div className="mt-6 flex h-36 w-36 items-center justify-center rounded-xl bg-white p-3 shadow-lg">
                <QrCode className="h-full w-full text-[#0B1B32]" />
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {PAYMENT_PROVIDERS.slice(1, 5).map((p) => (
                  <PaymentProviderIcon key={p} provider={p} className="h-8 w-8" />
                ))}
              </div>
            </div>
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="analytics"
          title="7. Payment analytics dashboard"
          description="Payment-option clicks, provider breakdown, and trends."
        >
          <PaymentQrAnalyticsMock />
        </ShowcaseSection>
      </div>
    </div>
  );
}

function PaymentQrAnalyticsMock() {
  const mockData = {
    pageViews: 204,
    qrScans: 148,
    paymentLinkClicks: 89,
    googleReviewClicks: 19,
    providerClicks: { stripe: 15, cash_app: 42, zelle: 31, venmo: 22, paypal: 11 },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={qrUi.title}>Pay &amp; Review Page analytics</h3>
          <p className={qrUi.subtitle}>Payment-option clicks — not verified payments.</p>
        </div>
        <button type="button" className={cn(qrUi.btnSecondary, "inline-flex gap-2 shadow-sm")}>
          Export CSV
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <QrKpiCard label="Page views" value={String(mockData.pageViews)} trend="+18%" />
        <QrKpiCard label="QR scans" value={String(mockData.qrScans)} trend="+12%" />
        <QrKpiCard label="Payment-link clicks" value={String(mockData.paymentLinkClicks)} />
        <QrKpiCard label="Review-link clicks" value={String(mockData.googleReviewClicks)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cn(qrUi.cardPad)}>
          <h4 className="text-sm font-bold text-[#0B1B32]">Payment clicks by method</h4>
          <div className="mt-4">
            <DonutChartMock />
          </div>
        </div>
        <div className={cn(qrUi.cardPad)}>
          <h4 className="text-sm font-bold text-[#0B1B32]">Clicks over time</h4>
          <div className="mt-4 flex h-32 items-end gap-2">
            {[40, 55, 48, 72, 65, 89, 78].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-md bg-[#2563EB]/80" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-[#98A2B3]">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>
      </div>
      <div className={cn(qrUi.cardPad)}>
        <h4 className="text-sm font-bold text-[#0B1B32]">Recent activity</h4>
        <ul className="mt-4 divide-y divide-[#E6EAF0] text-sm">
          {Object.entries(mockData.providerClicks).map(([k, v]) => (
            <li key={k} className="flex justify-between py-2.5">
              <span className="text-[#667085]">{k.replace("_", " ")} clicked</span>
              <strong className="text-[#0B1B32]">{v}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
