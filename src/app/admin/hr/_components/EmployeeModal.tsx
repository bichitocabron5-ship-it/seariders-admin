"use client";

import { useState } from "react";

type EmployeeKind =
  | "MONITOR"
  | "SKIPPER"
  | "SELLER"
  | "INTERN"
  | "MECHANIC"
  | "HR"
  | "SECURITY"
  | "ASSISTANT_MECHANIC"
  | "EXTRA"
  | "MANAGER";

type EmployeeRow = {
  id: string;
  code: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  kind: EmployeeKind;
  jobTitle: string | null;
  isActive: boolean;
  note: string | null;
  internshipHoursTotal?: number | null;
  internshipHoursUsed?: number | null;
  internshipStartDate?: string | null;
  internshipEndDate?: string | null;
};

const EMPLOYEE_KINDS: EmployeeKind[] = [
  "MONITOR",
  "SKIPPER",
  "SELLER",
  "INTERN",
  "MECHANIC",
  "HR",
  "SECURITY",
  "ASSISTANT_MECHANIC",
  "EXTRA",
  "MANAGER",
];

const EMPLOYEE_KIND_LABEL: Record<EmployeeKind, string> = {
  MONITOR: "Monitor",
  SKIPPER: "Patrón",
  SELLER: "Vendedor",
  INTERN: "Prácticas",
  MECHANIC: "Mecánico",
  HR: "RRHH",
  SECURITY: "Seguridad",
  ASSISTANT_MECHANIC: "Ayudante mecánico",
  EXTRA: "Extra",
  MANAGER: "Responsable",
};

export default function EmployeeModal({
  title,
  initial,
  onClose,
  onSaved,
}: {
  title: string;
  initial?: EmployeeRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [kind, setKind] = useState<EmployeeKind>(initial?.kind ?? "EXTRA");
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [note, setNote] = useState(initial?.note ?? "");
  const [internshipHoursTotal, setInternshipHoursTotal] = useState(
    initial?.internshipHoursTotal != null ? String(initial.internshipHoursTotal) : ""
  );
  const [internshipStartDate, setInternshipStartDate] = useState(
    initial?.internshipStartDate ? initial.internshipStartDate.slice(0, 10) : ""
  );
  const [internshipEndDate, setInternshipEndDate] = useState(
    initial?.internshipEndDate ? initial.internshipEndDate.slice(0, 10) : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!fullName.trim()) return setError("Nombre obligatorio.");

    setBusy(true);
    try {
      const body = {
        code: code.trim() || null,
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        kind,
        jobTitle: jobTitle.trim() || null,
        isActive,
        note: note.trim() || null,
        internshipHoursTotal:
          kind === "INTERN" && internshipHoursTotal.trim()
            ? Number(internshipHoursTotal)
            : null,
        internshipStartDate:
          kind === "INTERN" && internshipStartDate
            ? new Date(`${internshipStartDate}T00:00`).toISOString()
            : null,
        internshipEndDate:
          kind === "INTERN" && internshipEndDate
            ? new Date(`${internshipEndDate}T00:00`).toISOString()
            : null,
      };

      const res = await fetch(initial ? `/api/admin/hr/${initial.id}` : "/api/admin/hr", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 60,
      }}
      onClick={() => (busy ? null : onClose())}
    >
      <div
        style={{
          width: "min(860px, 100%)",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          padding: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{title}</div>
          <button
            type="button"
            onClick={() => (busy ? null : onClose())}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 10,
              padding: "6px 10px",
              fontWeight: 900,
            }}
          >
            Cerrar
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Código (opcional)
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: EMP-MEC-002"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Nombre completo
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Teléfono
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34..."
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@empresa.com"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Tipo
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as EmployeeKind)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            >
              {EMPLOYEE_KINDS.map((employeeKind) => (
                <option key={employeeKind} value={employeeKind}>
                  {EMPLOYEE_KIND_LABEL[employeeKind]}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Puesto visible / cargo
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ej: Responsable mecánica, Seguridad carpa, Extra verano..."
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: "1 / -1" }}>
            Nota
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observaciones, detalles internos..."
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>
        </div>

        {kind === "INTERN" ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 950, color: "#92400e" }}>Bolsa de horas · Prácticas</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                Horas totales
                <input
                  value={internshipHoursTotal}
                  onChange={(e) => setInternshipHoursTotal(e.target.value)}
                  placeholder="Ej: 400"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                Inicio prácticas
                <input
                  type="date"
                  value={internshipStartDate}
                  onChange={(e) => setInternshipStartDate(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                Fin prácticas
                <input
                  type="date"
                  value={internshipEndDate}
                  onChange={(e) => setInternshipEndDate(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                />
              </label>
            </div>

            {initial?.internshipHoursUsed != null ? (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Horas usadas automáticas: <b>{initial.internshipHoursUsed}</b>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
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

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111",
              background: busy ? "#9ca3af" : "#111",
              color: "#fff",
              fontWeight: 950,
            }}
          >
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
