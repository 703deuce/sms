"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { Heart, Shield, Users } from "lucide-react";
import type { PosterConfig } from "@/lib/reputation/review-requests";
import {
  normalizePosterTemplateKey,
  type PosterTemplateKey,
} from "@/lib/reputation/poster-templates";
import { cn } from "@/lib/utils";

const FORMAT_SCALE: Record<PosterConfig["format"], string> = {
  a4: "max-w-[360px]",
  a5: "max-w-[300px]",
  letter: "max-w-[340px]",
};

function darkenHex(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Math.max(0, parseInt(normalized.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(normalized.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(normalized.slice(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lightenHex(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Math.min(255, parseInt(normalized.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(normalized.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(normalized.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function GoldStars({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            fill="#F5C518"
            d="M12 2l2.9 6.26 6.84.6-5.18 4.48 1.56 6.68L12 16.9l-6.12 3.12 1.56-6.68L2.26 8.86l6.84-.6L12 2z"
          />
        </svg>
      ))}
    </div>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function QrBlock({
  qrDataUrl,
  frameClassName,
}: {
  qrDataUrl: string | null;
  frameClassName?: string;
}) {
  return (
    <div className={cn("rounded-xl bg-white p-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)]", frameClassName)}>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt="Review QR code"
          className="block aspect-square h-auto w-full rounded-sm object-contain"
        />
      ) : (
        <div className="aspect-square w-full animate-pulse rounded bg-[#F2F4F7]" />
      )}
    </div>
  );
}

/** QR on print posters, or hosted payment UI in the same slot. */
function PosterCenter({
  qrDataUrl,
  centerContent,
  frameClassName,
  wrapperClassName = "w-[54%] max-w-[155px]",
  animateEntry = false,
}: {
  qrDataUrl: string | null;
  centerContent?: ReactNode;
  frameClassName?: string;
  wrapperClassName?: string;
  animateEntry?: boolean;
}) {
  if (centerContent) {
    return (
      <div
        className={cn(
          "w-full max-w-[min(100%,280px)]",
          wrapperClassName,
          animateEntry && "opacity-0 [animation:brandHostCenterIn_0.65s_ease-out_forwards]"
        )}
      >
        {centerContent}
      </div>
    );
  }
  return (
    <div className={wrapperClassName}>
      <QrBlock qrDataUrl={qrDataUrl} frameClassName={frameClassName} />
    </div>
  );
}

function HostedReviewAction({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 w-full max-w-[min(100%,280px)] opacity-0 [animation:brandHostCenterIn_0.65s_ease-out_0.15s_forwards]">
      {children}
    </div>
  );
}

function FooterPillar({
  icon: Icon,
  line1,
  line2,
  accent,
}: {
  icon: typeof Shield;
  line1: string;
  line2: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 text-center">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full border-2"
        style={{ borderColor: accent, color: accent }}
      >
        <Icon className="h-3 w-3" strokeWidth={2.25} />
      </span>
      <div>
        <p className="text-[6.5px] font-semibold leading-tight text-white">{line1}</p>
        <p className="text-[6px] leading-tight text-white/75">{line2}</p>
      </div>
    </div>
  );
}

function Shell({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "grid aspect-[3/4] overflow-hidden rounded-[1.25rem] shadow-[0_20px_50px_rgba(15,23,42,0.18)] ring-1 ring-black/5",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

type LayoutProps = {
  businessName: string;
  poster: PosterConfig;
  qrDataUrl: string | null;
  brand: string;
  brandDark: string;
  /** Replaces QR block — payment buttons on hosted pay pages */
  centerContent?: ReactNode;
  hostedReviewAction?: ReactNode;
  animateHostedEntry?: boolean;
};

function ClassicLayout({
  businessName,
  poster,
  qrDataUrl,
  brand,
  brandDark,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  return (
    <Shell className="grid-rows-[minmax(0,1fr)_auto_auto] bg-white">
      <div
        className="relative flex min-h-0 flex-col"
        style={{
          background: `linear-gradient(165deg, ${brand} 0%, ${brandDark} 55%, ${brandDark} 100%)`,
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
          viewBox="0 0 400 400"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path fill="white" d="M0 60 C80 20 120 100 200 70 C280 40 320 120 400 80 L400 0 L0 0 Z" />
          <path fill="white" d="M0 180 C100 140 140 220 220 190 C300 160 340 240 400 210 L400 400 L0 400 Z" />
        </svg>
        <div className="relative shrink-0 px-5 pb-1 pt-5 text-center text-white">
          <GoldStars />
          <h2 className="mt-1.5 text-lg font-bold leading-tight tracking-tight drop-shadow-sm">
            {poster.title}
          </h2>
          <p className="mt-0.5 text-[11px] font-medium text-white/90">{poster.description}</p>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-6 py-2">
          <PosterCenter
            qrDataUrl={qrDataUrl}
            centerContent={centerContent}
            animateEntry={animateHostedEntry}
            wrapperClassName={centerContent ? "w-full max-w-[280px]" : "w-[50%] max-w-[150px]"}
          />
        </div>
        <svg className="relative block w-full shrink-0" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
          <path fill="white" d="M0 22 C70 42 150 6 200 22 C250 38 330 10 400 26 L400 40 L0 40 Z" />
        </svg>
      </div>
      <div className="relative z-[2] -mt-1 shrink-0 bg-white px-5 pb-2 pt-0 text-center">
        <div className="mx-auto -mt-4 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] ring-4 ring-white">
          <GoogleLogo className="h-5 w-5" />
        </div>
        <p className="mt-1.5 text-[13px] font-bold leading-tight text-[#0B1B32]">{businessName}</p>
        {poster.showFooter ? (
          <p className="mt-0.5 text-[9px] leading-snug text-[#667085]">
            Thank you for supporting our local business.
          </p>
        ) : null}
      </div>
      {poster.showFooter ? (
        <div className="grid shrink-0 grid-cols-3 bg-[#0f172a] px-2 py-2.5">
          <FooterPillar icon={Shield} line1="Local & Trusted" line2="5-Star Service" accent={brand} />
          <FooterPillar icon={Users} line1="Customer Focused" line2="Always Here to Help" accent={brand} />
          <FooterPillar icon={Heart} line1="We Appreciate" line2="Your Support" accent={brand} />
        </div>
      ) : (
        <div className="shrink-0 pb-3" />
      )}
    </Shell>
  );
}

const BG = {
  marble: "/poster-templates/marble.jpg",
  gold: "/poster-templates/gold-satin.jpg",
  cafe: "/poster-templates/cafe-coffee.jpg",
  wood: "/poster-templates/rustic-wood.jpg",
} as const;

/** 1 — Modern Minimal: light marble + solid green footer bar */
function ModernMinimalLayout({
  businessName,
  poster,
  qrDataUrl,
  brand,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  return (
    <Shell className="relative grid-rows-[auto_1fr_auto] overflow-hidden bg-[#F4F2EF]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BG.marble} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55" />
      <div className="pointer-events-none absolute inset-0 bg-white/55" />
      <div className="relative px-5 pt-7 text-center">
        <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#0B1220]">{poster.title}</h2>
        <p className="mt-1.5 text-[11px] text-[#667085]">{poster.description}</p>
      </div>
      <div className="relative flex flex-col items-center justify-center gap-3 px-6">
        <PosterCenter
          qrDataUrl={qrDataUrl}
          centerContent={centerContent}
          frameClassName="rounded-lg shadow-md ring-1 ring-black/5"
          animateEntry={animateHostedEntry}
          wrapperClassName={centerContent ? "w-full max-w-[280px]" : "w-[54%] max-w-[155px]"}
        />
        <GoldStars />
        <p className="text-[12px] font-bold text-[#0B1220]">{businessName}</p>
      </div>
      <div className="relative px-0 pb-0">
        <div className="py-3.5 text-center text-[12px] font-extrabold tracking-[0.14em] text-white" style={{ backgroundColor: brand }}>
          {centerContent ? "PAY & REVIEW" : "SCAN TO REVIEW"}
        </div>
      </div>
    </Shell>
  );
}

/** 2 — Bold Green: full green field + white convex curve at bottom */
function SolidGreenLayout({
  businessName,
  poster,
  qrDataUrl,
  brand,
  brandDark,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  return (
    <Shell
      className="relative overflow-hidden text-white"
      style={{ background: `linear-gradient(180deg, ${brand} 0%, ${brandDark} 100%)` }}
    >
      <div className="relative z-[1] flex h-full flex-col px-5 pt-8">
        <h2 className="text-center text-[22px] font-black uppercase leading-tight tracking-wide">{poster.title}</h2>
        <p className="mt-1.5 text-center text-[12px] font-medium text-white/90">{poster.description}</p>
        <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-3 pb-16">
          <PosterCenter
            qrDataUrl={qrDataUrl}
            centerContent={centerContent}
            animateEntry={animateHostedEntry}
            wrapperClassName={centerContent ? "w-full max-w-[280px]" : "w-[54%] max-w-[155px]"}
          />
          <GoldStars />
          <p className="text-[12px] font-bold">{businessName}</p>
        </div>
      </div>
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 w-full" viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden>
        <path fill="#fff" d="M0 90 L0 48 C70 12 140 70 200 42 C270 12 340 55 400 28 L400 90 Z" />
      </svg>
    </Shell>
  );
}

/** 3 — Elegant Black: black + thin gold border + cursive thank-you */
function ElegantBlackLayout({
  businessName,
  poster,
  qrDataUrl,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  return (
    <Shell className="relative overflow-hidden bg-[#0E0E0E] p-[7px]">
      <div className="flex h-full flex-col overflow-hidden rounded-[0.95rem] border border-[#C9A227] bg-[#141414] text-white">
        <div className="px-5 pt-8 text-center">
          <h2 className="font-serif text-[28px] font-normal italic leading-none tracking-wide text-[#E8D5A3]">
            {poster.title}
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#C9A227]/90">{poster.description}</p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
          <div className="rounded-md border border-[#C9A227]/55 bg-[#C9A227]/10 p-1.5">
            <div className="w-[132px]">
              <PosterCenter
                qrDataUrl={qrDataUrl}
                centerContent={centerContent}
                frameClassName="rounded-sm shadow-none"
                wrapperClassName="w-[132px]"
                animateEntry={animateHostedEntry}
              />
            </div>
          </div>
          <GoldStars />
        </div>
        <div className="border-t border-[#C9A227]/35 px-5 py-4 text-center">
          <p className="text-[12px] font-semibold tracking-wide text-[#E8D5A3]">{businessName}</p>
        </div>
      </div>
    </Shell>
  );
}

/** 4 — Friendly Green: white + decorative green brush/wave at bottom */
function FriendlyGreenLayout({
  businessName,
  poster,
  qrDataUrl,
  brand,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  const soft = lightenHex(brand, 170);
  return (
    <Shell className="relative overflow-hidden bg-white">
      <div className="relative z-[1] flex h-full flex-col px-5 pt-8">
        <h2 className="text-center text-[20px] font-extrabold leading-tight text-[#0B1220]">{poster.title}</h2>
        <p className="mt-1.5 text-center text-[11px] text-[#667085]">{poster.description}</p>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3 pb-14">
          <PosterCenter
            qrDataUrl={qrDataUrl}
            centerContent={centerContent}
            animateEntry={animateHostedEntry}
            wrapperClassName={centerContent ? "w-full max-w-[280px]" : "w-[54%] max-w-[155px]"}
          />
          <GoldStars />
          <p className="text-[12px] font-bold text-[#0B1220]">{businessName}</p>
        </div>
      </div>
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full" viewBox="0 0 400 96" preserveAspectRatio="none" aria-hidden>
        <path fill={soft} d="M0 58 C55 20 110 78 170 48 C230 18 290 70 400 36 L400 96 L0 96 Z" />
        <path fill={brand} d="M0 72 C70 40 130 92 200 62 C270 34 340 88 400 58 L400 96 L0 96 Z" />
      </svg>
    </Shell>
  );
}

/** 5 — Premium Gold: black + diagonal gold satin + gold footer bar */
function PremiumGoldLayout({
  businessName,
  poster,
  qrDataUrl,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  return (
    <Shell className="relative overflow-hidden bg-[#0A0A0A] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BG.gold}
        alt=""
        className="pointer-events-none absolute -right-6 -top-8 h-44 w-52 rotate-12 object-cover opacity-90"
        style={{ clipPath: "polygon(18% 0, 100% 0, 100% 100%, 0 78%)" }}
      />
      <div className="pointer-events-none absolute -right-10 -top-6 h-40 w-48 rotate-12 bg-gradient-to-br from-[#F5E6A8]/80 via-[#D4AF37]/55 to-transparent" />
      <div className="relative z-[1] flex h-full flex-col">
        <div className="px-5 pt-9 text-center">
          <h2 className="text-[15px] font-black uppercase leading-snug tracking-[0.06em] text-[#F7E7A8]">
            {poster.title}
          </h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
          <div className="w-[52%] max-w-[150px]">
          <PosterCenter
            qrDataUrl={qrDataUrl}
            centerContent={centerContent}
            animateEntry={animateHostedEntry}
          />
          </div>
          <GoldStars />
          <p className="text-[11px] text-white/75">{poster.description}</p>
        </div>
        <div className="bg-[#D4AF37] px-5 py-3.5 text-center">
          <p className="text-[12px] font-extrabold tracking-wide text-[#0B0B0B]">{businessName}</p>
        </div>
      </div>
    </Shell>
  );
}

/** 6 — Cafe Coffee Shop: real coffee photo background */
function CafeCoffeeLayout({
  businessName,
  poster,
  qrDataUrl,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  return (
    <Shell className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BG.cafe} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/60" />
      <div className="relative z-[1] flex h-full flex-col px-5 py-7 text-white">
        <h2 className="text-center font-serif text-[24px] font-semibold italic leading-tight text-[#F5E6C8] drop-shadow">
          {poster.title}
        </h2>
        <p className="mt-1 text-center text-[11px] font-medium text-white/90">{poster.description}</p>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3">
        <PosterCenter
          qrDataUrl={qrDataUrl}
          centerContent={centerContent}
          frameClassName="bg-white shadow-none"
          animateEntry={animateHostedEntry}
          wrapperClassName={centerContent ? "w-full max-w-[280px]" : "w-[54%] max-w-[155px] rounded-xl bg-white/95 p-2 shadow-xl"}
        />
          <GoldStars />
          <p className="text-[12px] font-bold drop-shadow">{businessName}</p>
        </div>
      </div>
    </Shell>
  );
}

/** 7 — Clear Blue: white + blue waves top & bottom */
function ClearBlueLayout({
  businessName,
  poster,
  qrDataUrl,
  brand,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  const blue = brand.match(/#[0-9a-f]{6}/i) && !/^#(16A34A|137752|10b981)/i.test(brand) ? brand : "#1D4ED8";
  return (
    <Shell className="relative overflow-hidden bg-white">
      <svg className="pointer-events-none absolute inset-x-0 top-0 h-16 w-full" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden>
        <path fill={lightenHex(blue, 150)} d="M0 0 L400 0 L400 28 C320 55 250 10 180 36 C110 60 50 20 0 42 Z" />
        <path fill={blue} d="M0 0 L400 0 L400 16 C330 40 250 4 180 28 C110 50 50 8 0 26 Z" />
      </svg>
      <div className="relative z-[1] flex h-full flex-col px-5 pb-4 pt-14">
        <h2 className="text-center text-[22px] font-black uppercase tracking-tight" style={{ color: blue }}>
          {poster.title}
        </h2>
        <p className="mt-1.5 text-center text-[11px] text-[#667085]">{poster.description}</p>
        <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-3 pb-10">
          <PosterCenter
            qrDataUrl={qrDataUrl}
            centerContent={centerContent}
            animateEntry={animateHostedEntry}
            wrapperClassName={centerContent ? "w-full max-w-[280px]" : "w-[54%] max-w-[155px]"}
          />
          <GoldStars />
          <p className="text-[12px] font-bold text-[#0B1220]">{businessName}</p>
        </div>
      </div>
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden>
        <path fill={lightenHex(blue, 150)} d="M0 64 L0 34 C70 8 140 52 210 28 C280 6 340 44 400 22 L400 64 Z" />
        <path fill={blue} d="M0 64 L0 44 C80 18 150 58 220 36 C290 16 350 50 400 30 L400 64 Z" />
      </svg>
    </Shell>
  );
}

/** 8 — Black & White: sharp black triangles in opposite corners */
function BlackWhiteLayout({
  businessName,
  poster,
  qrDataUrl,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  return (
    <Shell className="relative overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute left-0 top-0 h-0 w-0 border-b-[110px] border-l-[130px] border-b-transparent border-l-[#0B1220]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 border-r-[130px] border-t-[110px] border-r-[#0B1220] border-t-transparent"
        aria-hidden
      />
      <div className="relative z-[1] flex h-full flex-col px-5 py-8">
        <h2 className="text-center text-[20px] font-black uppercase leading-tight tracking-wide text-[#0B1220]">
          {poster.title}
        </h2>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3">
          <PosterCenter
            qrDataUrl={qrDataUrl}
            centerContent={centerContent}
            frameClassName="rounded-none shadow-md"
            animateEntry={animateHostedEntry}
            wrapperClassName={centerContent ? "w-full max-w-[280px]" : "w-[54%] max-w-[155px]"}
          />
          <GoldStars />
        </div>
        <div className="text-center">
          <p className="text-[12px] font-bold text-[#0B1220]">{businessName}</p>
          <p className="mt-0.5 text-[10px] text-[#667085]">{poster.description}</p>
        </div>
      </div>
    </Shell>
  );
}

/** 9 — Rustic Wood: vertical wood plank photo + parchment QR card */
function RusticWoodLayout({
  businessName,
  poster,
  qrDataUrl,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  return (
    <Shell className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BG.wood} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-black/35" />
      <div className="relative z-[1] flex h-full flex-col px-5 py-7 text-white">
        <h2 className="text-center font-serif text-[28px] italic leading-none drop-shadow-md">{poster.title}</h2>
        <p className="mt-1 text-center text-[12px] font-medium text-white/90">{poster.description}</p>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center">
          <div className="w-[58%] max-w-[165px] rounded-xl bg-[#F3E6D2] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.35)] ring-1 ring-black/10">
            <PosterCenter
              qrDataUrl={qrDataUrl}
              centerContent={centerContent}
              frameClassName="bg-white shadow-none"
              animateEntry={animateHostedEntry}
            />
            <GoldStars className="mt-2" />
          </div>
        </div>
        <p className="text-center text-[12px] font-bold drop-shadow">{businessName}</p>
      </div>
    </Shell>
  );
}

/** 10 — Geo Colorful: organic colorful blobs in corners */
function BoldPaletteLayout({
  businessName,
  poster,
  qrDataUrl,
  brand,
  centerContent,
  hostedReviewAction,
  animateHostedEntry,
}: LayoutProps) {
  return (
    <Shell className="relative overflow-hidden bg-white">
      <span className="absolute -left-8 -top-10 h-36 w-36 rounded-[46%] bg-[#F43F5E]" />
      <span className="absolute -right-10 top-8 h-28 w-28 rounded-full bg-[#FACC15]" />
      <span className="absolute -bottom-10 -left-6 h-32 w-36 rounded-[48%] bg-[#22C55E]" />
      <span className="absolute -bottom-8 -right-8 h-28 w-28 rounded-[42%] bg-[#3B82F6]" />
      <span className="absolute right-10 top-24 h-14 w-14 rounded-[40%]" style={{ backgroundColor: brand }} />
      <div className="relative z-[1] flex h-full flex-col px-5 py-8">
        <h2 className="text-center text-[20px] font-black uppercase leading-tight tracking-wide text-[#0B1220]">
          {poster.title}
        </h2>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3">
          <PosterCenter
            qrDataUrl={qrDataUrl}
            centerContent={centerContent}
            animateEntry={animateHostedEntry}
            wrapperClassName={centerContent ? "w-full max-w-[280px]" : "w-[54%] max-w-[155px]"}
          />
          <GoldStars />
        </div>
        <div className="text-center">
          <p className="text-[12px] font-bold text-[#0B1220]">{businessName}</p>
          <p className="mt-0.5 text-[10px] text-[#667085]">{poster.description}</p>
        </div>
      </div>
    </Shell>
  );
}

function renderTemplate(
  key: PosterTemplateKey,
  props: LayoutProps
): ReactNode {
  switch (key) {
    case "modern_minimal":
      return <ModernMinimalLayout {...props} />;
    case "solid_green":
      return <SolidGreenLayout {...props} />;
    case "elegant_black":
      return <ElegantBlackLayout {...props} />;
    case "friendly_green":
      return <FriendlyGreenLayout {...props} />;
    case "premium_gold":
      return <PremiumGoldLayout {...props} />;
    case "cafe_coffee":
      return <CafeCoffeeLayout {...props} />;
    case "clear_blue":
      return <ClearBlueLayout {...props} />;
    case "black_white":
      return <BlackWhiteLayout {...props} />;
    case "rustic_wood":
      return <RusticWoodLayout {...props} />;
    case "bold_palette":
      return <BoldPaletteLayout {...props} />;
    case "classic_poster":
    default:
      return <ClassicLayout {...props} />;
  }
}

/**
 * Printable Google Review QR poster — classic free layout + paid template variants.
 */
export const ReviewPosterPreview = forwardRef<
  HTMLDivElement,
  {
    businessName: string;
    poster: PosterConfig;
    qrDataUrl: string | null;
    size?: "default" | "hero";
    templateKey?: string | null;
    /** Hosted pay page — payment UI in the QR slot */
    centerContent?: ReactNode;
    hostedReviewAction?: ReactNode;
    animateHostedEntry?: boolean;
  }
>(function ReviewPosterPreview(
  {
    businessName,
    poster,
    qrDataUrl,
    size = "default",
    templateKey,
    centerContent,
    hostedReviewAction,
    animateHostedEntry,
  },
  ref
) {
  const brand = poster.brandColor || "#137752";
  const brandDark = darkenHex(brand, 28);
  const isHero = size === "hero";
  const key = normalizePosterTemplateKey(templateKey);

  return (
    <div
      className={cn(
        "mx-auto w-full",
        isHero ? "max-w-[min(100%,300px)]" : FORMAT_SCALE[poster.format]
      )}
    >
      <div ref={ref}>
        {renderTemplate(key, {
          businessName,
          poster,
          qrDataUrl,
          brand,
          brandDark,
          centerContent,
          hostedReviewAction,
          animateHostedEntry,
        })}
      </div>
    </div>
  );
});
