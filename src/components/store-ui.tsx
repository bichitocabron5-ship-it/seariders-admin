"use client";

import type React from "react";

import { opsStyles } from "@/components/ops-ui";
import { brand } from "@/lib/brand";

type StoreHeroProps = {
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: string;
  titleColor?: string;
  eyebrowColor?: string;
  background?: string;
  children?: React.ReactNode;
};

type StoreSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  eyebrowColor?: string;
};

type StoreMetricCardProps = {
  label: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  accentColor?: string;
  valueColor?: string;
  children?: React.ReactNode;
};

export const storeStyles = {
  shell: {
    ...opsStyles.pageShell,
    width: "min(1560px, 100%)",
    gap: 18,
  } as React.CSSProperties,

  panel: {
    ...opsStyles.sectionCard,
    padding: 18,
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  } as React.CSSProperties,

  input: {
    ...opsStyles.field,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    background: "#fff",
  } as React.CSSProperties,

  primaryButton: {
    ...opsStyles.primaryButton,
    padding: "12px 16px",
    fontWeight: 800,
  } as React.CSSProperties,

  secondaryButton: {
    ...opsStyles.ghostButton,
    padding: "12px 16px",
    fontWeight: 700,
    color: brand.colors.primary,
  } as React.CSSProperties,
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

export function StoreHero({
  title,
  description,
  actions,
  eyebrow = "Store",
  titleColor = brand.colors.primary,
  eyebrowColor = brand.colors.secondary,
  background = "linear-gradient(135deg, #f8fafc 0%, #e7f4f2 100%)",
  children,
}: StoreHeroProps) {
  return (
    <section
      style={{
        ...storeStyles.panel,
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        alignItems: "flex-end",
        background,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: eyebrowColor }}>{eyebrow}</div>
        <h1 style={{ ...opsStyles.heroTitle, margin: 0, fontSize: "clamp(30px, 4vw, 38px)", lineHeight: 1, color: titleColor }}>{title}</h1>
        <div style={{ color: titleColor === "#fff" ? "#cbd5e1" : "#475569", maxWidth: 700 }}>{description}</div>
        {children}
      </div>
      {actions ? <div style={opsStyles.actionGrid}>{actions}</div> : null}
    </section>
  );
}

export function StoreSectionHeader({ eyebrow, title, description, action, eyebrowColor = brand.colors.secondary }: StoreSectionHeaderProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: eyebrowColor }}>{eyebrow}</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{description}</div>
      </div>
      {action}
    </div>
  );
}

export function StoreMetricGrid({ children }: { children: React.ReactNode }) {
  return <div style={metricGridStyle}>{children}</div>;
}

export function StoreMetricCard({
  label,
  value,
  description,
  accentColor = "#64748b",
  valueColor = brand.colors.primary,
  children,
}: StoreMetricCardProps) {
  return (
    <div
      style={{
        ...opsStyles.metricCard,
        padding: 14,
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, color: accentColor, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 950, color: valueColor }}>{value}</div>
      {description ? <div style={{ fontSize: 12, color: "#64748b" }}>{description}</div> : null}
      {children}
    </div>
  );
}
