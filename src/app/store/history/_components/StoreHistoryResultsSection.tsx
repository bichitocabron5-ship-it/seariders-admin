"use client";

import { Alert, Button, Card, Input, Pill, styles } from "@/components/ui";
import { Fragment, useEffect, useRef, type CSSProperties } from "react";

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

type HistoryMeta = {
  reason: string;
  reasonLabel: string;
  historicalAt: string | null;
};

type JetskiAssignment = {
  assignmentId: string | null;
  reservationId: string;
  reservationUnitId: string | null;
  unitIndex: number | null;
  jetskiId: string;
  jetskiNumber: number | null;
  assignedAt: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
  returnedAt: string | null;
  status: string;
  source: "ASSIGNMENT" | "LEGACY_UNIT";
};

type CommercialSnapshot = {
  holderName: string | null;
  holderCountry: string | null;
  source: string | null;
  channelName: string | null;
  serviceName: string | null;
  serviceCategory: string | null;
  durationMinutes: number | null;
  quantity: number | null;
  pax: number | null;
  isLicense: boolean | null;
  totalPriceCents: number | null;
  commissionBaseCents: number | null;
  appliedCommissionPct: number | null;
  commissionAmountCents: number | null;
  servicePaidCents: number;
  servicePendingCents: number;
  depositCents: number | null;
  paidDepositCents: number;
  depositPendingCents: number;
  totalToChargeCents: number;
  formalizedAt: string | null;
};

type ContractualSnapshot = {
  primaryDriverName: string | null;
  driverNamesSummary: string | null;
  contractsCount: number;
  readyContractsCount: number;
  signedContractsCount: number;
};

