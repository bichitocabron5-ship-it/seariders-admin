import type { Metadata } from "next";
import { brand } from "@/lib/brand";

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
}

export function resolveMetadataBase() {
  const configured =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL ?? "") ??
    normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "") ??
    normalizeBaseUrl(process.env.VERCEL_URL ?? "") ??
    "http://localhost:3000";

  return new URL(configured);
}

export function resolveAbsoluteUrl(path: string) {
  return new URL(path, resolveMetadataBase()).toString();
}

export function buildPublicPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const imageUrl = resolveAbsoluteUrl("/logo-seariders.png");
  const pageUrl = resolveAbsoluteUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: brand.name,
      type: "website",
      images: [
        {
          url: imageUrl,
          alt: brand.name,
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [imageUrl],
    },
  };
}
