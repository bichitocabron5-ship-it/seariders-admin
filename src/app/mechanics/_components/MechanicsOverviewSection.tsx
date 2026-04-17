"use client";

import { fmtHours, isNegativeNumber } from "@/lib/mechanics-format";

type AlertRow = {
  id: string;
  label: string;
  currentHours: number | null;
  dueAt: number;
  hoursLeft: number | null;
};

export default function MechanicsOverviewSection({
  urgentCount,
  warnCount,
  jetskiCount,
  assetCount,
  openEventsCount,
  inProgressEventsCount,
  externalEventsCount,
  dueRows,
  warnRows,
}: {
  urgentCount: number;
  warnCount: number;
  jetskiCount: number;
  assetCount: number;
  openEventsCount: number;
  inProgressEventsCount: number;
  externalEventsCount: number;
  dueRows: AlertRow[];
  warnRows: AlertRow[];
}) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      {(dueRows.length || warnRows.length) ? (
        <section
          style={{
            border: "1px solid #dbe4ea",
            borderRadius: 20,
            background: "#fff",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 22 }}>Alertas de mecánica</div>

          {dueRows.length ? (
            <div style={{ border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 16, padding: 14 }}>
              <div style={{ fontWeight: 950, color: "#b91c1c", marginBottom: 8 }}>DUE · Revisión vencida</div>
              <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                {dueRows.map((row) => (
                  <div key={row.id}>
                    {row.label} · horas actuales: <b>{fmtHours(row.currentHours)}</b> · próxima revisión: <b>{fmtHours(row.dueAt)}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {warnRows.length ? (
            <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 14 }}>
              <div style={{ fontWeight: 950, color: "#92400e", marginBottom: 8 }}>WARN · Próximas revisiones</div>
              <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                {warnRows.map((row) => (
                  <div key={row.id}>
                    {row.label} · restan{" "}
                    <b style={{ color: isNegativeNumber(row.hoursLeft) ? "#b91c1c" : undefined }}>
                      {fmtHours(row.hoursLeft)}
                    </b>{" "}
                    horas
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section
        style={{
          border: "1px solid #dbe4ea",
          borderRadius: 20,
          background: "#fff",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>DUE · revisión vencida</div>
            <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#7f1d1d" }}>{urgentCount}</div>
          </div>

          <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#92400e" }}>WARN · próximas revisiones</div>
            <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#78350f" }}>{warnCount}</div>
          </div>

          <div style={{ border: "1px solid #d0d9e4", background: "#fff", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Total jetskis</div>
            <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950 }}>{jetskiCount}</div>
          </div>

          <div style={{ border: "1px solid #d0d9e4", background: "#fff", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Total assets</div>
            <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950 }}>{assetCount}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>Eventos abiertos</div>
            <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#7f1d1d" }}>{openEventsCount}</div>
          </div>

          <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#92400e" }}>Eventos en curso</div>
            <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#78350f" }}>{inProgressEventsCount}</div>
          </div>

          <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8" }}>Eventos externos</div>
            <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#1e3a8a" }}>{externalEventsCount}</div>
          </div>
        </div>

        {(urgentCount > 0 || warnCount > 0) ? (
          <div style={{ display: "grid", gap: 10 }}>
            {urgentCount > 0 ? (
              <div style={{ border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 16, padding: 14 }}>
                <div style={{ fontWeight: 950, color: "#b91c1c", marginBottom: 8 }}>Atención inmediata</div>
                <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  {dueRows.map((row) => (
                    <div key={row.id}>
                      {row.label} · actuales <b>{fmtHours(row.currentHours)}</b> · revisión <b>{fmtHours(row.dueAt)}</b>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {warnCount > 0 ? (
              <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 14 }}>
                <div style={{ fontWeight: 950, color: "#92400e", marginBottom: 8 }}>Próximas revisiones</div>
                <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  {warnRows.map((row) => (
                    <div key={row.id}>
                      {row.label} · restan{" "}
                      <b style={{ color: isNegativeNumber(row.hoursLeft) ? "#b91c1c" : undefined }}>
                        {fmtHours(row.hoursLeft)}
                      </b>{" "}
                      h
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </section>
  );
}
