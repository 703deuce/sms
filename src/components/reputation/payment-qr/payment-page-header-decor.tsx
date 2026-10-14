import type { PageThemeTokens } from "@/lib/reputation/payment-qr/page-themes";

const WAVE_BLUE = "#2563EB";
const WAVE_BLUE_LIGHT = "#3B82F6";

export function PaymentPageHeaderDecor({ theme }: { theme: PageThemeTokens }) {
  if (theme.headerDecor === "wave") {
    return (
      <div className="relative h-[96px] w-full overflow-visible" style={{ background: theme.cardBg }}>
        <svg
          className="absolute left-0 top-0 h-[96px] w-full"
          viewBox="0 0 390 96"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0,0 H390 V52 C320,78 280,32 195,52 C110,72 70,26 0,52 Z" fill={WAVE_BLUE} />
          <path
            d="M0,36 C55,62 125,22 195,42 C275,62 335,28 390,48 V96 H0 Z"
            fill={theme.cardBg}
          />
        </svg>
        <svg
          className="absolute left-0 top-0 h-[48px] w-full opacity-30"
          viewBox="0 0 390 48"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0,0 H390 V28 C300,8 90,40 0,16 Z" fill={WAVE_BLUE_LIGHT} />
        </svg>
      </div>
    );
  }

  if (theme.headerDecor === "floral") {
    return (
      <div className="relative h-[64px] w-full overflow-visible" style={{ background: theme.cardBg }}>
        <div
          className="absolute -left-[52px] -top-[52px] h-[120px] w-[120px] rounded-full"
          style={{ background: "#FBCFE8", opacity: 0.7 }}
        />
        <div
          className="absolute -right-[52px] -top-[52px] h-[120px] w-[120px] rounded-full"
          style={{ background: "#FBCFE8", opacity: 0.7 }}
        />
        <FloralBranchArt
          className="absolute left-0 top-0 h-[64px] w-[64px]"
          color={theme.accent}
          stroke={theme.primary}
          opacity={0.45}
        />
        <FloralBranchArt
          className="absolute right-0 top-0 h-[64px] w-[64px] scale-x-[-1]"
          color={theme.accent}
          stroke={theme.primary}
          opacity={0.45}
        />
      </div>
    );
  }

  if (theme.headerDecor === "shield") {
    return (
      <div
        className="relative h-[88px] w-full overflow-visible"
        style={{ background: theme.headerBg }}
      >
        <div
          className="absolute left-1/2 top-0 h-[72px] w-[140px] -translate-x-1/2 rounded-full opacity-40"
          style={{
            background: `radial-gradient(circle, ${theme.primary} 0%, transparent 70%)`,
          }}
        />
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 390 48"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0,0 H390 V22 L195,46 L0,22 Z" fill={theme.pageBg} />
        </svg>
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 390 48"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,0 H390 V20 L195,44 L0,20 Z"
            fill="none"
            stroke={theme.primary}
            strokeWidth="2.5"
          />
        </svg>
      </div>
    );
  }

  if (theme.headerDecor === "dark") {
    return (
      <div className="relative h-[88px] w-full overflow-visible" style={{ background: theme.headerBg }}>
        <div
          className="absolute left-1/2 top-0 h-[100px] w-[200px] -translate-x-1/2 rounded-full"
          style={{
            background: `radial-gradient(ellipse 100% 100% at 50% 0%, ${theme.primary}55 0%, transparent 72%)`,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="h-10 w-full"
      style={{
        background: `linear-gradient(180deg, ${theme.headerBg} 0%, ${theme.cardBg} 100%)`,
      }}
    />
  );
}

export function FloralBranchArt({
  className,
  color,
  stroke,
  opacity = 1,
}: {
  className?: string;
  color: string;
  stroke: string;
  opacity?: number;
}) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden style={{ opacity }}>
      <path
        d="M8 62 C18 42 32 38 48 48 C38 28 52 14 68 18 C58 8 42 6 30 18 C18 8 8 22 12 38 C4 48 8 62 8 62Z"
        fill={color}
        opacity="0.55"
      />
      <path
        d="M72 28 C82 18 92 24 94 36 C96 48 86 58 76 52 C70 62 58 68 48 62"
        stroke={stroke}
        strokeWidth="1.4"
        fill="none"
        opacity="0.65"
      />
      <circle cx="24" cy="34" r="4.5" fill={stroke} opacity="0.35" />
      <circle cx="38" cy="22" r="3.5" fill={stroke} opacity="0.3" />
    </svg>
  );
}

export function PaymentPageFooterWave({ theme }: { theme: PageThemeTokens }) {
  if (theme.headerDecor !== "wave") return null;
  return (
    <div className="relative h-[72px] w-full" style={{ background: theme.cardBg }}>
      <svg
        className="absolute left-0 top-0 h-full w-full"
        viewBox="0 0 390 72"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0,14 C90,46 170,6 195,26 C220,46 300,6 390,30 V72 H0 Z"
          fill={WAVE_BLUE}
          opacity="0.12"
        />
        <path
          d="M0,30 C100,58 300,18 390,42 V72 H0 Z"
          fill={WAVE_BLUE}
          opacity="0.08"
        />
      </svg>
      <svg
        className="absolute bottom-0 left-0 h-[40px] w-full"
        viewBox="0 0 390 40"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0,0 C110,32 290,0 390,20 V40 H0 Z"
          fill={WAVE_BLUE}
          opacity="0.22"
        />
      </svg>
    </div>
  );
}
