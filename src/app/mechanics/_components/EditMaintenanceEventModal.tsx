// src/app/mechanics/_components/EditMaintenanceEventModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtDateTime } from "@/lib/mechanics-format";
import EditMaintenanceEventPartsModal from "./EditMaintenanceEventPartsModal";
import EditMaintenanceEventFormSection from "./EditMaintenanceEventFormSection";
import EditMaintenanceEventPartsHistorySection from "./EditMaintenanceEventPartsHistorySection";

type MaintenanceStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "EXTERNAL" | "CANCELED";
type MaintenanceSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type EventDetailRow = {
  id: string;
  entityType: "JETSKI" | "ASSET";
  type: string;
  status: MaintenanceStatus;
  severity: MaintenanceSeverity;
  createdAt: string;
  resolvedAt: string | null;
  hoursAtService: number | null;
  note: string | null;
  supplierName: string | null;
  externalWorkshop: boolean;
  costCents: number | null;
  laborCostCents: number | null;
  partsCostCents: number | null;
  faultCode: string | null;
  reopenCount: number;
  affectsOperability: boolean;
  operabilityOnOpen: "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE" | null;
  operabilityOnResolved: "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE" | null;
  incident: {
    id: string;
    type: "ACCIDENT" | "DAMAGE" | "MECHANICAL" | "OTHER";
    level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    status: "OPEN" | "LINKED" | "RESOLVED" | "CANCELED";
    isOpen: boolean;
    description: string | null;
    notes: string | null;
    runId: string | null;
    assignmentId: string | null;
    reservationUnitId: string | null;
    createdAt: string;
  } | null;
  jetski: {
    id: string;
    number: number;
    model: string | null;
    plate: string | null;
    chassisNumber: string | null;
    maxPax: number | null;
  } | null;
  asset: {
    id: string;
    name: string;
    code: string | null;
    type: string;
    plate: string | null;
    chassisNumber: string | null;
    maxPax: number | null;
  } | null;
  createdByUser: {
    id: string;
    fullName: string | null;
    username: string | null;
    email: string | null;
  } | null;
  logs: Array<{
    id: string;
    kind:
      | "CREATED"
      | "STATUS_CHANGED"
      | "REOPENED"
      | "RESOLVED"
      | "PARTS_UPDATED"
      | "COSTS_UPDATED"
      | "NOTE_UPDATED"
      | "FIELD_UPDATE";
    message: string;
    payloadJson: unknown;
    createdAt: string;
    createdByUser: {
      id: string;
      fullName: string | null;
      username: string | null;
      email: string | null;
    } | null;
  }>;
  partUsages: Array<{
    id: string;
    qty: number;
    unitCostCents: number | null;
    totalCostCents: number | null;
    createdAt: string;
    sparePart: {
      id: string;
      name: string;
      sku: string | null;
      unit: string | null;
    } | null;
  }>;
  sparePartMovements: Array<{
    id: string;
    sparePartId: string;
    type: string;
    qty: number;
    unitCostCents: number | null;
    totalCostCents: number | null;
    createdAt: string;
    note: string | null;
    sparePart: {
      id: string;
      name: string;
      sku: string | null;
      unit: string | null;
    } | null;
  }>;
};

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 950,
};

const sectionCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  borderRadius: 16,
  padding: 14,
  display: "grid",
  gap: 8,
  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.06)",
};

function statusLabel(status: MaintenanceStatus) {
  const map: Record<MaintenanceStatus, string> = {
    OPEN: "Abierto",
    IN_PROGRESS: "En curso",
    RESOLVED: "Resuelto",
    EXTERNAL: "Externo",
    CANCELED: "Cancelado",
  };

  return map[status];
}

