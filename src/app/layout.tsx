import type { Metadata } from "next";
import localFont from "next/font/local";
import { brand } from "@/lib/brand";
import { resolveMetadataBase } from "@/lib/metadata";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-sans-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  applicationName: brand.adminName,
  title: {
    default: brand.adminName,
    template: `%s | ${brand.adminName}`,
  },
  description: brand.description,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/logo-seariders.png", type: "image/png" }],
  },
  openGraph: {
    title: brand.adminName,
    description: brand.description,
    siteName: brand.name,
    images: [{ url: "/logo-seariders.png", alt: brand.adminName }],
  },
  twitter: {
    card: "summary",
    title: brand.adminName,
    description: brand.description,
    images: ["/logo-seariders.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} app-body antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
