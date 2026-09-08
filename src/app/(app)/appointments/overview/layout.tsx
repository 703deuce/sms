import { Geist } from "next/font/google";

/** Overview pilot only — professional grotesk for homepage color/type validation. */
const geistSans = Geist({
  variable: "--font-appt-overview-pilot",
  subsets: ["latin"],
});

export default function AppointmentsOverviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={`${geistSans.variable} ${geistSans.className}`}>{children}</div>;
}
