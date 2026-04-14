"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import type { ServiceRow } from "../types";

export default function AdminCatalogServicesSection({
  filtered,
  savingId,
  panelStyle,
  ghostBtn,
  ghostButtonElement,
  categoryPill,
  statusPill,
  statusOn,
  statusOff,
  licensePill,
  toggleRow,
  onRename,
  onToggleLicense,
  onPatchService,
}: {
  filtered: ServiceRow[];
  savingId: string | null;
  panelStyle: CSSProperties;
  ghostBtn: CSSProperties;
  ghostButtonElement: CSSProperties;
  categoryPill: CSSProperties;
  statusPill: CSSProperties;
  statusOn: CSSProperties;
  statusOff: CSSProperties;
  licensePill: CSSProperties;
  toggleRow: CSSProperties;
  onRename: (service: ServiceRow) => void;
  onToggleLicense: (service: ServiceRow) => void;
  onPatchService: (id: string, patch: Partial<ServiceRow>) => void;
}) {
  return (
    <section style={panelStyle}>
      <div
        style={{
          padding: 14,
          borderBottom: "1px solid #eef2f7",
          display: "grid",
          gap: 4,
        }}
      >
        <div style={{ fontWeight: 950 }}>Servicios</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Configura la operativa de cada servicio y accede a sus opciones o precios.
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        {filtered.map((service) => {
          const busy = savingId === service.id;

          return (
            <article
              key={service.id}
              style={{
                border: "1px solid #e5edf3",
                borderRadius: 16,
                padding: 12,
                background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
                display: "grid",
                gap: 12,
                opacity: busy ? 0.65 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950, fontSize: 17, color: "#0f172a" }}>{service.name}</div>
                    <span style={categoryPill}>{service.category}</span>
                    {service.isExternalActivity ? <span style={licensePill}>Externa</span> : null}
                    <span style={{ ...statusPill, ...(service.isActive ? statusOn : statusOff) }}>
                      {service.isActive ? "Activo" : "Inactivo"}
                    </span>
                    {service.isLicense ? <span style={licensePill}>Licencia</span> : null}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Dependencias operativas y configuración comercial del servicio.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {service.category !== "EXTRA" ? (
                    <Link href={`/admin/catalog/${service.id}/options`} style={ghostBtn}>
                      Opciones
                    </Link>
                  ) : (
                    <Link href={`/admin/pricing?serviceId=${encodeURIComponent(service.id)}`} style={ghostBtn}>
                      Poner precio
                    </Link>
                  )}

                  <button type="button" disabled={busy} onClick={() => onRename(service)} style={ghostButtonElement}>
                    Renombrar
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleLicense(service)}
                    style={ghostButtonElement}
                    title="Marca si este servicio es un producto de licencia o permiso"
                  >
                    {service.isLicense ? "Quitar licencia" : "Marcar licencia"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                }}
              >
                <label style={toggleRow}>
                  <input
                    type="checkbox"
                    checked={service.isExternalActivity}
                    disabled={busy}
                    onChange={(e) => onPatchService(service.id, { isExternalActivity: e.target.checked })}
                  />
                  Actividad externa
                </label>

                <label style={toggleRow}>
                  <input
                    type="checkbox"
                    checked={service.isActive}
                    disabled={busy}
                    onChange={(e) => onPatchService(service.id, { isActive: e.target.checked })}
                  />
                  Servicio activo
                </label>

                <label style={toggleRow}>
                  <input
                    type="checkbox"
                    checked={service.requiresPlatform}
                    disabled={busy}
                    onChange={(e) => onPatchService(service.id, { requiresPlatform: e.target.checked })}
                  />
                  Requiere platform
                </label>

                <label style={toggleRow}>
                  <input
                    type="checkbox"
                    checked={service.requiresJetski}
                    disabled={busy}
                    onChange={(e) => onPatchService(service.id, { requiresJetski: e.target.checked })}
                  />
                  Requiere jetski
                </label>

                <label style={toggleRow}>
                  <input
                    type="checkbox"
                    checked={service.requiresMonitor}
                    disabled={busy}
                    onChange={(e) => onPatchService(service.id, { requiresMonitor: e.target.checked })}
                  />
                  Requiere monitor
                </label>

                <label style={toggleRow}>
                  <input
                    type="checkbox"
                    checked={service.visibleInBooth}
                    disabled={busy}
                    onChange={(e) => onPatchService(service.id, { visibleInBooth: e.target.checked })}
                  />
                  Visible en booth
                </label>
              </div>
            </article>
          );
        })}

        {filtered.length === 0 ? <div style={{ opacity: 0.7 }}>No hay servicios con esos filtros.</div> : null}
      </div>
    </section>
  );
}
