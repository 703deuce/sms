"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Source_Serif_4 } from "next/font/google";
import { cn } from "@/lib/utils";

const display = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const APP_NAV = [
  { label: "Dashboard", href: "/sign-up" },
  { label: "Rank Tracker", href: "/sign-up" },
  { label: "Reviews", href: "/sign-up" },
  { label: "Tools", href: "/sign-up" },
  { label: "GMB Audit", href: "/tools/local-seo-audit" },
] as const;

export function FreeToolShell({
  embed,
  title,
  subtitle,
  steps,
  children,
  ctaHref = "/sign-up",
  ctaLabel = "Get started",
  footerNote = "Unlock full tracking, history, and campaigns in one place.",
}: {
  embed?: boolean;
  title: string;
  subtitle?: string;
  steps: { label: string }[];
  children: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  footerNote?: string;
}) {
  return (
    <div className={cn("min-h-screen bg-white", embed && "bg-[#F3F5F7] p-3 sm:p-4")}>
      {!embed ? (
        <header className="bg-[#137752] text-white">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="shrink-0 text-[15px] font-extrabold tracking-tight">
              Local SEO <span className="text-[#A6F4C5]">Express</span>
            </Link>
            <nav className="hidden flex-1 items-center justify-center gap-5 text-[13px] font-semibold md:flex">
              {APP_NAV.map((item) => (
                <Link key={item.label} href={item.href} className="opacity-90 hover:opacity-100">
                  {item.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/sign-in"
              className="ml-auto rounded-full border border-white/40 px-3.5 py-1.5 text-[12px] font-bold hover:bg-white/10"
            >
              Log out
            </Link>
          </div>
        </header>
      ) : null}

      <div className={cn("mx-auto max-w-5xl", embed ? "" : "px-4 py-8 sm:py-10")}>
        <div className={cn(embed && "rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-sm sm:p-6")}>
          <h1
            className={cn(
              display.className,
              "text-[1.75rem] font-extrabold leading-tight tracking-tight text-[#0B1220] sm:text-[2.15rem]"
            )}
          >
            {title}
          </h1>
          {subtitle ? <p className="mt-1.5 max-w-2xl text-[15px] text-[#667085]">{subtitle}</p> : null}

          {steps.length > 0 ? (
            <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => (
                <li
                  key={step.label}
                  className="flex items-center gap-3 rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] px-3 py-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#137752] text-[13px] font-extrabold text-white">
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-semibold leading-snug text-[#0B1220]">{step.label}</span>
                </li>
              ))}
            </ol>
          ) : null}

          <div className="mt-5">{children}</div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl bg-[#137752] px-5 py-5 text-white sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold">Ready to grow faster?</p>
              <p className="mt-1 text-sm text-white/85">{footerNote}</p>
            </div>
            <Link
              href={ctaHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-extrabold text-[#137752] shadow"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FreeToolField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-[#344054]">{label}</span>
      {children}
    </label>
  );
}

export const freeToolInputClass =
  "h-11 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 text-sm text-[#0B1220] outline-none transition focus:border-[#137752] focus:ring-2 focus:ring-[#137752]/15";

export const freeToolPrimaryBtnClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#137752] px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(19,119,82,0.28)] hover:bg-[#0f6344] disabled:opacity-50";