function severityLabel(severity: MaintenanceSeverity) {
  const map: Record<MaintenanceSeverity, string> = {
    LOW: "Baja",
    MEDIUM: "Media",
    HIGH: "Alta",
    CRITICAL: "Crítica",
  };

  return map[severity];
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        display: "grid",
        placeItems: "center",
        padding: 14,
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          borderRadius: 20,
          border: "1px solid #dbe4ea",
          padding: 16,
          display: "grid",
          gap: 14,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 22px 48px rgba(15, 23, 42, 0.14)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 950, fontSize: 18 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function entityLabel(row: EventDetailRow | null) {
  if (!row) return "—";
  if (row.entityType === "JETSKI" && row.jetski) {
    return `Moto ${row.jetski.number}${row.jetski.plate ? ` · ${row.jetski.plate}` : ""}${row.jetski.chassisNumber ? ` · Bastidor ${row.jetski.chassisNumber}` : ""}${row.jetski.maxPax ? ` · Pax máx ${row.jetski.maxPax}` : ""}`;
  }
  if (row.asset) {
    const base = row.asset.code ? `${row.asset.name} (${row.asset.code})` : row.asset.name;
    return `${base}${row.asset.plate ? ` · ${row.asset.plate}` : ""}${row.asset.chassisNumber ? ` · Bastidor ${row.asset.chassisNumber}` : ""}${row.asset.maxPax ? ` · Pax máx ${row.asset.maxPax}` : ""}`;
  }
  return "Entidad";
}

function logKindLabel(kind: EventDetailRow["logs"][number]["kind"]) {
  const map: Record<EventDetailRow["logs"][number]["kind"], string> = {
    CREATED: "Creación",
    STATUS_CHANGED: "Cambio de estado",
    REOPENED: "Reapertura",
    RESOLVED: "Resolución",
    PARTS_UPDATED: "Actualización de piezas",
    COSTS_UPDATED: "Actualización de costes",
    NOTE_UPDATED: "Actualización de nota",
    FIELD_UPDATE: "Actualización de campos",
  };

  return map[kind] ?? kind;
}

function logKindStyle(kind: EventDetailRow["logs"][number]["kind"]): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (kind === "REOPENED") {
    return {
      ...base,
      borderColor: "#fde68a",
      background: "#fffbeb",
      color: "#92400e",
    };
  }

  if (kind === "RESOLVED") {
    return {
      ...base,
      borderColor: "#bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
    };
  }

  if (kind === "PARTS_UPDATED" || kind === "COSTS_UPDATED") {
    return {
      ...base,
      borderColor: "#bfdbfe",
      background: "#eff6ff",
      color: "#1d4ed8",
    };
  }

  if (kind === "STATUS_CHANGED") {
    return {
      ...base,
      borderColor: "#fed7aa",
      background: "#fff7ed",
      color: "#c2410c",
    };
  }

  return base;
}

