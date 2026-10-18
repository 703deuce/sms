import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transovo New App",
  description: "Isolated application scaffold inside the Transovo repository",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
