import { IBM_Plex_Sans } from "next/font/google";

/** Shared pilot type — IBM Plex Sans, compact enterprise scale. */
export const appointmentsPilotFont = IBM_Plex_Sans({
  variable: "--font-appt-overview-pilot",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
