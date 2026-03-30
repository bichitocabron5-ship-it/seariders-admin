"use client";

import type { CSSProperties } from "react";

type PayrollStatus = "DRAFT" | "PENDING" | "PAID" | "CANCELED";

type PayrollRow = {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollStatus;
  amountCents: number;
  concept: string | null;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: string;
    code: string | null;
    fullName: string;
    kind: string;
    jobTitle: string | null;
  };
  createdByUserId: string | null;
  createdByUser: {
    id: string;
    username: string | null;
    fullName: string | null;
  } | null;
};

type Props = {
  rows: PayrollRow[];
  onSelect: (row: PayrollRow) => void;
  formatEur: (cents: number) => string;
  formatDateSafe: (iso: string | null) => string;
  statusStyle: (status: PayrollStatus) => CSSProperties;
};

export function PayrollListSection({
  rows,
  onSelect,
  formatEur,
  formatDateSafe,
  statusStyle,
}: Props) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row) => (
        <button key={row.id} type="button" onClick={() => onSelect(row)} style={cardButtonStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <a
                href={`/hr/employees/${row.employee.id}`}
                style={employeeLinkStyle}
                onClick={(event) => event.stopPropagation()}
              >
                {row.employee.fullName}
              </a>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {row.employee.kind}
                {row.employee.jobTitle ? ` · ${row.employee.jobTitle}` : ""}
                {row.employee.code ? ` · ${row.employee.code}` : ""}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={statusStyle(row.status)}>{row.status}</div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>{formatEur(row.amountCents)}</div>
            </div>
          </div>

          <div style={metaGridStyle}>
            <Mini label="Periodo desde" value={formatDateSafe(row.periodStart)} />
            <Mini label="Periodo hasta" value={formatDateSafe(row.periodEnd)} />
            <Mini label="Pagado el" value={formatDateSafe(row.paidAt)} />
            <Mini label="Creado" value={formatDateSafe(row.createdAt)} />
          </div>

          {row.concept ? <div style={infoLineStyle}>Concepto: {row.concept}</div> : null}
          {row.note ? <div style={{ ...infoLineStyle, marginTop: 6 }}>Nota: {row.note}</div> : null}
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

const cardButtonStyle: CSSProperties = {
  textAlign: "left",
  border: "1px solid #eee",
  background: "#fff",
  borderRadius: 16,
  padding: 14,
  cursor: "pointer",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const employeeLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "#111",
  fontWeight: 950,
  fontSize: 18,
};

const metaGridStyle: CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const infoLineStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  opacity: 0.9,
};
