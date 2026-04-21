"use client";

type Row = {
  id: string;
  origin: "STORE" | "BOOTH" | "BAR";
  shift: string;
  businessDate: string;
  closedAt: string;
  windowFrom: string;
  windowTo: string;
  isVoided: boolean;
  note?: string | null;
  voidReason?: string | null;
  reviewedAt?: string | null;
  users?: Array<{
    user?: { id?: string; fullName?: string | null; username?: string | null } | null;
    roleNameAtClose?: string | null;
  }>;
  declaredJson?: {
    service?: Record<string, number>;
    deposit?: Record<string, number>;
    total?: Record<string, number>;
  };
  computedJson?: {
    meta?: {
      cashFundCents?: number;
      cashToKeepCents?: number;
      cashToWithdrawCents?: number;
    };
  };
  systemJson?: {
    service?: Record<string, number>;
    deposit?: Record<string, number>;
    total?: Record<string, number>;
  };
  diffJson?: {
    service?: Record<string, number>;
    deposit?: Record<string, number>;
    total?: Record<string, number>;
  };
  depositSummary?: {
    returnedCents: number;
    retainedNetCents: number;
    retainedCount: number;
    partialRetentions: number;
  };
};

type VoidableClosure = Pick<Row, "id" | "origin" | "shift" | "businessDate" | "closedAt" | "reviewedAt">;

type CommissionsSummary = {
  ok: boolean;
  totalCommissionCents?: number;
  totalCompanyCommissionCents?: number;
  totalChannelCommissionCostCents?: number;
  rows?: Array<{
    channelId: string;
    name: string;
    kind?: "STANDARD" | "EXTERNAL_ACTIVITY" | null;
    reservations: number;
    baseServiceCents: number;
    baseDepositCents: number;
    baseTotalCents: number;
    commissionCents: number;
    effectivePct?: number;
    companyCommissionCents?: number;
    channelCommissionCostCents?: number;
  }>;
};

type Props = {
  panelStyle: React.CSSProperties;
  detailStatStyle: React.CSSProperties;
  detailStatLabel: React.CSSProperties;
  detailStatValue: React.CSSProperties;
  lightBtn: React.CSSProperties;
  selected: Row | null;
  comm: CommissionsSummary | null;
  commLoading: boolean;
  yyyyMmDd: (iso: string) => string;
  euros: (cents: number) => string;
  netFrom: (obj?: Record<string, number>) => number;
  onVoid: (closure: VoidableClosure) => void;
};

function scopeLabel(row: Row) {
  return row.origin === "BOOTH" ? row.shift : "DIARIO";
}

