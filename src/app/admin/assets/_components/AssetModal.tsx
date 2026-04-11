"use client";

import { useEffect, useState } from "react";
import type { AssetPlatformUsage, AssetRow, AssetStatus, AssetType } from "@/app/admin/types";

const ASSET_TYPES: AssetType[] = ["BOAT", "TOWBOAT", "JETCAR", "PARASAILING", "FLYBOARD", "TOWABLE", "OTHER"];
const ASSET_STATUSES: AssetStatus[] = ["OPERATIONAL", "MAINTENANCE", "DAMAGED", "OUT_OF_SERVICE"];
const ASSET_PLATFORM_USAGES: AssetPlatformUsage[] = ["CUSTOMER_ASSIGNABLE", "RUN_BASE_ONLY", "HIDDEN"];
const ASSET_PLATFORM_USAGE_LABEL: Record<AssetPlatformUsage, string> = {
  CUSTOMER_ASSIGNABLE: "Asignable a clientes",
  RUN_BASE_ONLY: "Solo base de salida",
  HIDDEN: "Oculto en Platform",
};

type Props = {
  initial: AssetRow | null;
  inputStyle: React.CSSProperties;
  ghostBtn: React.CSSProperties;
  darkBtn: React.CSSProperties;
  errorBox: React.CSSProperties;
  overlayStyle: React.CSSProperties;
  modalStyle: React.CSSProperties;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: full ? "1 / -1" : undefined }}>
      {label}
      {children}
    </label>
  );
}

