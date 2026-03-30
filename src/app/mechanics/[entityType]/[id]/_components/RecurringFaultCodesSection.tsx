"use client";

import { eurFromCents } from "@/lib/mechanics-format";

type RecurringFaultRow = {
  code: string;
  count: number;
  lastSeenAt: string | null;
  totalCostCents: number;
  totalPartsCostCents: number;
};

type FaultCodeCatalogRow = {
  code: string;
  system: string | null;
  titleEs: string;
  descriptionEs: string | null;
  severityHint: string | null;
};

type Props = {
  loading: boolean;
  recurringFaults: RecurringFaultRow[];
  recurringFaultCatalog: Record<string, FaultCodeCatalogRow>;
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function RecurringFaultCodesSection({
  loading,
  recurringFaults,
  recurringFaultCatalog,
}: Props) {
  return (
    <div
      style={{
        border: "1px solid #dbe4ea",
        borderRadius: 20,
        background: "white",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 20 }}>Códigos de avería recurrentes</div>

      {loading ? (
        <div style={{ opacity: 0.72 }}>Cargando catálogo de códigos de avería...</div>
      ) : recurringFaults.length === 0 ? (
        <div style={{ opacity: 0.72 }}>No hay códigos de avería repetidos registrados.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {recurringFaults.map((fault) => {
            const catalog = recurringFaultCatalog[fault.code.toUpperCase()] ?? null;

            return (
              <div
                key={fault.code}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafa",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>{fault.code}</div>

                  {catalog?.system ? (
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {catalog.system}
                    </div>
                  ) : null}

                  {catalog?.severityHint ? (
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      Severidad sugerida: {catalog.severityHint}
                    </div>
                  ) : null}
                </div>

                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  {catalog?.titleEs ?? "Código sin descripción en catálogo"}
                </div>

                {catalog?.descriptionEs ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>{catalog.descriptionEs}</div>
                ) : null}

                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  <b>{fault.count}</b> vez/veces · última vez: {fmtDateTime(fault.lastSeenAt)}
                </div>

                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Coste acumulado: {eurFromCents(fault.totalCostCents)} Coste piezas:{" "}
                  {eurFromCents(fault.totalPartsCostCents)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
