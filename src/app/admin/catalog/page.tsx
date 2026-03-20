// src/app/admin/catalog/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type ServiceRow = {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  requiresPlatform: boolean;
  requiresJetski: boolean;
  requiresMonitor: boolean;
  isLicense: boolean;
};

export default function AdminCatalogPage() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("ALL");
  const [showInactive, setShowInactive] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");

  async function load() {
    setLoading(true);
    setError(null);

    const r = await fetch("/api/admin/catalog/services", { cache: "no-store" });
    if (!r.ok) {
      setError(await r.text());
      setLoading(false);
      return;
    }

    const data = await r.json();
    setRows(data.services ?? []);
    setLoading(false);
  }

  async function create() {
    setError(null);

    const nm = name.trim();
    const catValue = category.trim();

    if (!nm) {
      setError("Falta el nombre");
      return;
    }
    if (!catValue) {
      setError("Falta la categoria");
      return;
    }

    const r = await fetch("/api/admin/catalog/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nm, category: catValue, isActive: true }),
    });

    if (!r.ok) {
      setError(await r.text());
      return;
    }

    setName("");
    setCategory("");
    await load();
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const service of rows) set.add(service.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows
      .filter((service) => (showInactive ? true : service.isActive))
      .filter((service) => (cat === "ALL" ? true : service.category === cat))
      .filter((service) => (qq ? service.name.toLowerCase().includes(qq) : true))
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        const categoryCmp = a.category.localeCompare(b.category);
        if (categoryCmp !== 0) return categoryCmp;
        return a.name.localeCompare(b.name);
      });
  }, [rows, q, cat, showInactive]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((row) => row.isActive).length,
      licenses: rows.filter((row) => row.isLicense).length,
    };
  }, [rows]);

  async function patchService(id: string, patch: Partial<ServiceRow>) {
    setSavingId(id);

    const r = await fetch(`/api/admin/catalog/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!r.ok) {
      setError(await r.text());
      setSavingId(null);
      return;
    }

    const data = await r.json();
    const updated: ServiceRow = data.service;
    setRows((prev) => prev.map((row) => (row.id === id ? updated : row)));
    setSavingId(null);
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Comercial</div>
          <h1 style={titleStyle}>Catalogo</h1>
          <p style={subtitleStyle}>
            Servicios, categorias y dependencias operativas. Desde aqui puedes crear servicios y ajustar si requieren
            plataforma, jetski, monitor o si son productos de licencia.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin" style={ghostBtn}>
            Volver a Admin
          </Link>
          <button type="button" onClick={() => void load()} style={darkBtn}>
            Refrescar
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Servicios</div>
          <div style={summaryValue}>{stats.total}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Activos</div>
          <div style={summaryValue}>{stats.active}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Licencias</div>
          <div style={summaryValue}>{stats.licenses}</div>
        </article>
      </section>

      <section style={filtersPanel}>
        <div style={{ fontWeight: 950 }}>Filtros</div>
        <div style={filtersGrid}>
          <label style={fieldLabel}>
            Buscar servicio
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Jetski, barco, licencia..."
              style={inputStyle}
            />
          </label>

          <label style={fieldLabel}>
            Categoria
            <select value={cat} onChange={(e) => setCat(e.target.value)} style={inputStyle}>
              <option value="ALL">Todas las categorias</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label style={{ ...fieldLabel, justifyContent: "end" }}>
            Visibilidad
            <span style={toggleRow}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Mostrar inactivos
            </span>
          </label>
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{filtered.length} servicios en la vista actual</div>
      </section>

      <section style={panelStyle}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>Crear servicio</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Si la categoria es <strong>EXTRA</strong>, el servicio no tendra opciones de duracion o pax.
          </div>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <div style={filtersGrid}>
            <label style={fieldLabel}>
              Nombre
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Jetski turista"
                style={inputStyle}
              />
            </label>

            <label style={fieldLabel}>
              Categoria
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="JETSKI, BOAT, EXTRA..."
                style={inputStyle}
              />
            </label>

            <div style={{ display: "grid", alignItems: "end" }}>
              <button type="button" onClick={() => void create()} style={darkBtn}>
                Crear servicio
              </button>
            </div>
          </div>
        </div>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      {loading ? (
        <section style={panelStyle}>
          <div style={{ padding: 18, opacity: 0.7 }}>Cargando...</div>
        </section>
      ) : (
        <section style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ fontWeight: 950 }}>Servicios</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Configura la operativa de cada servicio y accede a sus opciones o precios.
            </div>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 12 }}>
            {filtered.map((service) => {
              const busy = savingId === service.id;

              return (
                <article key={service.id} style={{ ...rowCard, opacity: busy ? 0.65 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 950, fontSize: 17, color: "#0f172a" }}>{service.name}</div>
                        <span style={categoryPill}>{service.category}</span>
                        <span style={{ ...statusPill, ...(service.isActive ? statusOn : statusOff) }}>
                          {service.isActive ? "Activo" : "Inactivo"}
                        </span>
                        {service.isLicense ? <span style={licensePill}>Licencia</span> : null}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Dependencias operativas y configuracion comercial del servicio.
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

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const newName = window.prompt("Nuevo nombre del servicio:", service.name) ?? "";
                          if (!newName.trim() || newName.trim() === service.name) return;
                          void patchService(service.id, { name: newName.trim() });
                        }}
                        style={ghostButtonElement}
                      >
                        Renombrar
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void patchService(service.id, { isLicense: !service.isLicense })}
                        style={ghostButtonElement}
                        title="Marca si este servicio es un producto de licencia o permiso"
                      >
                        {service.isLicense ? "Quitar licencia" : "Marcar licencia"}
                      </button>
                    </div>
                  </div>

                  <div style={controlsGrid}>
                    <label style={toggleRow}>
                      <input
                        type="checkbox"
                        checked={service.isActive}
                        disabled={busy}
                        onChange={(e) => void patchService(service.id, { isActive: e.target.checked })}
                      />
                      Servicio activo
                    </label>

                    <label style={toggleRow}>
                      <input
                        type="checkbox"
                        checked={service.requiresPlatform}
                        disabled={busy}
                        onChange={(e) => void patchService(service.id, { requiresPlatform: e.target.checked })}
                      />
                      Requiere platform
                    </label>

                    <label style={toggleRow}>
                      <input
                        type="checkbox"
                        checked={service.requiresJetski}
                        disabled={busy}
                        onChange={(e) => void patchService(service.id, { requiresJetski: e.target.checked })}
                      />
                      Requiere jetski
                    </label>

                    <label style={toggleRow}>
                      <input
                        type="checkbox"
                        checked={service.requiresMonitor}
                        disabled={busy}
                        onChange={(e) => void patchService(service.id, { requiresMonitor: e.target.checked })}
                      />
                      Requiere monitor
                    </label>
                  </div>
                </article>
              );
            })}

            {filtered.length === 0 ? <div style={{ opacity: 0.7 }}>No hay servicios con esos filtros.</div> : null}
          </div>
        </section>
      )}

      <div style={footerNoteStyle}>
        Siguiente paso natural: revisar opciones de cada servicio para definir duracion, pax y minutos contratados.
      </div>
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
    "radial-gradient(circle at top left, rgba(59, 130, 246, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 30%)",
};

const heroStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 26,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #eff6ff 100%)",
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
  color: "#2563eb",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
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
};

const filtersPanel: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const panelHeader: CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  display: "grid",
  gap: 4,
};

const filtersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  alignItems: "end",
};

const controlsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#334155",
};

const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #dbe4ea",
  outline: "none",
  width: "100%",
};

const rowCard: CSSProperties = {
  border: "1px solid #e5edf3",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  display: "grid",
  gap: 12,
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
  color: "#0f172a",
};

const darkBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 900,
};

const categoryPill: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
};

const licensePill: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
  color: "#4338ca",
};

const statusPill: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid transparent",
};

const statusOn: CSSProperties = {
  background: "#ecfeff",
  borderColor: "#99f6e4",
  color: "#0f766e",
};

const statusOff: CSSProperties = {
  background: "#f8fafc",
  borderColor: "#dbe4ea",
  color: "#64748b",
};

const toggleRow: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: 13,
  fontWeight: 800,
  color: "#0f172a",
};

const errorStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
  whiteSpace: "pre-wrap",
};

const footerNoteStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
};