export default function AssetModal({
  initial,
  inputStyle,
  ghostBtn,
  darkBtn,
  errorBox,
  overlayStyle,
  modalStyle,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!initial;
  const [type, setType] = useState<AssetType>(initial?.type ?? "OTHER");
  const [status, setStatus] = useState<AssetStatus>(initial?.status ?? "OPERATIONAL");
  const [platformUsage, setPlatformUsage] = useState<AssetPlatformUsage>(initial?.platformUsage ?? "CUSTOMER_ASSIGNABLE");
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [plate, setPlate] = useState(initial?.plate ?? "");
  const [chassisNumber, setChassisNumber] = useState(initial?.chassisNumber ?? "");
  const [maxPax, setMaxPax] = useState(initial?.maxPax != null ? String(initial.maxPax) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [isMotorized, setIsMotorized] = useState(initial?.isMotorized ?? false);
  const [currentHours, setCurrentHours] = useState(initial?.currentHours != null ? String(initial.currentHours) : "");
  const [lastServiceHours, setLastServiceHours] = useState(
    initial?.lastServiceHours != null ? String(initial.lastServiceHours) : ""
  );
  const [serviceIntervalHours, setServiceIntervalHours] = useState(
    initial?.serviceIntervalHours != null ? String(initial.serviceIntervalHours) : "85"
  );
  const [serviceWarnHours, setServiceWarnHours] = useState(
    initial?.serviceWarnHours != null ? String(initial.serviceWarnHours) : "70"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    if (["BOAT", "TOWBOAT", "JETCAR"].includes(type)) setIsMotorized(true);
  }, [type, initial]);

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Nombre obligatorio.");

    const yearNum = year.trim() ? Number(year.trim()) : null;
    if (yearNum !== null && (!Number.isFinite(yearNum) || yearNum < 1950 || yearNum > 2100)) {
      return setError("Año inválido.");
    }

    const maxPaxNum = maxPax.trim() ? Number(maxPax.trim()) : null;
    if (maxPaxNum !== null && (!Number.isInteger(maxPaxNum) || maxPaxNum < 1 || maxPaxNum > 100)) {
      return setError("Pax máx. inválido.");
    }

    const currentHoursNum = currentHours.trim() ? Number(currentHours.trim()) : null;
    if (currentHours.trim() && (!Number.isFinite(currentHoursNum) || currentHoursNum! < 0)) {
      return setError("Horas actuales inválidas.");
    }

    const lastServiceHoursNum = lastServiceHours.trim() ? Number(lastServiceHours.trim()) : null;
    if (lastServiceHours.trim() && (!Number.isFinite(lastServiceHoursNum) || lastServiceHoursNum! < 0)) {
      return setError("Horas último service inválidas.");
    }

    const serviceIntervalHoursNum = serviceIntervalHours.trim() ? Number(serviceIntervalHours.trim()) : null;
    if (serviceIntervalHours.trim() && (!Number.isFinite(serviceIntervalHoursNum) || serviceIntervalHoursNum! <= 0)) {
      return setError("Intervalo de service inválido.");
    }

    const serviceWarnHoursNum = serviceWarnHours.trim() ? Number(serviceWarnHours.trim()) : null;
    if (serviceWarnHours.trim() && (!Number.isFinite(serviceWarnHoursNum) || serviceWarnHoursNum! < 0)) {
      return setError("Aviso de service inválido.");
    }

    setBusy(true);
    try {
      const body = {
        id: initial?.id?.trim() || null,
        originalCode: initial?.code?.trim() || null,
        type,
        status,
        platformUsage,
        name: name.trim(),
        code: code.trim() || null,
        model: model.trim() || null,
        year: yearNum,
        plate: plate.trim() || null,
        chassisNumber: chassisNumber.trim() || null,
        maxPax: maxPaxNum,
        note: note.trim() || null,
        isMotorized,
        currentHours: currentHoursNum,
        lastServiceHours: lastServiceHoursNum,
        serviceIntervalHours: serviceIntervalHoursNum ?? undefined,
        serviceWarnHours: serviceWarnHoursNum ?? undefined,
      };

      const hasStableId = Boolean(initial?.id?.trim());
      const targetUrl = isEdit
        ? hasStableId
          ? `/api/admin/assets/${encodeURIComponent(initial!.id)}`
          : "/api/admin/assets"
        : "/api/admin/assets";

      const res = await fetch(targetUrl, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando recurso");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={() => (busy ? null : onClose())}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 24, fontWeight: 950 }}>{isEdit ? "Editar recurso" : "Nuevo recurso"}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Datos base, operatividad y horas de mantenimiento.</div>
          </div>
          <button type="button" onClick={() => (busy ? null : onClose())} style={ghostBtn}>
            Cerrar
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <Field label="Tipo">
            <select value={type} onChange={(e) => setType(e.target.value as AssetType)} style={inputStyle}>
              {ASSET_TYPES.map((assetType) => (
                <option key={assetType} value={assetType}>
                  {assetType}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estado">
            <select value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)} style={inputStyle}>
              {ASSET_STATUSES.map((assetStatus) => (
                <option key={assetStatus} value={assetStatus}>
                  {assetStatus}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Uso en Platform">
            <select value={platformUsage} onChange={(e) => setPlatformUsage(e.target.value as AssetPlatformUsage)} style={inputStyle}>
              {ASSET_PLATFORM_USAGES.map((value) => (
                <option key={value} value={value}>
                  {ASSET_PLATFORM_USAGE_LABEL[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Code">
            <input value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Modelo">
            <input value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Año">
            <input value={year} onChange={(e) => setYear(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Matrícula / placa">
            <input value={plate} onChange={(e) => setPlate(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Bastidor">
            <input value={chassisNumber} onChange={(e) => setChassisNumber(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Pax máx.">
            <input value={maxPax} onChange={(e) => setMaxPax(e.target.value)} style={inputStyle} />
          </Field>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={isMotorized} onChange={(e) => setIsMotorized(e.target.checked)} />
            Recurso motorizado
          </label>

          <Field label="Horas actuales">
            <input value={currentHours} onChange={(e) => setCurrentHours(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Horas último service">
            <input value={lastServiceHours} onChange={(e) => setLastServiceHours(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Intervalo service">
            <input
              value={serviceIntervalHours}
              onChange={(e) => setServiceIntervalHours(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Aviso service">
            <input value={serviceWarnHours} onChange={(e) => setServiceWarnHours(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Nota" full>
            <input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        {error ? <div style={errorBox}>{error}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            style={{ ...darkBtn, background: busy ? "#9ca3af" : "#111", width: "100%" }}
          >
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
