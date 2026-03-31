"use client";

import type React from "react";

type EmployeeRow = {
  fullName: string;
  email: string | null;
  phone: string | null;
  kind: string;
  jobTitle: string | null;
  isActive: boolean;
  note: string | null;
  code: string | null;
  hireDate: string | null;
  terminationDate: string | null;
  internshipHoursTotal: number | null;
  internshipHoursUsed: number | null;
  internshipStartDate: string | null;
  internshipEndDate: string | null;
  user: {
    username: string;
    fullName: string | null;
  } | null;
  workLogs: Array<unknown>;
  rates: Array<unknown>;
};

type Summary = {
  workedMinutesTotal: number;
  payrollTotalCents: number;
  internshipRemaining: number | null;
};

export default function EmployeeDetailOverviewSection({
  row,
  summary,
  employeeKindLabel,
  fmtDate,
  fmtMinutes,
  eur,
  statusBadge,
}: {
  row: EmployeeRow;
  summary: Summary;
  employeeKindLabel: (kind: string) => string;
  fmtDate: (iso: string | null) => string;
  fmtMinutes: (value: number | null) => string;
  eur: (cents: number) => string;
  statusBadge: (text: string) => React.CSSProperties;
}) {
  const isIntern = row.kind === "INTERN";

  return (
    <>
      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "#fff",
          borderRadius: 18,
          padding: 16,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 24 }}>{row.fullName}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {employeeKindLabel(row.kind)}
              {row.jobTitle ? ` · ${row.jobTitle}` : ""}
              {row.code ? ` · ${row.code}` : ""}
            </div>
          </div>

          <div style={statusBadge(row.isActive ? "ACTIVE" : "CANCELED")}>{row.isActive ? "Activo" : "Inactivo"}</div>
        </div>

        <div style={{ fontSize: 13, opacity: 0.9 }}>
          Email: <b>{row.email ?? "—"}</b>
          {" · "}Teléfono: <b>{row.phone ?? "—"}</b>
          {" · "}Alta: <b>{fmtDate(row.hireDate)}</b>
          {" · "}Baja: <b>{fmtDate(row.terminationDate)}</b>
        </div>

        <div style={{ fontSize: 13, opacity: 0.9 }}>
          Usuario vinculado:{" "}
          <b>{row.user ? `${row.user.username}${row.user.fullName ? ` · ${row.user.fullName}` : ""}` : "No vinculado"}</b>
        </div>

        {row.note ? <div style={{ fontSize: 13, opacity: 0.9 }}>Nota: {row.note}</div> : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {isIntern ? (
          <>
            <Kpi title="Horas registradas" value={fmtMinutes(summary.workedMinutesTotal)} warning />
            <Kpi title="Bolsa total" value={row.internshipHoursTotal ?? "—"} warning />
            <Kpi title="Bolsa usada" value={row.internshipHoursUsed ?? 0} warning />
            <Kpi title="Bolsa restante" value={summary.internshipRemaining ?? "—"} warning />
          </>
        ) : (
          <>
            <Kpi title="Horas registradas" value={fmtMinutes(summary.workedMinutesTotal)} />
            <Kpi title="Pagado acumulado" value={eur(summary.payrollTotalCents)} />
            <Kpi title="Fichajes recientes" value={row.workLogs.length} />
            <Kpi title="Tarifas" value={row.rates.length} />
          </>
        )}
      </div>

      {isIntern ? (
        <div
          style={{
            border: "1px solid #fde68a",
            background: "#fffbeb",
            borderRadius: 18,
            padding: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 20, color: "#92400e" }}>Bolsa de horas · Prácticas</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <Kpi title="Horas totales" value={row.internshipHoursTotal ?? "—"} warning />
            <Kpi title="Horas usadas" value={row.internshipHoursUsed ?? 0} warning />
            <Kpi title="Horas restantes" value={summary.internshipRemaining ?? "—"} warning />
            <Kpi title="Inicio prácticas" value={fmtDate(row.internshipStartDate)} warning />
            <Kpi title="Fin prácticas" value={fmtDate(row.internshipEndDate)} warning />
          </div>
        </div>
      ) : null}
    </>
  );
}

function Kpi({
  title,
  value,
  warning,
}: {
  title: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div
      style={{
        border: warning ? "1px solid #fde68a" : "1px solid #e5e7eb",
        background: warning ? "#fffbeb" : "#fff",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>{title}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 26,
          fontWeight: 950,
          color: warning ? "#92400e" : "#111",
        }}
      >
        {value}
      </div>
    </div>
  );
}
