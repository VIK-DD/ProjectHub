import type { Metadata, Viewport } from "next";

import "./globals.css";
import { Providers } from "@/components/providers";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: {
    default: "ProjectHub",
    template: "%s · ProjectHub",
  },
  description:
    "A premium personal project management platform for developers, students and entrepreneurs.",
  applicationName: "ProjectHub",
  appleWebApp: {
    capable: true,
    title: "ProjectHub",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/api/icon?size=192",
    apple: "/api/icon?size=180",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
