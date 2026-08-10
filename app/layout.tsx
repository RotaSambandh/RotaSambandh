import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { GoogleAnalytics } from "@/components/observability/google-analytics";
import { appOrigin, DISPLAY_NAME, TAGLINE } from "@/shared/constants";
import "./globals.css";

/**
 * Rotary International free digital typography (Brand guidelines):
 * - Primary: Open Sans — headlines, nav, UI, and body (Arial fallback)
 * Licensed Frutiger / Sentinel are not embedded (purchase via graphics@rotary.org).
 * Regular Open Sans width only (not Condensed). Body uses Open Sans rather than
 * Georgia for easier long-form screen reading (still a Rotary-approved option).
 */
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appOrigin()),
  alternates: { canonical: "/" },
  title: {
    default: `${DISPLAY_NAME} · RotaSambandh`,
    template: `%s · RotaSambandh`,
  },
  description: TAGLINE,
  applicationName: "RotaSambandh",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "RotaSambandh",
    statusBarStyle: "default",
  },
  openGraph: {
    title: DISPLAY_NAME,
    description: TAGLINE,
    type: "website",
    url: "/",
    siteName: "RotaSambandh",
    locale: "en_IN",
    images: [{ url: "/brand/mark-circle-512.webp", width: 512, height: 512, alt: "RotaSambandh" }],
  },
  twitter: {
    card: "summary",
    title: DISPLAY_NAME,
    description: TAGLINE,
    images: ["/brand/mark-circle-512.webp"],
  },
  icons: {
    icon: [{ url: "/brand/mark-circle-64.webp", type: "image/webp" }, { url: "/favicon.ico" }],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a2540",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${openSans.variable} h-full antialiased`}>
      <body className="font-body flex min-h-full flex-col">
        <GoogleAnalytics />
        <Providers>
          <RegisterServiceWorker />
          {children}
        </Providers>
      </body>
    </html>
  );
}
