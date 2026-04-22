"use client";

import type React from "react";
import { brand } from "@/lib/brand";

export const opsStyles = {
  pageShell: {
    width: "min(1400px, 100%)",
    padding: "clamp(16px, 3vw, 28px)",
    margin: "0 auto",
    display: "grid",
    gap: 20,
  } as React.CSSProperties,

  heroCard: {
    border: "1px solid #dbe4ea",
    borderRadius: 28,
    padding: "clamp(20px, 4vw, 28px)",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
    display: "grid",
    gap: 18,
  } as React.CSSProperties,

  heroTitle: {
    margin: 0,
    fontSize: "clamp(30px, 4vw, 40px)",
    lineHeight: 1.02,
    color: "#fff",
  } as React.CSSProperties,

  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  } as React.CSSProperties,

  ghostButton: {
    padding: "10px 14px",
    fontWeight: 900,
    border: "1px solid #d0d9e4",
    borderRadius: 12,
    background: "#fff",
    textDecoration: "none",
    color: brand.colors.primary,
    textAlign: "center",
  } as React.CSSProperties,

  primaryButton: {
    padding: "10px 14px",
    fontWeight: 900,
    border: `1px solid ${brand.colors.primary}`,
    borderRadius: 12,
    background: brand.colors.primary,
    color: "#fff",
  } as React.CSSProperties,

  heroPill: {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid rgba(153, 246, 228, 0.35)",
    background: "rgba(11, 34, 57, 0.28)",
    fontWeight: 900,
    color: "#fff",
  } as React.CSSProperties,

  sectionCard: {
    padding: "clamp(18px, 3vw, 24px)",
    border: "1px solid #dbe4ea",
    borderRadius: 24,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  } as React.CSSProperties,

  metricCard: {
    border: "1px solid #dbe4ea",
    borderRadius: 18,
    padding: 14,
    background: "#fff",
    display: "grid",
    gap: 4,
  } as React.CSSProperties,

  field: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #d0d9e4",
    background: "#fff",
  } as React.CSSProperties,
};
