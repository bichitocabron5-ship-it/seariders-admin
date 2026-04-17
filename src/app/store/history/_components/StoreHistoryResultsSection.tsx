"use client";

import { Alert, Card, Pill, styles } from "@/components/ui";
import type { CSSProperties } from "react";

type HistoryIncident = {
  id: string;
  type: string;
  level: string;
  status: string;
  isOpen: boolean;
  retainDeposit: boolean;
  retainDepositCents: number | null;
  description: string | null;
  notes: string | null;
  maintenanceEventId: string | null;
  createdAt: string;
  entityType: string | null;
  jetskiId: string | null;
  assetId: string | null;
};

type ManualContractAttachment = {
  id: string;
  fileKey: string | null;
  fileUrl: string | null;
  fileName: string | null;
  uploadedAt: string | null;
};

type HistoryRow = {
  id: string;
  status: string;
  storeFlowStage: string | null;
  activityDate: string;
  scheduledTime: string | null;
  arrivalAt: string | null;
  customerName: string | null;
  customerCountry: string | null;
  quantity: number | null;
  pax: number | null;
  isLicense: boolean | null;
  totalPriceCents: number | null;
  depositCents: number | null;
  depositHeld: boolean;
  depositHoldReason: string | null;
  isManualEntry: boolean;
  manualEntryNote: string | null;
  manualContractAttachments: ManualContractAttachment[];
  financialAdjustmentNote: string | null;
  financialAdjustedAt: string | null;
  source: string | null;
  formalizedAt: string | null;
  channelName: string | null;
  serviceName: string | null;
  serviceCategory: string | null;
  durationMinutes: number | null;
  paidCents: number;
  paidDepositCents: number;
  depositCollectedCents: number;
  depositReturnedCents: number;
  depositRetainedCents: number;
  totalToChargeCents: number;
  incidents: HistoryIncident[];
};

type Tone = { bg: string; border: string; color: string };

type Props = {
  rows: HistoryRow[];
  loading: boolean;
  error: string | null;
  euros: (cents: number | null | undefined) => string;
  dt: (value: string | null | undefined) => string;
  statusTone: (status: string | null | undefined) => Tone;
  incidentTone: (level: string) => Tone;
  countPaidServiceCents: (row: HistoryRow) => number;
  countPendingServiceCents: (row: HistoryRow) => number;
  statusLabel: (status: string | null | undefined) => string;
  mechanicsDetailHref: (incident: HistoryIncident) => string;
  mechanicsEventHref: (incident: HistoryIncident) => string;
  reservationHref: (reservationId: string) => string;
  cell: CSSProperties;
  mutedText: CSSProperties;
  mutedStack: CSSProperties;
  detailBlock: CSSProperties;
  badgeBase: CSSProperties;
  moneyValue: CSSProperties;
  incidentCard: CSSProperties;
  incidentSummary: CSSProperties;
  actionLink: CSSProperties;
  emptyState: CSSProperties;
  onAdjustFinancials: (row: HistoryRow) => void;
  onUploadManualContract: (row: HistoryRow, files: File[]) => void | Promise<void>;
  onDownloadManualContract: (row: HistoryRow, attachmentId: string) => void | Promise<void>;
  manualContractBusyId: string | null;
};

