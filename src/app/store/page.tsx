import { redirect } from "next/navigation";

import StoreDashboard from "./store-dashboard";

export default async function StorePage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const reservationIdRaw = searchParams?.reservationId;
  const boothCodeRaw = searchParams?.boothCode;
  const reservationId = Array.isArray(reservationIdRaw) ? reservationIdRaw[0] : reservationIdRaw;
  const boothCode = Array.isArray(boothCodeRaw) ? boothCodeRaw[0] : boothCodeRaw;

  if (reservationId) {
    const next = new URLSearchParams({ editFrom: reservationId });
    if (boothCode) next.set("boothCode", boothCode);
    redirect(`/store/create?${next.toString()}`);
  }

  return <StoreDashboard />;
}
