import { ReservationCheckinPageClient } from "./reservation-checkin-page-client";
import { normalizePublicLanguage } from "@/lib/public-links/i18n";

export const runtime = "nodejs";

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
