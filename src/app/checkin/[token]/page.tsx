import { ReservationCheckinPageClient } from "./reservation-checkin-page-client";

export const runtime = "nodejs";

export default async function ReservationCheckinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ReservationCheckinPageClient token={token} />;
}
