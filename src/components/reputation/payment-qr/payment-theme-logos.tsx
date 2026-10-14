import type { PageThemeKey } from "@/lib/reputation/payment-qr/types";
import { cn } from "@/lib/utils";

type LogoProps = {
  theme: PageThemeKey;
  businessName: string;
  className?: string;
  borderColor?: string;
};

export function PaymentThemeLogo({
  theme,
  businessName,
  className,
  borderColor,
}: LogoProps) {
  const letter = businessName.charAt(0).toUpperCase();

  if (theme === "modern_blue") {
    return (
      <div
        className={cn(
          "flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white shadow-[0_8px_24px_rgba(29,78,216,0.22)]",
          className
        )}
        style={{ border: `3px solid ${borderColor ?? "#FFFFFF"}` }}
      >
        <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden>
          <path
            d="M16 5C11 13 8 17.5 8 21.5a8 8 0 1016 0c0-4-3-8.5-8-16.5z"
            fill="#3B82F6"
          />
          <path
            d="M16 14v8M13 17h6"
            stroke="#2563EB"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      </div>
    );
  }

  if (theme === "floral_pink") {
    return (
      <div
        className={cn(
          "flex h-[68px] w-[68px] items-center justify-center rounded-full shadow-[0_8px_22px_rgba(236,72,153,0.35)]",
          className
        )}
        style={{
          background: "linear-gradient(145deg, #F9A8D4 0%, #EC4899 55%, #DB2777 100%)",
          border: `3px solid ${borderColor ?? "#FFFFFF"}`,
        }}
      >
        <svg viewBox="0 0 32 32" className="h-10 w-10" aria-hidden>
          <circle cx="16" cy="14" r="5" fill="white" opacity="0.9" />
          <path
            d="M16 8c-2 4-5 6-5 9a5 5 0 1010 0c0-3-3-5-5-9z"
            fill="white"
            opacity="0.55"
          />
        </svg>
      </div>
    );
  }

  if (theme === "bold_professional") {
    return (
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_28px_rgba(212,175,55,0.45)]",
          className
        )}
        style={{
          background: "linear-gradient(180deg, #F0C75E 0%, #D4AF37 100%)",
          border: `3px solid ${borderColor ?? "#1C1C1C"}`,
        }}
      >
        <div className="h-5 w-10 rounded-sm bg-[#0A0A0A]/80" />
      </div>
    );
  }

  if (theme === "minimal_elegant") {
    return (
      <div
        className={cn(
          "flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#E8DFD4] font-serif text-2xl font-bold text-[#8B7355] shadow-sm",
          className
        )}
        style={{ border: `2px solid ${borderColor ?? "#C9BAA8"}` }}
      >
        {letter}
      </div>
    );
  }

  if (theme === "dark_luxury") {
    return (
      <div
        className={cn(
          "flex h-[64px] w-[64px] items-center justify-center rounded-full shadow-[0_0_32px_rgba(212,175,55,0.5)]",
          className
        )}
        style={{
          background: "linear-gradient(180deg, #F5D76E 0%, #D4AF37 100%)",
          border: `3px solid ${borderColor ?? "#121212"}`,
        }}
      >
        <span className="font-serif text-xl font-bold text-[#0A0A0A]">{letter}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white",
        className
      )}
      style={{
        background: "linear-gradient(135deg, #2563EB, #3B82F6)",
        border: `3px solid ${borderColor ?? "#FFFFFF"}`,
      }}
    >
      {letter}
    </div>
  );
}
