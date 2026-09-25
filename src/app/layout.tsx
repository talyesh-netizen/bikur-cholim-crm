import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  applicationName: APP_NAME,
  description: `Internal CRM for the ${ORGANIZATION_NAME} Senior Living Resident Support Services department.`,
  // Internal tool: keep it out of search engines.
  robots: { index: false, follow: false },
  // The manifest itself comes from src/app/manifest.ts (Next.js links it
  // automatically).
  appleWebApp: {
    capable: true,
    // "default" = dark status-bar text on the app's light background.
    statusBarStyle: "default",
    title: "Resident Support",
  },
  formatDetection: {
    // Phone numbers are already real tap-to-call links where it matters;
    // don't let iOS turn room numbers or dates into bogus ones.
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#b5592f",
  width: "device-width",
  initialScale: 1,
  // Lets the layout extend under the iPhone home indicator/notch; the
  // bottom nav and header add the matching safe-area padding.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