export default function StoreHistoryResultsSection({
  rows,
  loading,
  error,
  euros,
  dt,
  statusTone,
  incidentTone,
  countPaidServiceCents,
  countPendingServiceCents,
  statusLabel,
  mechanicsDetailHref,
  mechanicsEventHref,
  reservationHref,
  cell,
  mutedText,
  mutedStack,
  detailBlock,
  badgeBase,
  moneyValue,
  incidentCard,
  incidentSummary,
  actionLink,
  emptyState,
  onAdjustFinancials,
  onUploadManualContract,
  onDownloadManualContract,
  manualContractBusyId,
}: Props) {
  if (error) return <Alert kind="error">{error}</Alert>;

  return (
    <Card
      title="Resultados"
      right={
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
          {loading ? "Cargando..." : `${rows.length} reservas`}
        </div>
      }
    >
      <div style={{ ...mutedText, marginBottom: 14 }}>
        Cada fila separa servicio, fianza y trazabilidad operativa para detectar rápido lo que no cuadra.
      </div>
      {loading ? (
        <div style={emptyState}>Cargando histórico...</div>
      ) : rows.length === 0 ? (
        <div style={emptyState}>No hay resultados para los filtros actuales.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ ...styles.table, minWidth: 1440 }}>
            <thead>
              <tr>
                <th style={styles.th}>Reserva</th>
                <th style={styles.th}>Servicio</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Servicio</th>
                <th style={styles.th}>Fianza</th>
                <th style={styles.th}>Incidencias</th>
                <th style={styles.th}>Canal</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const statusUi = statusTone(row.storeFlowStage ?? row.status);
                const incidentCount = row.incidents.length;
                const manualContracts = row.manualContractAttachments ?? [];
                const manualContractsCount = manualContracts.length;
                const maxManualContracts = Math.max(1, Number(row.quantity ?? 1));
                const canUploadMoreManualContracts = row.isManualEntry && manualContractsCount < maxManualContracts;
                const holdStatus = row.depositHeld
                  ? row.depositReturnedCents > 0
                    ? "Retenida parcial"
                    : "Retenida"
                  : row.depositReturnedCents > 0
                    ? "Devuelta"
                    : "Sin bloqueo";

                return (
                  <tr key={row.id} style={{ verticalAlign: "top" }}>
                    <td style={cell}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>
                          {row.customerName || "Sin nombre"}
                        </div>
                        {row.isManualEntry ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Pill bg="#fff7ed" border="#fed7aa">Reserva manual</Pill>
                            <Pill bg={manualContractsCount > 0 ? "#ecfdf5" : "#f8fafc"} border={manualContractsCount > 0 ? "#bbf7d0" : "#cbd5e1"}>
                              Contratos {manualContractsCount}/{maxManualContracts}
                            </Pill>
                          </div>
                        ) : null}
                        <div style={mutedStack}>
                          <span>{row.customerCountry || "-"}</span>
                          <span>{row.source || "Origen no indicado"}</span>
                        </div>
                        <div style={detailBlock}>
                          <div>
                            <strong>Actividad</strong>
                            <div>{dt(row.scheduledTime || row.activityDate)}</div>
                          </div>
                          <div>
                            <strong>Devuelta</strong>
                            <div>{dt(row.arrivalAt)}</div>
                          </div>
                          {row.manualEntryNote ? (
                            <div>
                              <strong>Nota manual</strong>
                              <div>{row.manualEntryNote}</div>
                            </div>
                          ) : null}
                          {manualContractsCount > 0 ? (
                            <div>
                              <strong>Contratos escaneados</strong>
                              <div style={{ display: "grid", gap: 4 }}>
                                {manualContracts.map((attachment, index) => (
                                  <div key={attachment.id}>
                                    Contrato {index + 1}: {attachment.fileName || "Archivo sin nombre"}
                                    {attachment.uploadedAt ? ` · ${dt(attachment.uploadedAt)}` : ""}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td style={cell}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 800 }}>{row.serviceName || "Servicio"}</div>
                        <div style={mutedText}>{row.serviceCategory || "Categoría sin indicar"}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Pill>{row.durationMinutes ? `${row.durationMinutes} min` : "Sin duración"}</Pill>
                          <Pill>Cant {row.quantity ?? 0}</Pill>
                          <Pill>PAX {row.pax ?? 0}</Pill>
                          {row.isLicense ? <Pill>Licencia</Pill> : null}
                        </div>
                      </div>
                    </td>

                    <td style={cell}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <span
                          style={{
                            ...badgeBase,
                            background: statusUi.bg,
                            borderColor: statusUi.border,
                            color: statusUi.color,
                          }}
                        >
                          {statusLabel(row.storeFlowStage ?? row.status)}
                        </span>
                        <div style={mutedText}>
                          Formalizada: {row.formalizedAt ? dt(row.formalizedAt) : "No"}
                        </div>
                        {row.financialAdjustedAt ? (
                          <div style={mutedText}>
                            Ajustada: {dt(row.financialAdjustedAt)}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td style={cell}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={moneyValue}>{euros(countPaidServiceCents(row))}</div>
                        <div style={mutedText}>Cobrado en servicio · {euros(row.totalPriceCents)}</div>
                        <div
                          style={{
                            color: countPendingServiceCents(row) > 0 ? "#b45309" : "#166534",
                            fontWeight: 800,
                          }}
                        >
                          Pendiente de servicio · {euros(countPendingServiceCents(row))}
                        </div>
                      </div>
                    </td>

                    <td style={cell}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={moneyValue}>
                          {euros(row.paidDepositCents)} / {euros(row.depositCents)}
                        </div>
                        <div style={mutedText}>Cobrada / prevista</div>
                        <div
                          style={{
                            color: row.depositHeld ? "#b91c1c" : row.depositReturnedCents > 0 ? "#166534" : "#334155",
                            fontWeight: 900,
                          }}
                        >
                          {holdStatus}
                        </div>
                        {(row.depositReturnedCents > 0 || row.depositRetainedCents > 0) ? (
                          <div style={mutedText}>
                            Devuelto {euros(row.depositReturnedCents)} · Retenido {euros(row.depositRetainedCents)}
                          </div>
                        ) : null}
                        {row.depositHoldReason ? <div style={mutedText}>{row.depositHoldReason}</div> : null}
                        {row.financialAdjustmentNote ? <div style={mutedText}>Ajuste: {row.financialAdjustmentNote}</div> : null}
                      </div>
                    </td>

                    <td style={cell}>
                      {incidentCount === 0 ? (
                        <div style={mutedText}>Sin incidencias</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10, minWidth: 260 }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Pill bg="#fff7ed" border="#fed7aa">
                              {incidentCount} incidencias
                            </Pill>
                            {row.depositHeld ? (
                              <Pill bg="#fff1f2" border="#fecdd3">
                                Fianza retenida
                              </Pill>
                            ) : null}
                          </div>

                          {row.incidents.map((incident) => {
                            const tone = incidentTone(incident.level);
                            return (
                              <details key={incident.id} style={incidentCard}>
                                <summary style={incidentSummary}>
                                  <span
                                    style={{
                                      ...badgeBase,
                                      background: tone.bg,
                                      borderColor: tone.border,
                                      color: tone.color,
                                    }}
                                  >
                                    {incident.level}
                                  </span>
                                  <span style={{ fontWeight: 800 }}>{incident.type}</span>
                                  <span style={mutedText}>{incident.status}</span>
                                </summary>

                                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                                  {incident.description ? (
                                    <div style={{ color: "#0f172a" }}>{incident.description}</div>
                                  ) : null}
                                  {incident.notes ? <div style={mutedText}>Notas: {incident.notes}</div> : null}
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {incident.isOpen ? (
                                      <Pill bg="#eff6ff" border="#bfdbfe">
                                        Abierta
                                      </Pill>
                                    ) : (
                                      <Pill>Cerrada</Pill>
                                    )}
                                    {incident.retainDeposit ? (
                                      <Pill bg="#fff1f2" border="#fecdd3">
                                        Retiene {euros(incident.retainDepositCents)}
                                      </Pill>
                                    ) : null}
                                  </div>
                                  <div style={mutedText}>Registrada: {dt(incident.createdAt)}</div>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    <td style={cell}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 800 }}>{row.channelName || "-"}</div>
                      </div>
                    </td>

                    <td style={cell}>
                      <div style={{ display: "grid", gap: 8, minWidth: 150 }}>
                        <a href={reservationHref(row.id)} style={actionLink}>
                          Ver ficha
                        </a>

                        <button type="button" onClick={() => onAdjustFinancials(row)} style={actionLink}>
                          Ajustar importes
                        </button>

                        {row.isManualEntry ? (
                          <label
                            style={{
                              ...actionLink,
                              cursor: manualContractBusyId === row.id || !canUploadMoreManualContracts ? "not-allowed" : "pointer",
                              opacity: canUploadMoreManualContracts ? 1 : 0.6,
                            }}
                          >
                            {manualContractBusyId === row.id ? "Subiendo..." : canUploadMoreManualContracts ? "Adjuntar contratos" : "Contratos completos"}
                            <input
                              type="file"
                              accept=".pdf,image/jpeg,image/png,image/webp"
                              multiple
                              style={{ display: "none" }}
                              disabled={manualContractBusyId === row.id || !canUploadMoreManualContracts}
                              onChange={(e) => {
                                const files = Array.from(e.currentTarget.files ?? []);
                                if (files.length > 0) {
                                  void onUploadManualContract(row, files);
                                }
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                        ) : null}

                        {manualContracts.map((attachment, index) => (
                          <button
                            key={attachment.id}
                            type="button"
                            onClick={() => void onDownloadManualContract(row, attachment.id)}
                            style={actionLink}
                            disabled={manualContractBusyId === row.id}
                          >
                            {manualContractBusyId === row.id ? "Abriendo..." : `Ver contrato ${index + 1}`}
                          </button>
                        ))}

                        {row.incidents.some((incident) => incident.maintenanceEventId) ? (
                          <a
                            href={mechanicsEventHref(
                              row.incidents.find((incident) => incident.maintenanceEventId)!
                            )}
                            style={actionLink}
                          >
                            Ver evento
                          </a>
                        ) : null}

                        {row.incidents.length > 0 ? (
                          <a href={mechanicsDetailHref(row.incidents[0])} style={actionLink}>
                            Ver mecánica
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