function userLabel(user: EventDetailRow["logs"][number]["createdByUser"] | null) {
  if (!user) return "—";
  return user.fullName || user.username || user.email || "—";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function renderPayloadSummary(payload: unknown) {
  if (!payload) return null;

  if (!isRecord(payload)) {
    return (
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        {String(payload)}
      </div>
    );
  }

  // Caso before/after de FIELD_UPDATE
  const entries = Object.entries(payload);
  if (entries.length > 0) {
    return (
      <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
        {entries.slice(0, 8).map(([key, value]) => {
          if (isRecord(value) && ("before" in value || "after" in value)) {
            const before = "before" in value ? value.before : null;
            const after = "after" in value ? value.after : null;

            return (
              <div key={key}>
                <b>{key}</b>: {String(before ?? "—")} → {String(after ?? "—")}
              </div>
            );
          }

          if (Array.isArray(value)) {
            return (
              <div key={key}>
                <b>{key}</b>: {value.length} elemento(s)
              </div>
            );
          }

          return (
            <div key={key}>
              <b>{key}</b>: {String(value ?? "—")}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

export default function EditMaintenanceEventModal({
  eventId,
  onClose,
  onSaved,
  onAdvancedPartsEdit,
}: {
  eventId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onAdvancedPartsEdit?: (eventId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<EventDetailRow | null>(null);

  const [status, setStatus] = useState<MaintenanceStatus>("OPEN");
  const [severity, setSeverity] = useState<MaintenanceSeverity>("MEDIUM");
  const [supplierName, setSupplierName] = useState("");
  const [externalWorkshop, setExternalWorkshop] = useState(false);
  const [costCents, setCostCents] = useState("");
  const [laborCostCents, setLaborCostCents] = useState("");
  const [partsCostCents, setPartsCostCents] = useState("");
  const [openPartsEditor, setOpenPartsEditor] = useState(false);
  const [resolvedAt, setResolvedAt] = useState("");
  const [faultCode, setFaultCode] = useState("");
  const [affectsOperability, setAffectsOperability] = useState(false);
  const [operabilityOnOpen, setOperabilityOnOpen] = useState<string>("");
  const [operabilityOnResolved, setOperabilityOnResolved] = useState<string>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/mechanics/events/${eventId}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();
        const nextRow = json.row as EventDetailRow;

        if (cancelled) return;

        setRow(nextRow);
        setStatus(nextRow.status);
        setSeverity(nextRow.severity);
        setSupplierName(nextRow.supplierName ?? "");
        setExternalWorkshop(nextRow.externalWorkshop);
        setCostCents(nextRow.costCents != null ? String(nextRow.costCents) : "");
        setLaborCostCents(nextRow.laborCostCents != null ? String(nextRow.laborCostCents) : "");
        setPartsCostCents(nextRow.partsCostCents != null ? String(nextRow.partsCostCents) : "");
        setResolvedAt(
          nextRow.resolvedAt
            ? new Date(nextRow.resolvedAt).toISOString().slice(0, 16)
            : ""
        );
        setFaultCode(nextRow.faultCode ?? "");
        setAffectsOperability(nextRow.affectsOperability);
        setOperabilityOnOpen(nextRow.operabilityOnOpen ?? "");
        setOperabilityOnResolved(nextRow.operabilityOnResolved ?? "");
        setNote(nextRow.note ?? "");
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error cargando evento");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const realPartsCost = useMemo(() => {
    return (row?.partUsages ?? []).reduce(
      (acc, p) => acc + Number(p.totalCostCents ?? 0),
      0
    );
  }, [row]);

  async function save() {
    try {
      setBusy(true);
      setError(null);

      const payload = {
        status,
        severity,
        supplierName: supplierName.trim() || null,
        externalWorkshop,
        costCents: costCents.trim() ? Number(costCents) : null,
        laborCostCents: laborCostCents.trim() ? Number(laborCostCents) : null,
        partsCostCents: partsCostCents.trim() ? Number(partsCostCents) : null,
        resolvedAt: resolvedAt.trim()
          ? new Date(resolvedAt).toISOString()
          : null,
        faultCode: faultCode.trim() || null,
        affectsOperability,
        operabilityOnOpen: operabilityOnOpen || null,
        operabilityOnResolved: operabilityOnResolved || null,
        note: note.trim() || null,
      };

      const res = await fetch(`/api/mechanics/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando evento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Editar / resolver evento" onClose={() => (busy ? null : onClose())}>
      {loading ? <div>Cargando evento...</div> : null}

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

      {!loading && row ? (
        <>
          <div style={sectionCard}>
            <div style={{ fontWeight: 900 }}>
              {entityLabel(row)} · {row.type}
            </div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              Creado: {fmtDateTime(row.createdAt)}
              {typeof row.hoursAtService === "number" ? ` · Horas evento: ${row.hoursAtService}` : ""}
            </div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              Autor:{" "}
              <b>
                {row.createdByUser?.fullName ||
                  row.createdByUser?.username ||
                  row.createdByUser?.email ||
                  "—"}
              </b>
            </div>
          </div>

          <EditMaintenanceEventFormSection
            status={status}
            severity={severity}
            supplierName={supplierName}
            resolvedAt={resolvedAt}
            costCents={costCents}
            laborCostCents={laborCostCents}
            partsCostCents={partsCostCents}
            faultCode={faultCode}
            externalWorkshop={externalWorkshop}
            affectsOperability={affectsOperability}
            operabilityOnOpen={operabilityOnOpen}
            operabilityOnResolved={operabilityOnResolved}
            note={note}
            inputStyle={inputStyle}
            onStatusChange={setStatus}
            onSeverityChange={setSeverity}
            onSupplierNameChange={setSupplierName}
            onResolvedAtChange={setResolvedAt}
            onCostCentsChange={setCostCents}
            onLaborCostCentsChange={setLaborCostCents}
            onPartsCostCentsChange={setPartsCostCents}
            onFaultCodeChange={(value) => setFaultCode(value.toUpperCase())}
            onExternalWorkshopChange={setExternalWorkshop}
            onAffectsOperabilityChange={setAffectsOperability}
            onOperabilityOnOpenChange={setOperabilityOnOpen}
            onOperabilityOnResolvedChange={setOperabilityOnResolved}
            onNoteChange={setNote}
            statusLabel={statusLabel}
            severityLabel={severityLabel}
          />

          <EditMaintenanceEventPartsHistorySection
            row={row}
            realPartsCost={realPartsCost}
            ghostBtn={ghostBtn}
            sectionCard={sectionCard}
            onAdvancedPartsEdit={onAdvancedPartsEdit ? () => setOpenPartsEditor(true) : undefined}
            logKindStyle={logKindStyle}
            logKindLabel={logKindLabel}
            userLabel={userLabel}
            renderPayloadSummary={renderPayloadSummary}
          />

          {openPartsEditor ? (
            <EditMaintenanceEventPartsModal
              eventId={eventId}
              onClose={() => setOpenPartsEditor(false)}
              onSaved={async () => {
                setOpenPartsEditor(false);

                const res = await fetch(`/api/mechanics/events/${eventId}`, {
                  cache: "no-store",
                });

                if (res.ok) {
                  const json = await res.json();
                  const nextRow = json.row as EventDetailRow;

                  setRow(nextRow);
                  setPartsCostCents(
                    nextRow.partsCostCents != null ? String(nextRow.partsCostCents) : ""
                  );
                }
              }}
            />
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose} style={ghostBtn} disabled={busy}>
              Cerrar
            </button>
            <button type="button" onClick={save} style={primaryBtn} disabled={busy}>
              {busy ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </>
      ) : null}
    </ModalShell>
  );
}
