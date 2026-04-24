import type { Metadata } from "next";
import { ReservationCheckinPageClient } from "./reservation-checkin-page-client";
import { buildPublicPageMetadata } from "@/lib/metadata";
import { normalizePublicLanguage } from "@/lib/public-links/i18n";

export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return buildPublicPageMetadata({
    title: "Pre-checkin SeaRiders",
    description: "Pre-checkin publico de SeaRiders para revisar datos y preparar la firma de contratos.",
    path: `/checkin/${encodeURIComponent(token)}`,
  });
}

export default async function ReservationCheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  return <ReservationCheckinPageClient token={token} language={normalizePublicLanguage(lang)} />;
}
