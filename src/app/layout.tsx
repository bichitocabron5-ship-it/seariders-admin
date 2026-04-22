import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: "SeaRiders Admin",
    template: "%s | SeaRiders Admin",
  },
  description: "Panel operativo y de administracion de SeaRiders para tienda, plataforma, carpa y flota.",
  icons: {
    icon: [{ url: "/logo-seariders.png", type: "image/png" }],
    shortcut: ["/logo-seariders.png"],
    apple: [{ url: "/logo-seariders.png", type: "image/png" }],
  },
  openGraph: {
    title: "SeaRiders Admin",
    description: "Panel operativo y de administracion de SeaRiders.",
    images: [{ url: "/logo-seariders.png" }],
  },
  twitter: {
    card: "summary",
    title: "SeaRiders Admin",
    description: "Panel operativo y de administracion de SeaRiders.",
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
