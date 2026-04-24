import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export function buildAdminMetadata({
  title,
  description,
}: {
  title: string;
  description: string;
}): Metadata {
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: `${title} | ${brand.adminName}`,
      description,
      siteName: brand.name,
      type: "website",
      images: [{ url: "/logo-seariders.png", alt: brand.adminName }],
    },
    twitter: {
      card: "summary",
      title: `${title} | ${brand.adminName}`,
      description,
      images: ["/logo-seariders.png"],
    },
  };
}
