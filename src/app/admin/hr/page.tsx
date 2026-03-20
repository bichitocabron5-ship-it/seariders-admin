// src/app/admin/hr/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

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
  createdAt: string;
  updatedAt: string;
  internshipHoursTotal?: number | null;
  internshipHoursUsed?: number | null;
  internshipStartDate?: string | null;
  internshipEndDate?: string | null;
  user?: {
    id: string;
    username: string;
    isActive: boolean;
    passportCode: string | null;
  } | null;
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

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function AdminHrPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | EmployeeKind>("");
  const [active, setActive] = useState<"" | "true" | "false">("");

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (kind) p.set("kind", kind);
    if (active) p.set("active", active);
    return p.toString();
  }, [q, kind, active]);

  const load = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/hr?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(json.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando RRHH");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load({ showLoading: true });
  }, [load]);

  async function toggleActive(row: EmployeeRow) {
    try {
      const res = await fetch(`/api/admin/hr/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load({ showLoading: false });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error actualizando estado");
    }
  }

  const stats = useMemo(() => {
    return {
      total: rows.length,
      activeCount: rows.filter((row) => row.isActive).length,
      withUser: rows.filter((row) => Boolean(row.user?.id)).length,
    };
  }, [rows]);

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Personal</div>
          <div style={titleStyle}>RRHH</div>
          <div style={subtitleStyle}>
            Trabajadores, perfiles operativos y vínculo con usuarios
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin" style={ghostBtn}>
            Volver a Admin
          </Link>
          <button
            type="button"
            onClick={() => load({ showLoading: true })}
            style={ghostButtonElement}
          >
            Refrescar
          </button>

          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            style={darkBtn}
          >
            + Nuevo trabajador
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Trabajadores</div>
          <div style={summaryValue}>{stats.total}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Activos</div>
          <div style={summaryValue}>{stats.activeCount}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Con usuario</div>
          <div style={summaryValue}>{stats.withUser}</div>
        </article>
      </section>

      <div style={panelStyle}>
        <div style={{ fontWeight: 950 }}>Filtros</div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Buscar
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, código, email, teléfono..."
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Tipo
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "" | EmployeeKind)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            >
              <option value="">Todos</option>
              {EMPLOYEE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {EMPLOYEE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Activo
            <select
              value={active}
              onChange={(e) => setActive(e.target.value as "" | "true" | "false")}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            >
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={() => load({ showLoading: true })}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 950,
            }}
          >
            Aplicar
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <SummaryCard title="Total trabajadores" value={rows.length} />
        <SummaryCard title="Con usuario" value={rows.filter((r) => !!r.user).length} />
        <SummaryCard title="Activos" value={rows.filter((r) => r.isActive).length} />
        <SummaryCard title="Mecánicos" value={rows.filter((r) => r.kind === "MECHANIC").length} />
      </div>

      <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff" }}>
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 950 }}>Trabajadores</div>
          <div style={{ fontWeight: 900, opacity: 0.8 }}>{rows.length}</div>
        </div>

        <div style={{ padding: 12 }}>
          {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}

          {error ? (
            <div
              style={{
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

          {!loading && rows.length === 0 ? <div style={{ opacity: 0.7 }}>No hay trabajadores.</div> : null}

          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 14,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>{r.fullName}</div>

                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        fontWeight: 900,
                        fontSize: 12,
                        background: r.isActive ? "#ecfeff" : "#fafafa",
                      }}
                    >
                      {r.isActive ? "ACTIVO" : "INACTIVO"}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {EMPLOYEE_KIND_LABEL[r.kind]}
                      {r.jobTitle ? ` · ${r.jobTitle}` : ""}
                      {r.code ? ` · ${r.code}` : ""}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Actualizado: <b>{fmtDateTime(r.updatedAt)}</b>
                  </div>
                </div>

                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                  {r.email ? r.email : "Sin email"} {r.phone ? ` · ${r.phone}` : ""}
                  {r.note ? ` · ${r.note}` : ""}
                </div>

                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                  Usuario:{" "}
                  <b>
                    {r.user
                      ? `${r.user.username}${r.user.passportCode ? ` · ${r.user.passportCode}` : ""}`
                      : "No vinculado"}
                  </b>
                </div>

                <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditing(r)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 12,
                      border: "1px solid #111",
                      background: "#fff",
                      color: "#111",
                      fontWeight: 900,
                    }}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleActive(r)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 12,
                      border: "1px solid #111",
                      background: r.isActive ? "#fff" : "#111",
                      color: r.isActive ? "#111" : "#fff",
                      fontWeight: 900,
                    }}
                  >
                    {r.isActive ? "Dar de baja" : "Reactivar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {openCreate ? (
        <EmployeeModal
          title="Nuevo trabajador"
          onClose={() => setOpenCreate(false)}
          onSaved={async () => {
            setOpenCreate(false);
            await load({ showLoading: true });
          }}
        />
      ) : null}

      {editing ? (
        <EmployeeModal
          title="Editar trabajador"
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load({ showLoading: true });
          }}
        />
      ) : null}
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(34, 197, 94, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%)",
};

const heroStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 26,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #f0fdf4 100%)",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#15803d",
};

const titleStyle: CSSProperties = {
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
  maxWidth: 760,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const summaryCard: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
};

const summaryLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const summaryValue: CSSProperties = {
  marginTop: 4,
  fontSize: 26,
  fontWeight: 950,
  color: "#0f172a",
};

const panelStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
  padding: 12,
};

const ghostBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  color: "#0f172a",
};

const ghostButtonElement: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
};

const darkBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 950,
};

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, background: "#fff", padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 4, fontWeight: 950, fontSize: 22 }}>{value}</div>
    </div>
  );
}

function EmployeeModal({
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

      const res = await fetch(
        initial ? `/api/admin/hr/${initial.id}` : "/api/admin/hr",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

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
              {EMPLOYEE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {EMPLOYEE_KIND_LABEL[k]}
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
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
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