export default function CashClosureDetailSection({
  panelStyle,
  detailStatStyle,
  detailStatLabel,
  detailStatValue,
  lightBtn,
  selected,
  comm,
  commLoading,
  yyyyMmDd,
  euros,
  netFrom,
  onVoid,
}: Props) {
  const showDepositBlocks = selected?.origin !== "BOOTH";
  const diffNet = selected ? netFrom(selected.diffJson?.total) : 0;
  const diffLabel = diffNet === 0 ? "Cuadra" : diffNet > 0 ? "Sobra declarado" : "Falta declarado";

  const breakdownRows = selected
    ? [
        { label: "Declarado · Servicio", obj: selected.declaredJson?.service },
        ...(showDepositBlocks ? [{ label: "Declarado · Fianza", obj: selected.declaredJson?.deposit }] : []),
        { label: "Declarado · Total", obj: selected.declaredJson?.total },
        { label: "Sistema · Servicio", obj: selected.systemJson?.service },
        ...(showDepositBlocks ? [{ label: "Sistema · Fianza", obj: selected.systemJson?.deposit }] : []),
        { label: "Sistema · Total", obj: selected.systemJson?.total },
        { label: "Dif · Servicio", obj: selected.diffJson?.service },
        ...(showDepositBlocks ? [{ label: "Dif · Fianza", obj: selected.diffJson?.deposit }] : []),
        { label: "Dif · Total", obj: selected.diffJson?.total },
      ]
    : [];

  return (
    <div style={panelStyle}>
      <div style={{ padding: "10px 12px", background: "#f9fafb", fontWeight: 900, fontSize: 13 }}>Detalle</div>

      {!selected ? (
        <div style={{ padding: 12, opacity: 0.7 }}>Selecciona un cierre.</div>
      ) : (
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 900,
                    background: selected.isVoided ? "#fee2e2" : "#ecfeff",
                    color: selected.isVoided ? "#991b1b" : "#155e75",
                    border: `1px solid ${selected.isVoided ? "#fecaca" : "#bae6fd"}`,
                  }}
                >
                  {selected.origin}
                </span>
                {selected.origin} · {scopeLabel(selected)} · {yyyyMmDd(selected.businessDate)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Ventana auditada: {new Date(selected.windowFrom).toLocaleTimeString()}-{new Date(selected.windowTo).toLocaleTimeString()}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Estado: {selected.isVoided ? "ANULADO / REABIERTO" : "ACTIVO"}
                {selected.isVoided ? ` · Motivo: ${selected.voidReason ?? "-"}` : ""}
              </div>
            </div>

            {!selected.isVoided ? (
              <button onClick={() => onVoid(selected)} style={lightBtn}>
                Reabrir cierre
              </button>
            ) : null}
          </div>

          {!selected.isVoided ? (
            <div
              style={{
                border: "1px solid #fde68a",
                borderRadius: 16,
                padding: 14,
                background: "#fffbeb",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 900, color: "#92400e" }}>Reapertura controlada</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "#78350f" }}>
                Reabrir no borra este cierre: lo anula como cierre activo, desbloquea la operativa y obliga a generar un nuevo cierre correcto al terminar la corrección.
              </div>
              <div style={{ fontSize: 12, color: "#92400e" }}>
                Úsalo solo para incidencias reales: cobro tardío, devolución posterior o error de conteo.
              </div>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <div style={detailStatStyle}>
              <div style={detailStatLabel}>Declarado neto</div>
              <div style={detailStatValue}>{euros(netFrom(selected.declaredJson?.total))}</div>
            </div>
            <div style={detailStatStyle}>
              <div style={detailStatLabel}>Sistema neto</div>
              <div style={detailStatValue}>{euros(netFrom(selected.systemJson?.total))}</div>
            </div>
            <div
              style={{
                ...detailStatStyle,
                background:
                  diffNet === 0
                    ? "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)"
                    : diffNet > 0
                      ? "linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)"
                      : "linear-gradient(180deg, #fff1f2 0%, #ffe4e6 100%)",
              }}
            >
              <div style={detailStatLabel}>Diferencia neta</div>
              <div style={detailStatValue}>{euros(diffNet)}</div>
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#475569" }}>{diffLabel}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <div style={detailStatStyle}>
              <div style={detailStatLabel}>Fondo de caja</div>
              <div style={detailStatValue}>{euros(selected.computedJson?.meta?.cashFundCents ?? 0)}</div>
            </div>
            <div style={detailStatStyle}>
              <div style={detailStatLabel}>Efectivo a dejar</div>
              <div style={detailStatValue}>{euros(selected.computedJson?.meta?.cashToKeepCents ?? 0)}</div>
            </div>
            <div style={detailStatStyle}>
              <div style={detailStatLabel}>Efectivo a retirar</div>
              <div style={detailStatValue}>{euros(selected.computedJson?.meta?.cashToWithdrawCents ?? 0)}</div>
            </div>
          </div>

          {showDepositBlocks ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              <div style={detailStatStyle}>
                <div style={detailStatLabel}>Fianza devuelta</div>
                <div style={detailStatValue}>{euros(selected.depositSummary?.returnedCents ?? 0)}</div>
              </div>
              <div style={detailStatStyle}>
                <div style={detailStatLabel}>Retenido neto</div>
                <div style={detailStatValue}>{euros(selected.depositSummary?.retainedNetCents ?? 0)}</div>
              </div>
              <div style={detailStatStyle}>
                <div style={detailStatLabel}>Retenciones</div>
                <div style={detailStatValue}>{selected.depositSummary?.retainedCount ?? 0}</div>
              </div>
              <div style={detailStatStyle}>
                <div style={detailStatLabel}>Retenciones parciales</div>
                <div style={detailStatValue}>{selected.depositSummary?.partialRetentions ?? 0}</div>
              </div>
            </div>
          ) : null}

          {selected.note ? (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, background: "#fff" }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Nota operativa del cierre</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "#475569" }}>{selected.note}</div>
            </div>
          ) : null}

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, background: "#fff" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Participantes del cierre</div>
            {!selected.users || selected.users.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.7 }}>Este cierre no tiene participantes guardados.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {selected.users.map((entry, index) => (
                  <div
                    key={`${entry.user?.id ?? "user"}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {entry.user?.fullName ?? entry.user?.username ?? entry.user?.id ?? "Usuario"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{entry.roleNameAtClose ?? "-"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              border: "1px solid #e2e8f0",
              borderRadius: 18,
              padding: 14,
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Desglose por método</div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Bloque</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>CASH</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>CARD</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>BIZUM</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>TRANSFER</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>VOUCHER</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>NETO</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row, index) => {
                    const cash = Number(row.obj?.CASH ?? 0);
                    const card = Number(row.obj?.CARD ?? 0);
                    const biz = Number(row.obj?.BIZUM ?? 0);
                    const transfer = Number(row.obj?.TRANSFER ?? 0);
                    const voucher = Number(row.obj?.VOUCHER ?? 0);
                    const net = cash + card + biz + transfer + voucher;

                    return (
                      <tr key={index}>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", fontWeight: 800 }}>{row.label}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(cash)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(card)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(biz)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(transfer)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(voucher)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right", fontWeight: 900 }}>{euros(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {showDepositBlocks ? (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Fianza devuelta = salidas de depósito registradas en la ventana. Retenido neto = saldo de depósito que quedó bloqueado en reservas retenidas durante ese cierre.
              </div>
            ) : null}
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, background: "#fff" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Comisiones por canal</div>

            {commLoading ? (
              <div style={{ opacity: 0.7 }}>Cargando...</div>
            ) : !comm ? (
              <div style={{ opacity: 0.7 }}>Sin datos de comisiones o sin canales configurados.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>Total comisiones estimado</div>
                  <div style={{ fontWeight: 900 }}>{euros(comm.totalCommissionCents ?? 0)}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>Comisión empresa</div>
                  <div style={{ fontWeight: 900 }}>{euros(comm.totalCompanyCommissionCents ?? 0)}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>Coste canal</div>
                  <div style={{ fontWeight: 900 }}>{euros(comm.totalChannelCommissionCostCents ?? 0)}</div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Canal</th>
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Reservas</th>
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Base servicio</th>
                        {showDepositBlocks ? (
                          <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Base fianza</th>
                        ) : null}
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Base total</th>
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>% efectivo</th>
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Comisión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(comm.rows ?? []).map((row) => (
                        <tr key={row.channelId}>
                          <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", fontWeight: 800 }}>{row.name}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{row.reservations}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(row.baseServiceCents)}</td>
                          {showDepositBlocks ? (
                            <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(row.baseDepositCents)}</td>
                          ) : null}
                          <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right", fontWeight: 800 }}>{euros(row.baseTotalCents)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{Number(row.effectivePct ?? 0).toFixed(2)}%</td>
                          <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right", fontWeight: 900 }}>{euros(row.commissionCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {showDepositBlocks
                    ? "Base calculada con pagos netos del cierre (IN-OUT). Si el canal marca comisión sobre fianza, se incluye."
                    : "Base calculada con pagos netos del cierre (IN-OUT), solo sobre servicio."}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            Nota: `Dif` = declarado - sistema. En operación normal, el primer método a revisar suele ser `CASH`.
          </div>
        </div>
      )}
    </div>
  );
}
