"use client";

import type React from "react";

import type { RateRow } from "../types";

export function HrRatesListSection({
  rows,
  onEdit,
  eur,
  fmtDate,
  rateTypeLabel,
  emptyBox,
}: {
  rows: RateRow[];
  onEdit: (row: RateRow) => void;
  eur: (cents: number) => string;
  fmtDate: (iso: string | null) => string;
  rateTypeLabel: (value: RateRow["rateType"]) => string;
  emptyBox: React.CSSProperties;
}) {
  if (rows.length === 0) {
    return <div style={emptyBox}>No hay tarifas para los filtros seleccionados.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onEdit(row)}
          style={{
            textAlign: "left",
            border: "1px solid #eee",
            background: "#fff",
            borderRadius: 16,
            padding: 14,
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <a
                href={`/hr/employees/${row.employee.id}`}
                style={{ textDecoration: "none", color: "#111", fontWeight: 950, fontSize: 18 }}
                onClick={(e) => e.stopPropagation()}
              >
                {row.employee.fullName}
              </a>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {row.employee.kind}
                {row.employee.jobTitle ? ` · ${row.employee.jobTitle}` : ""}
                {row.employee.code ? ` · ${row.employee.code}` : ""}
              </div>
            </div>

            <div style={{ fontWeight: 950, fontSize: 18 }}>{eur(row.amountCents)}</div>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            <Mini label="Tipo" value={rateTypeLabel(row.rateType)} />
            <Mini label="Vigente desde" value={fmtDate(row.effectiveFrom)} />
            <Mini label="Hasta" value={fmtDate(row.effectiveTo)} />
            <Mini label="Creado" value={fmtDate(row.createdAt)} />
          </div>

          {row.note ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Nota: {row.note}</div> : null}
        </button>
      ))}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.72 }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 900 }}>{value}</div>
    </div>
  );
}
