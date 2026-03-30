"use client";

import type React from "react";

import { Alert, Button, Card, Input, Select } from "@/components/ui";

import type { BarRentalAsset } from "../services/bar";

type BarRentalIncidentsSectionProps = {
  rentalAssets: BarRentalAsset[];
  incidentAssetId: string;
  incidentType: "DAMAGED" | "MAINTENANCE" | "LOST" | "OTHER";
  incidentNote: string;
  reactivateNote: string;
  actionBusy: string | null;
  labelAssetType: (type: BarRentalAsset["type"]) => string;
  labelAssetStatus: (status: BarRentalAsset["status"]) => string;
  onIncidentAssetChange: (value: string) => void;
  onIncidentTypeChange: (value: "DAMAGED" | "MAINTENANCE" | "LOST" | "OTHER") => void;
  onIncidentNoteChange: (value: string) => void;
  onReactivateNoteChange: (value: string) => void;
  onCreateIncident: () => void;
  onReactivateAsset: (rentalAssetId: string) => void;
};

export function BarRentalIncidentsSection({
  rentalAssets,
  incidentAssetId,
  incidentType,
  incidentNote,
  reactivateNote,
  actionBusy,
  labelAssetType,
  labelAssetStatus,
  onIncidentAssetChange,
  onIncidentTypeChange,
  onIncidentNoteChange,
  onReactivateNoteChange,
  onCreateIncident,
  onReactivateAsset,
}: BarRentalIncidentsSectionProps) {
  return (
    <Card title="Incidencias de equipos reutilizables">
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Unidad</div>
            <Select value={incidentAssetId} onChange={(e) => onIncidentAssetChange(e.target.value)}>
              <option value="">Selecciona unidad</option>
              {rentalAssets
                .filter((asset) => asset.status === "AVAILABLE" || asset.status === "DELIVERED")
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.code ?? asset.name}
                    {asset.size ? ` - ${asset.size}` : ""}
                    {asset.status ? ` - ${labelAssetStatus(asset.status)}` : ""}
                  </option>
                ))}
            </Select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Tipo de incidencia</div>
            <Select value={incidentType} onChange={(e) => onIncidentTypeChange(e.target.value as "DAMAGED" | "MAINTENANCE" | "LOST" | "OTHER")}>
              <option value="DAMAGED">Dañado</option>
              <option value="MAINTENANCE">Mantenimiento</option>
              <option value="LOST">Perdido</option>
              <option value="OTHER">Otro</option>
            </Select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Nota</div>
            <Input value={incidentNote} onChange={(e) => onIncidentNoteChange(e.target.value)} placeholder="Describe la incidencia" />
          </label>

          <Button variant="primary" onClick={onCreateIncident} disabled={!incidentAssetId || actionBusy === `asset-incident-${incidentAssetId}`}>
            {actionBusy === `asset-incident-${incidentAssetId}` ? "Guardando..." : "Registrar incidencia"}
          </Button>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Nota al reactivar (opcional)</div>
          <Input value={reactivateNote} onChange={(e) => onReactivateNoteChange(e.target.value)} placeholder="Ej: neopreno lavado y revisado / GoPro probada OK" />
        </label>

        <div style={{ display: "grid", gap: 10 }}>
          {rentalAssets.length === 0 ? (
            <Alert kind="info">No hay unidades registradas.</Alert>
          ) : (
            rentalAssets.map((asset) => (
              <div
                key={asset.id}
                style={{
                  display: "grid",
                  gap: 8,
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 12,
                  background:
                    asset.status === "DAMAGED"
                      ? "#fff1f2"
                      : asset.status === "MAINTENANCE"
                        ? "#fff7ed"
                        : asset.status === "LOST"
                          ? "#f8fafc"
                          : "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900 }}>
                      {asset.code ?? asset.name}
                      {asset.size ? ` - ${asset.size}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {labelAssetType(asset.type)} - {labelAssetStatus(asset.status)}
                    </div>
                  </div>

                  {asset.assignments?.[0]?.task?.reservation ? (
                    <div style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
                      Asignada a reserva #{asset.assignments[0].task.reservation.id.slice(-6)}
                      {asset.assignments[0].task.reservation.customerName ? ` - ${asset.assignments[0].task.reservation.customerName}` : ""}
                    </div>
                  ) : null}
                </div>

                {asset.notes ? <div style={{ fontSize: 12, color: "#475569" }}>Nota: {asset.notes}</div> : null}

                {asset.status !== "AVAILABLE" && asset.status !== "DELIVERED" && asset.status !== "INACTIVE" ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Button onClick={() => onReactivateAsset(asset.id)} disabled={actionBusy === `reactivate-${asset.id}`}>
                      {actionBusy === `reactivate-${asset.id}` ? "Reactivando..." : "Reactivar"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
