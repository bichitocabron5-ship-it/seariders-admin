"use client";

import type React from "react";

type WorkLog = {
  id: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  breakMinutes: number;
  workedMinutes: number | null;
  area: string;
  status: string;
  note: string | null;
};

type Rate = {
  id: string;
  rateType: string;
  amountCents: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
};

type PayrollEntry = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  amountCents: number;
  concept: string | null;
  note: string | null;
  paidAt: string | null;
};

type EmployeeRow = {
  kind: string;
  internshipHoursTotal: number | null;
  internshipHoursUsed: number | null;
  internshipStartDate: string | null;
  internshipEndDate: string | null;
  workLogs: WorkLog[];
  rates: Rate[];
  payrollEntries: PayrollEntry[];
};

type Summary = {
  internshipRemaining: number | null;
};

export default function EmployeeDetailRecordsSection({
  row,
  summary,
  fmtDate,
  fmtDateTime,
  fmtMinutes,
  eur,
  rateTypeLabel,
  statusBadge,
  cardStyle,
  itemStyle,
  sectionTitle,
  subLineStyle,
}: {
  row: EmployeeRow;
  summary: Summary;
  fmtDate: (iso: string | null) => string;
  fmtDateTime: (iso: string | null) => string;
  fmtMinutes: (value: number | null) => string;
  eur: (cents: number) => string;
  rateTypeLabel: (value: string) => string;
  statusBadge: (text: string) => React.CSSProperties;
  cardStyle: React.CSSProperties;
  itemStyle: React.CSSProperties;
  sectionTitle: React.CSSProperties;
  subLineStyle: React.CSSProperties;
}) {
  const isIntern = row.kind === "INTERN";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        gap: 16,
        alignItems: "start",
      }}
    >
      <section style={cardStyle}>
        <div style={sectionTitle}>Últimos fichajes</div>

        {row.workLogs.length === 0 ? (
          <div style={{ opacity: 0.72 }}>Sin fichajes todavía.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {row.workLogs.map((log) => (
              <div key={log.id} style={itemStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>
                    {fmtDate(log.workDate)} · {log.area}
                  </div>
                  <div style={statusBadge(log.status)}>{log.status}</div>
                </div>

                <div style={subLineStyle}>
                  Entrada: <b>{fmtDateTime(log.checkInAt)}</b>
                  {" · "}Salida: <b>{fmtDateTime(log.checkOutAt)}</b>
                </div>

                <div style={subLineStyle}>
                  Descanso: <b>{log.breakMinutes} min</b>
                  {" · "}Trabajado: <b>{fmtMinutes(log.workedMinutes)}</b>
                </div>

                {log.note ? <div style={{ marginTop: 6, fontSize: 12 }}>{log.note}</div> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "grid", gap: 16 }}>
        {isIntern ? (
          <section style={cardStyle}>
            <div style={sectionTitle}>Resumen de prácticas</div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={itemStyle}>
                <div style={{ fontWeight: 900 }}>Bolsa de horas</div>
                <div style={subLineStyle}>
                  Total: <b>{row.internshipHoursTotal ?? "—"}</b>
                  {" · "}Usadas: <b>{row.internshipHoursUsed ?? 0}</b>
                  {" · "}Restantes: <b>{summary.internshipRemaining ?? "—"}</b>
                </div>
              </div>

              <div style={itemStyle}>
                <div style={{ fontWeight: 900 }}>Periodo de prácticas</div>
                <div style={subLineStyle}>
                  Inicio: <b>{fmtDate(row.internshipStartDate)}</b>
                  {" · "}Fin: <b>{fmtDate(row.internshipEndDate)}</b>
                </div>
              </div>

              <div
                style={{
                  ...itemStyle,
                  border:
                    summary.internshipRemaining !== null && summary.internshipRemaining <= 20
                      ? "1px solid #fde68a"
                      : "1px solid #eee",
                  background:
                    summary.internshipRemaining !== null && summary.internshipRemaining <= 20 ? "#fffbeb" : "#fafafa",
                }}
              >
                <div style={{ fontWeight: 900 }}>Estado de la bolsa</div>
                <div style={subLineStyle}>
                  {summary.internshipRemaining === null
                    ? "Bolsa sin definir"
                    : summary.internshipRemaining <= 0
                      ? "Bolsa agotada"
                      : summary.internshipRemaining <= 20
                        ? "Quedan pocas horas"
                        : "Bolsa correcta"}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section style={cardStyle}>
              <div style={sectionTitle}>Tarifas</div>

              {row.rates.length === 0 ? (
                <div style={{ opacity: 0.72 }}>Sin tarifas registradas.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {row.rates.map((rate) => (
                    <div key={rate.id} style={itemStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{rateTypeLabel(rate.rateType)}</div>
                        <div style={{ fontWeight: 950 }}>{eur(rate.amountCents)}</div>
                      </div>

                      <div style={subLineStyle}>
                        Desde: <b>{fmtDate(rate.effectiveFrom)}</b>
                        {" · "}Hasta: <b>{fmtDate(rate.effectiveTo)}</b>
                      </div>

                      {rate.note ? <div style={{ marginTop: 6, fontSize: 12 }}>{rate.note}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={cardStyle}>
              <div style={sectionTitle}>Pagos</div>

              {row.payrollEntries.length === 0 ? (
                <div style={{ opacity: 0.72 }}>Sin pagos registrados.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {row.payrollEntries.map((entry) => (
                    <div key={entry.id} style={itemStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900 }}>
                          {fmtDate(entry.periodStart)} → {fmtDate(entry.periodEnd)}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={statusBadge(entry.status)}>{entry.status}</div>
                          <div style={{ fontWeight: 950 }}>{eur(entry.amountCents)}</div>
                        </div>
                      </div>

                      <div style={subLineStyle}>
                        Pagado el: <b>{fmtDate(entry.paidAt)}</b>
                      </div>

                      {entry.concept ? <div style={{ marginTop: 6, fontSize: 12 }}>Concepto: {entry.concept}</div> : null}
                      {entry.note ? <div style={{ marginTop: 4, fontSize: 12 }}>Nota: {entry.note}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
