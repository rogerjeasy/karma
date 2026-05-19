import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Karma — The Reincarnation Agent",
    template: "%s · Karma",
  },
  description:
    "Karma learns what deprecated services secretly did, then watches replacements and flags silent regressions that pass every test.",
  keywords: ["observability", "Dynatrace", "service migration", "contract testing"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
