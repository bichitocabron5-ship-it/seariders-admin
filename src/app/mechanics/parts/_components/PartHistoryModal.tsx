// src/app/mechanics/parts/_components/PartHistoryModal.tsx
"use client";

import { useEffect, useState } from "react";
import type { PartRow } from "./types";
import { ModalShell, ghostBtn, sectionCard } from "./ui";
import {
  eur,
  fmtDateTime,
  movementBadgeStyle,
  movementTypeLabel,
  type HistoryResponse,
} from "./history";

function Kpi({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "#fff",
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75 }}>{title}</div>
      <div style={{ marginTop: 4, fontWeight: 950, fontSize: 20 }}>{value}</div>
    </div>
  );
}

export default function PartHistoryModal({
  part,
  onClose,
}: {
  part: PartRow;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HistoryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/mechanics/parts/${part.id}/movements`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(await res.text());

        const json = (await res.json()) as HistoryResponse;
        if (!cancelled) setData(json);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error cargando historial");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [part.id]);

  return (
    <ModalShell title={`Historial · ${part.name}`} onClose={onClose}>
      {loading ? <div>Cargando historial...</div> : null}

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && data ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <Kpi title="Movimientos" value={data.summary.count} />
            <Kpi title="Entradas" value={data.summary.inQty} />
            <Kpi title="Salidas" value={data.summary.outQty} />
            <Kpi title="Coste acumulado" value={eur(data.summary.totalCostCents)} />
          </div>

          <div style={sectionCard}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "160px 130px 90px 120px 1fr",
                gap: 10,
                paddingBottom: 12,
                fontWeight: 900,
                fontSize: 13,
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div>Fecha</div>
              <div>Tipo</div>
              <div>Cantidad</div>
              <div>Coste</div>
              <div>Detalle</div>
            </div>

            <div style={{ maxHeight: 420, overflow: "auto" }}>
              {data.movements.length === 0 ? (
                <div style={{ padding: 16, opacity: 0.75 }}>
                  Este recambio todavía no tiene movimientos.
                </div>
              ) : (
                data.movements.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px 130px 90px 120px 1fr",
                      gap: 10,
                      padding: "12px 0",
                      fontSize: 13,
                      borderBottom: "1px solid #f1f5f9",
                      alignItems: "start",
                    }}
                  >
                    <div>{fmtDateTime(m.createdAt)}</div>
                    <div>
                      <span style={movementBadgeStyle(m.type)}>
                        {movementTypeLabel(m.type)}
                      </span>
                    </div>
                    <div style={{ fontWeight: 900 }}>{Number(m.qty ?? 0)}</div>
                    <div>{eur(m.totalCostCents ?? m.unitCostCents ?? null)}</div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {m.vendor ? (
                        <div>
                          <b>Proveedor:</b> {m.vendor.name}
                          {m.vendor.code ? ` (${m.vendor.code})` : ""}
                        </div>
                      ) : null}

                      {m.expense ? (
                        <div>
                          <b>Gasto:</b> {m.expense.status} · {eur(m.expense.totalCents)}
                        </div>
                      ) : null}

                      {m.maintenanceEvent ? (
                        <div>
                          <b>Mantenimiento:</b> {m.maintenanceEvent.type}
                          {m.maintenanceEvent.status
                            ? ` · ${m.maintenanceEvent.status}`
                            : ""}
                        </div>
                      ) : null}

                      {m.createdByUser ? (
                        <div>
                          <b>Usuario:</b>{" "}
                          {m.createdByUser.fullName ||
                            m.createdByUser.username ||
                            "—"}
                        </div>
                      ) : null}

                      {m.note ? (
                        <div>
                          <b>Nota:</b> {m.note}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose} style={ghostBtn}>
          Cerrar
        </button>
      </div>
    </ModalShell>
  );
}
