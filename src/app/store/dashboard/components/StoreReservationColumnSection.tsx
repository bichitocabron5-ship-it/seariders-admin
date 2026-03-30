"use client";

import type React from "react";

type StoreReservationColumnSectionProps = {
  title: string;
  count: number;
  subtitle?: React.ReactNode;
  emptyMessage: React.ReactNode;
  children: React.ReactNode;
};

export function StoreReservationColumnSection({
  title,
  count,
  subtitle,
  emptyMessage,
  children,
}: StoreReservationColumnSectionProps) {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>
        {title} <span style={{ opacity: 0.6, fontWeight: 700 }}>({count})</span>
      </h2>
      {subtitle ? <div style={{ fontSize: 12, opacity: 0.7, marginTop: -6, marginBottom: 10 }}>{subtitle}</div> : null}
      {count === 0 ? emptyMessage : <div style={{ display: "grid", gap: 10 }}>{children}</div>}
    </>
  );
}
