import type { PageThemeTokens } from "@/lib/reputation/payment-qr/page-themes";
import { FloralBranchArt } from "@/components/reputation/payment-qr/payment-page-header-decor";

export function PaymentPageBackgroundDecor({ theme }: { theme: PageThemeTokens }) {
  if (theme.headerDecor === "floral") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
        <div
          className="absolute -left-[88px] -top-[88px] h-[176px] w-[176px] rounded-full"
          style={{ background: "#FBCFE8", opacity: 0.65 }}
        />
        <div
          className="absolute -right-[88px] -top-[88px] h-[176px] w-[176px] rounded-full"
          style={{ background: "#FBCFE8", opacity: 0.65 }}
        />
        <div
          className="absolute -left-[40px] top-[32px] h-[96px] w-[96px] rounded-full"
          style={{ background: "#F9A8D4", opacity: 0.35 }}
        />
        <div
          className="absolute -right-[40px] top-[32px] h-[96px] w-[96px] rounded-full"
          style={{ background: "#F9A8D4", opacity: 0.35 }}
        />
        <FloralBranchArt
          className="absolute -left-1 bottom-10 h-[92px] w-[92px]"
          color={theme.accent}
          stroke={theme.primary}
          opacity={0.4}
        />
        <FloralBranchArt
          className="absolute -right-1 bottom-10 h-[92px] w-[92px] scale-x-[-1]"
          color={theme.accent}
          stroke={theme.primary}
          opacity={0.4}
        />
      </div>
    );
  }

  return null;
}