type AdjustmentSnapshot = {
  isManualEntry: boolean;
  manualEntryNote: string | null;
  manualContractAttachments: ManualContractAttachment[];
  financialAdjustmentNote: string | null;
  financialAdjustedAt: string | null;
  hasManualChanges: boolean;
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
  primaryDriverName: string | null;
  driverNamesSummary: string | null;
  contractsCount: number;
  readyContractsCount: number;
  signedContractsCount: number;
  quantity: number | null;
  pax: number | null;
  isLicense: boolean | null;
  totalPriceCents: number | null;
  commissionBaseCents: number | null;
  appliedCommissionPct: number | null;
  commissionAmountCents: number | null;
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
  historyMeta: HistoryMeta;
  commercial: CommercialSnapshot;
  contractual: ContractualSnapshot;
  jetskiAssignments: JetskiAssignment[];
  adjustments: AdjustmentSnapshot;
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
  reservationHref: (row: HistoryRow) => string;
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
  adjustTargetId: string | null;
  adjustBusy: boolean;
  adjustTotalEuros: string;
  adjustDepositEuros: string;
  adjustNote: string;
  onAdjustTotalEurosChange: (value: string) => void;
  onAdjustDepositEurosChange: (value: string) => void;
  onAdjustNoteChange: (value: string) => void;
  onCancelAdjustment: () => void;
  onSubmitAdjustment: () => void | Promise<void>;
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
  adjustTargetId,
  adjustBusy,
  adjustTotalEuros,
  adjustDepositEuros,
  adjustNote,
  onAdjustTotalEurosChange,
  onAdjustDepositEurosChange,
  onAdjustNoteChange,
  onCancelAdjustment,
  onSubmitAdjustment,
  onUploadManualContract,
  onDownloadManualContract,
  manualContractBusyId,
}: Props) {
  const adjustmentPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!adjustTargetId || !adjustmentPanelRef.current) return;
    adjustmentPanelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [adjustTargetId]);

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
        Cada fila separa servicio, fianza y trazabilidad operativa para detectar rapido lo que no cuadra.
      </div>
      {loading ? (
        <div style={emptyState}>Cargando historico...</div>
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
                const isAdjusting = adjustTargetId === row.id;
                const manualContracts = row.adjustments?.manualContractAttachments ?? row.manualContractAttachments ?? [];
                const manualContractsCount = manualContracts.length;
                const maxManualContracts = Math.max(1, Number(row.quantity ?? 1));
                const canUploadMoreManualContracts =
                  (row.adjustments?.isManualEntry ?? row.isManualEntry) && manualContractsCount < maxManualContracts;
                const jetskiAssignments = row.jetskiAssignments ?? [];
                const holdStatus = row.depositHeld
                  ? row.depositReturnedCents > 0
                    ? "Retenida parcial"
                    : "Retenida"
                  : row.depositReturnedCents > 0
                    ? "Devuelta"
                    : "Sin bloqueo";

                return (
                  <Fragment key={row.id}>
                    <tr
                      style={{
                        verticalAlign: "top",
                        background: isAdjusting ? "#f8fbff" : undefined,
                        boxShadow: isAdjusting ? "inset 0 0 0 1px #bfdbfe" : undefined,
                      }}
                    >
                      <td style={cell}>
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ fontWeight: 900, color: "#0f172a" }}>
                            {row.commercial?.holderName || row.customerName || "Sin nombre"}
                          </div>
                          {row.contractual?.primaryDriverName || row.primaryDriverName ? (
                            <div style={mutedText}>
                              Firmante principal:{" "}
                              <strong style={{ color: "#0f172a" }}>
                                {row.contractual?.primaryDriverName || row.primaryDriverName}
                              </strong>
                            </div>
                          ) : null}
                          {(row.adjustments?.isManualEntry ?? row.isManualEntry) ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <Pill bg="#fff7ed" border="#fed7aa">Reserva manual</Pill>
                              <Pill
                                bg={manualContractsCount > 0 ? "#ecfdf5" : "#f8fafc"}
                                border={manualContractsCount > 0 ? "#bbf7d0" : "#cbd5e1"}
                              >
                                Contratos {manualContractsCount}/{maxManualContracts}
                              </Pill>
                            </div>
                          ) : null}
                          <div style={mutedStack}>
                            <span>{row.commercial?.holderCountry || row.customerCountry || "-"}</span>
                            <span>{row.commercial?.source || row.source || "Origen no indicado"}</span>
                            <span>{row.historyMeta?.reasonLabel || "Historico"}</span>
                          </div>
                          <div style={detailBlock}>
                            <div>
                              <strong>Reserva</strong>
                              <div>{row.commercial?.serviceName || row.serviceName || "Servicio"}</div>
                              <div>{row.commercial?.channelName || row.channelName || "Sin canal"}</div>
                            </div>
                            <div>
                              <strong>Entrada en historico</strong>
                              <div>{dt(row.historyMeta?.historicalAt || row.activityDate)}</div>
                            </div>
                            <div>
                              <strong>Actividad</strong>
                              <div>{dt(row.scheduledTime || row.activityDate)}</div>
                            </div>
                            <div>
                              <strong>Devuelta</strong>
                              <div>{dt(row.arrivalAt)}</div>
                            </div>
                            {jetskiAssignments.length > 0 ? (
                              <div>
                                <strong>Motos usadas</strong>
                                <div>
                                  {jetskiAssignments
                                    .map((assignment) => {
                                      const unitLabel = assignment.unitIndex ? ` U${assignment.unitIndex}` : "";
                                      const returnedLabel = assignment.returnedAt ? ` · devuelta ${dt(assignment.returnedAt)}` : "";
                                      return `Moto ${assignment.jetskiNumber ?? "?"}${unitLabel}${returnedLabel}`;
                                    })
                                    .join(" | ")}
                                </div>
                              </div>
                            ) : null}
                            {(row.adjustments?.manualEntryNote || row.manualEntryNote) ? (
                              <div>
                                <strong>Nota manual</strong>
                                <div>{row.adjustments?.manualEntryNote || row.manualEntryNote}</div>
                              </div>
                            ) : null}
                            {(row.contractual?.contractsCount ?? row.contractsCount) > 0 ? (
                              <div>
                                <strong>Contratos</strong>
                                <div>
                                  {row.driverNamesSummary || "Sin conductor informado"} - Ready {row.readyContractsCount}/{row.contractsCount} - Firmados {row.signedContractsCount}/{row.contractsCount}
                                </div>
                              </div>
                            ) : null}
                            {manualContractsCount > 0 ? (
                              <div>
                                <strong>Contratos escaneados</strong>
                                <div style={{ display: "grid", gap: 4 }}>
                                  {manualContracts.map((attachment, index) => (
                                    <div key={attachment.id}>
                                      Contrato {index + 1}: {attachment.fileName || "Archivo sin nombre"}
                                      {attachment.uploadedAt ? ` - ${dt(attachment.uploadedAt)}` : ""}
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
                          <div style={{ fontWeight: 800 }}>{row.commercial?.serviceName || row.serviceName || "Servicio"}</div>
                          <div style={mutedText}>{row.commercial?.serviceCategory || row.serviceCategory || "Categoria sin indicar"}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Pill>{(row.commercial?.durationMinutes ?? row.durationMinutes) ? `${row.commercial?.durationMinutes ?? row.durationMinutes} min` : "Sin duracion"}</Pill>
                            <Pill>Cant {row.commercial?.quantity ?? row.quantity ?? 0}</Pill>
                            <Pill>PAX {row.commercial?.pax ?? row.pax ?? 0}</Pill>
                            {(row.commercial?.isLicense ?? row.isLicense) ? <Pill>Licencia</Pill> : null}
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
                            Formalizada: {row.commercial?.formalizedAt ? dt(row.commercial.formalizedAt) : row.formalizedAt ? dt(row.formalizedAt) : "No"}
                          </div>
                          {row.adjustments?.financialAdjustedAt || row.financialAdjustedAt ? (
                            <div style={mutedText}>
                              Ajustada: {dt(row.adjustments?.financialAdjustedAt || row.financialAdjustedAt)}
                            </div>
                          ) : null}
                          <div style={mutedText}>
                            Historico por: {row.historyMeta?.reasonLabel || "criterio no indicado"}
                          </div>
                        </div>
                      </td>

                      <td style={cell}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={moneyValue}>{euros(countPaidServiceCents(row))}</div>
                          <div style={mutedText}>Comercial reserva - {euros(row.commercial?.totalPriceCents ?? row.totalPriceCents)}</div>
                          <div
                            style={{
                              color: countPendingServiceCents(row) > 0 ? "#b45309" : "#166534",
                              fontWeight: 800,
                            }}
                          >
                            Pendiente de servicio - {euros(countPendingServiceCents(row))}
                          </div>
                        </div>
                      </td>

                      <td style={cell}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={moneyValue}>
                            {euros(row.commercial?.paidDepositCents ?? row.paidDepositCents)} / {euros(row.commercial?.depositCents ?? row.depositCents)}
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
                              Devuelto {euros(row.depositReturnedCents)} - Retenido {euros(row.depositRetainedCents)}
                            </div>
                          ) : null}
                          {row.depositHoldReason ? <div style={mutedText}>{row.depositHoldReason}</div> : null}
                          {row.adjustments?.financialAdjustmentNote || row.financialAdjustmentNote ? (
                            <div style={mutedText}>Ajuste: {row.adjustments?.financialAdjustmentNote || row.financialAdjustmentNote}</div>
                          ) : null}
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
                          {row.commercial?.appliedCommissionPct != null ? (
                            <>
                              <div style={mutedText}>
                                Comision final - {row.commercial.appliedCommissionPct.toFixed(2)}%
                              </div>
                              <div style={mutedText}>
                                Base {euros(row.commercial.commissionBaseCents)} - Comision {euros(row.commercial.commissionAmountCents)}
                              </div>
                            </>
                          ) : (
                            <div style={mutedText}>Sin snapshot de comision</div>
                          )}
                        </div>
                      </td>

                      <td style={cell}>
                        <div style={{ display: "grid", gap: 8, minWidth: 150 }}>
                          <a href={reservationHref(row)} style={actionLink}>
                            Ver ficha
                          </a>

                          <button type="button" onClick={() => onAdjustFinancials(row)} style={actionLink}>
                            {isAdjusting ? "Panel de ajuste abierto" : "Ajustar importes"}
                          </button>

                          {(row.adjustments?.isManualEntry ?? row.isManualEntry) ? (
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
                                row.incidents.find((incident) => incident.maintenanceEventId)!,
                              )}
                              style={actionLink}
                            >
                              Ver evento
                            </a>
                          ) : null}

                          {row.incidents.length > 0 ? (
                            <a href={mechanicsDetailHref(row.incidents[0])} style={actionLink}>
                              Ver mecanica
                            </a>
                          ) : null}

                          {row.incidents.length === 0 && jetskiAssignments[0]?.jetskiId ? (
                            <a href={`/mechanics/jetski/${jetskiAssignments[0].jetskiId}`} style={actionLink}>
                              Ver moto
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>

                    {isAdjusting ? (
                      <tr>
                        <td colSpan={8} style={{ ...cell, paddingTop: 0, background: "#f8fbff" }}>
                          <div
                            ref={adjustmentPanelRef}
                            style={{
                              display: "grid",
                              gap: 14,
                              padding: 18,
                              border: "1px solid #bfdbfe",
                              borderRadius: 18,
                              background: "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)",
                              boxShadow: "0 10px 24px rgba(29, 78, 216, 0.08)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                              <div style={{ display: "grid", gap: 4 }}>
                                <div style={{ fontWeight: 900, color: "#0f172a" }}>
                                  Ajuste economico - {row.commercial?.holderName || row.customerName || row.id}
                                </div>
                                <div style={{ fontSize: 13, color: "#475569" }}>
                                  Panel abierto en esta reserva. Ajusta servicio y fianza sin salir del contexto del historico.
                                </div>
                              </div>
                              <Pill bg="#dbeafe" border="#93c5fd">Reserva activa</Pill>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                              <label style={{ display: "grid", gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Total servicio EUR</span>
                                <Input value={adjustTotalEuros} onChange={(e) => onAdjustTotalEurosChange(e.target.value)} />
                              </label>
                              <label style={{ display: "grid", gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Fianza EUR</span>
                                <Input value={adjustDepositEuros} onChange={(e) => onAdjustDepositEurosChange(e.target.value)} />
                              </label>
                              <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Motivo del ajuste</span>
                                <Input
                                  value={adjustNote}
                                  onChange={(e) => onAdjustNoteChange(e.target.value)}
                                  placeholder="Ej: descuento no aplicado, cobro real inferior, correccion de fianza..."
                                />
                              </label>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                              <Button onClick={onCancelAdjustment} disabled={adjustBusy}>Cancelar</Button>
                              <Button onClick={() => void onSubmitAdjustment()} disabled={adjustBusy} variant="primary">
                                {adjustBusy ? "Guardando..." : "Aplicar ajuste"}
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
