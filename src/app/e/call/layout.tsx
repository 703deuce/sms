import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Business Calls",
  description: "Return business calls from your phone",
  manifest: "/e/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Business Calls",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function EmployeeCallLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#111827]">
      {children}
    </div>
  );
}
