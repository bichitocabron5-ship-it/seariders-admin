// src/app/mechanics/parts/_components/ConsumePartModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { PartRow } from "./types";
import {
  errorBox,
  ghostBtn,
  modalGrid2,
  ModalShell,
  primaryBtn,
  Field,
  inputStyle,
  sectionCard,
} from "./ui";

type MaintenanceEventOption = {
  id: string;
  label: string;
  entityType: "JETSKI" | "ASSET";
  type: string;
  status: string;
  severity: string | null;
  faultCode: string | null;
  createdAt: string;
  jetski: { id: string; number: number } | null;
  asset: { id: string; name: string; code: string | null } | null;
};

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function eventEntityLabel(ev: MaintenanceEventOption | null) {
  if (!ev) return "—";
  if (ev.entityType === "JETSKI") {
    return `Jetski ${ev.jetski?.number ?? "—"}`;
  }
  return ev.asset?.code
    ? `${ev.asset.name} (${ev.asset.code})`
    : ev.asset?.name ?? "Asset";
}

export default function ConsumePartModal({
  part,
  onClose,
  onSaved,
}: {
  part: PartRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [qty, setQty] = useState("1");
  const [maintenanceEventId, setMaintenanceEventId] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [eventOptions, setEventOptions] = useState<MaintenanceEventOption[]>([]);
  const [unitCostCentsOverride, setUnitCostCentsOverride] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        setLoadingEvents(true);

        const qs = new URLSearchParams({
          onlyOpen: "true",
          limit: "50",
        });

        if (eventQuery.trim()) {
          qs.set("q", eventQuery.trim());
        }

        const res = await fetch(`/api/mechanics/events/lookup?${qs.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();

        if (!cancelled) {
          setEventOptions(json.rows ?? []);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error cargando eventos");
        }
      } finally {
        if (!cancelled) {
          setLoadingEvents(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [eventQuery]);

  const selectedEvent = useMemo(
    () => eventOptions.find((ev) => ev.id === maintenanceEventId) ?? null,
    [eventOptions, maintenanceEventId]
  );

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      const parsedQty = Number(qty);

      if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
        throw new Error("La cantidad debe ser mayor que 0.");
      }

      if (
        unitCostCentsOverride !== "" &&
        (!Number.isFinite(Number(unitCostCentsOverride)) ||
          Number(unitCostCentsOverride) < 0)
      ) {
        throw new Error("El coste unitario override no es válido.");
      }

      const res = await fetch("/api/mechanics/parts/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sparePartId: part.id,
          qty: parsedQty,
          maintenanceEventId: maintenanceEventId || null,
          unitCostCentsOverride:
            unitCostCentsOverride === "" ? null : Number(unitCostCentsOverride),
          note: note || null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error registrando consumo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Consumir · ${part.name}`} onClose={onClose}>
      <div style={sectionCard}>
        <div style={modalGrid2}>
          <Field label="Cantidad">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Coste unitario override (céntimos)">
            <input
              value={unitCostCentsOverride}
              onChange={(e) => setUnitCostCentsOverride(e.target.value)}
              style={inputStyle}
              placeholder="Vacío = coste habitual"
            />
          </Field>

          <Field label="Buscar evento de mantenimiento">
            <input
              value={eventQuery}
              onChange={(e) => setEventQuery(e.target.value)}
              style={inputStyle}
              placeholder="Jetski, asset, avería, Código de avería..."
            />
          </Field>

          <Field label="Evento de mantenimiento">
            <select
              value={maintenanceEventId}
              onChange={(e) => setMaintenanceEventId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— Sin vincular —</option>
              {eventOptions.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        {loadingEvents
          ? "Cargando eventos..."
          : `${eventOptions.length} evento(s) disponibles`}
      </div>

      {selectedEvent ? (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900 }}>{selectedEvent.type}</div>
          <div>
            <b>Entidad:</b> {eventEntityLabel(selectedEvent)}
          </div>
          <div>
            <b>Estado:</b> {selectedEvent.status}
            {selectedEvent.severity ? ` · ${selectedEvent.severity}` : ""}
          </div>
          <div>
            <b>Fecha:</b> {fmtDateTime(selectedEvent.createdAt)}
          </div>
          {selectedEvent.faultCode ? (
            <div>
              <b>Código de avería:</b> {selectedEvent.faultCode}
            </div>
          ) : null}
        </div>
      ) : null}

      <Field label="Nota">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={inputStyle}
        />
      </Field>

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onClose} style={ghostBtn}>
          Cerrar
        </button>
        <button type="button" onClick={submit} disabled={busy} style={primaryBtn}>
          {busy ? "Guardando..." : "Guardar consumo"}
        </button>
      </div>
    </ModalShell>
  );
}

