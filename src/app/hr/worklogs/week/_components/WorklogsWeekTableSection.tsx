"use client";

import Link from "next/link";
import { opsStyles } from "@/components/ops-ui";

type EmployeeRow = {
  employee: {
    id: string;
    code: string | null;
    fullName: string;
    kind: string;
  };
  totalMinutes: number;
  totalLogs: number;
  perDay: Array<{
    ymd: string;
    date: string;
    workedMinutes: number;
    logs: number;
    openLogs: number;
    approvedLogs: number;
    statuses: string[];
    areas: string[];
  }>;
};

type TotalsRow = {
  ymd: string;
  date: string;
  totalMinutes: number;
  totalLogs: number;
  openLogs: number;
  approvedLogs: number;
};

type Props = {
  employees: EmployeeRow[];
  weekDays: Array<{ ymd: string; date: string }>;
  totalsByDay: TotalsRow[];
  weekMinutes: number;
  weekLogs: number;
  fmtMinutes: (total: number | null) => string;
  fmtDayShort: (iso: string) => string;
  employeeKindLabel: (kind: string) => string;
};

const softCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  borderRadius: 20,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const thLeft: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderBottom: "1px solid #e5e7eb",
  background: "#f8fafc",
  fontSize: 13,
};

const thCenter: React.CSSProperties = {
  textAlign: "center",
  padding: 12,
  borderBottom: "1px solid #e5e7eb",
  background: "#f8fafc",
  fontSize: 13,
};

const tdLeft: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
};

const tdCenter: React.CSSProperties = {
  textAlign: "center",
  padding: 12,
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
};

const tfLeft: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  background: "#f8fafc",
  borderTop: "1px solid #e5e7eb",
  fontWeight: 950,
};

const tfCenter: React.CSSProperties = {
  textAlign: "center",
  padding: 12,
  background: "#f8fafc",
  borderTop: "1px solid #e5e7eb",
};

export default function WorklogsWeekTableSection({
  employees,
  weekDays,
  totalsByDay,
  weekMinutes,
  weekLogs,
  fmtMinutes,
  fmtDayShort,
  employeeKindLabel,
}: Props) {
  return (
    <div style={{ ...softCard, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
        <thead>
          <tr>
            <th style={thLeft}>Trabajador</th>
            {weekDays.map((day) => (
              <th key={day.ymd} style={thCenter}>{fmtDayShort(day.date)}</th>
            ))}
            <th style={thCenter}>Total</th>
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: 18, textAlign: "center", opacity: 0.72 }}>
                Sin datos para esta semana.
              </td>
            </tr>
          ) : (
            employees.map((row) => (
              <tr key={row.employee.id}>
                <td style={tdLeft}>
                  <Link href={`/hr/employees/${row.employee.id}`} style={{ textDecoration: "none", color: "#111", fontWeight: 900 }}>
                    {row.employee.fullName}
                  </Link>
                  <div style={{ fontSize: 12, opacity: 0.72 }}>
                    {row.employee.code ?? "—"} · {employeeKindLabel(row.employee.kind)}
                  </div>
                </td>
                {row.perDay.map((day) => {
                  const hasOpen = day.openLogs > 0;
                  const hasLogs = day.logs > 0;
                  return (
                    <td key={day.ymd} style={{ ...tdCenter, background: hasOpen ? "#fffbeb" : "#fff" }}>
                      <div style={{ fontWeight: 900 }}>{hasLogs ? fmtMinutes(day.workedMinutes) : "—"}</div>
                      {hasLogs ? (
                        <div style={{ fontSize: 11, opacity: 0.72 }}>
                          {day.logs} reg.{day.openLogs > 0 ? ` · ${day.openLogs} abiertas` : ""}
                        </div>
                      ) : null}
                    </td>
                  );
                })}
                <td style={{ ...tdCenter, fontWeight: 950 }}>
                  {fmtMinutes(row.totalMinutes)}
                  <div style={{ fontSize: 11, opacity: 0.72 }}>{row.totalLogs} reg.</div>
                </td>
              </tr>
            ))
          )}
        </tbody>
        {totalsByDay.length > 0 ? (
          <tfoot>
            <tr>
              <td style={tfLeft}>Total día</td>
              {totalsByDay.map((day) => (
                <td key={day.ymd} style={tfCenter}>
                  <div style={{ fontWeight: 950 }}>{fmtMinutes(day.totalMinutes)}</div>
                  <div style={{ fontSize: 11, opacity: 0.72 }}>
                    {day.totalLogs} reg.{day.openLogs > 0 ? ` · ${day.openLogs} abiertas` : ""}
                  </div>
                </td>
              ))}
              <td style={tfCenter}>
                <div style={{ fontWeight: 950 }}>{fmtMinutes(weekMinutes)}</div>
                <div style={{ fontSize: 11, opacity: 0.72 }}>{weekLogs} reg.</div>
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
