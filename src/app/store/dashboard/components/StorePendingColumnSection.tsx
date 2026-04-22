"use client";

import type React from "react";

import { SectionCard } from "@/components/seariders-ui";
import { brand } from "@/lib/brand";

import type { TotalsSummary } from "../types";
import { euros } from "../utils";

type StorePendingColumnSectionProps = {
  totals: TotalsSummary;
  children: React.ReactNode;
};

const miniStat: React.CSSProperties = {
  padding: 12,
  border: `1px solid ${brand.colors.border}`,
  borderRadius: 16,
  background: brand.colors.surface,
};

const smallLabel: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
};

export function StorePendingColumnSection({ totals, children }: StorePendingColumnSectionProps) {
  return (
    <SectionCard eyebrow="Store" title="Pendientes tienda">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
        <div style={miniStat}>
          <div style={smallLabel}>Pendientes</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{totals.pendingCount}</div>
          <div style={{ fontWeight: 800 }}>{euros(totals.pendingCents)}</div>
        </div>
        <div style={miniStat}>
          <div style={smallLabel}>Pagadas</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{totals.paidCount}</div>
          <div style={{ fontWeight: 800 }}>{euros(totals.paidCents)}</div>
        </div>
        <div style={miniStat}>
          <div style={smallLabel}>Total del día</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{totals.dayCount}</div>
          <div style={{ fontWeight: 800 }}>{euros(totals.dayTotalCents)}</div>
        </div>
      </div>
      {children}
    </SectionCard>
  );
}
