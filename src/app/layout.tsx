import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { BRAND_NAME } from "@/lib/brand";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME} — AI Receptionist`,
    template: `%s · ${BRAND_NAME}`,
  },
  description:
    "AI phone receptionist for small businesses. Answer calls, take messages, book appointments, and transfer callers with natural voice AI.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
