"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { opsStyles } from "@/components/ops-ui";
import AdminCatalogCreateSection from "./_components/AdminCatalogCreateSection";
import AdminCatalogFiltersSection from "./_components/AdminCatalogFiltersSection";
import AdminCatalogServicesSection from "./_components/AdminCatalogServicesSection";
import type { ServiceRow } from "./types";

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

    const response = await fetch("/api/admin/catalog/services", { cache: "no-store" });
    if (!response.ok) {
      setError(await response.text());
      setLoading(false);
      return;
    }

    const data = await response.json();
    setRows(data.services ?? []);
    setLoading(false);
  }

  async function create() {
    setError(null);

    const trimmedName = name.trim();
    const trimmedCategory = category.trim();

    if (!trimmedName) {
      setError("Falta el nombre");
      return;
    }
    if (!trimmedCategory) {
      setError("Falta la categoría");
      return;
    }

    const response = await fetch("/api/admin/catalog/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedName, category: trimmedCategory, isActive: true }),
    });

    if (!response.ok) {
      setError(await response.text());
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
    const query = q.trim().toLowerCase();

    return rows
      .filter((service) => (showInactive ? true : service.isActive))
      .filter((service) => (cat === "ALL" ? true : service.category === cat))
      .filter((service) => (query ? service.name.toLowerCase().includes(query) : true))
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        const categoryCmp = a.category.localeCompare(b.category);
        if (categoryCmp !== 0) return categoryCmp;
        return a.name.localeCompare(b.name);
      });
  }, [rows, q, cat, showInactive]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => row.isActive).length,
      licenses: rows.filter((row) => row.isLicense).length,
    }),
    [rows]
  );

  async function patchService(id: string, patch: Partial<ServiceRow>) {
    setSavingId(id);

    const response = await fetch(`/api/admin/catalog/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!response.ok) {
      setError(await response.text());
      setSavingId(null);
      return;
    }

    const data = await response.json();
    const updated: ServiceRow = data.service;
    setRows((prev) => prev.map((row) => (row.id === id ? updated : row)));
    setSavingId(null);
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Comercial</div>
          <h1 style={titleStyle}>Catálogo</h1>
          <p style={subtitleStyle}>
            Servicios, categorías y dependencias operativas. Desde aquí puedes crear servicios y ajustar si requieren
            plataforma, jetski, monitor o si son productos de licencia.
          </p>
        </div>

        <div style={opsStyles.actionGrid}>
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

      <AdminCatalogFiltersSection
        q={q}
        cat={cat}
        categories={categories}
        showInactive={showInactive}
        filteredCount={filtered.length}
        inputStyle={inputStyle}
        fieldLabel={fieldLabel}
        toggleRow={toggleRow}
        panelStyle={filtersPanel}
        onQueryChange={setQ}
        onCategoryChange={setCat}
        onShowInactiveChange={setShowInactive}
      />

      <AdminCatalogCreateSection
        name={name}
        category={category}
        inputStyle={inputStyle}
        fieldLabel={fieldLabel}
        darkBtn={darkBtn}
        panelStyle={panelStyle}
        onNameChange={setName}
        onCategoryChange={setCategory}
        onCreate={() => void create()}
      />

      {error ? <div style={errorStyle}>{error}</div> : null}

      {loading ? (
        <section style={panelStyle}>
          <div style={{ padding: 18, opacity: 0.7 }}>Cargando...</div>
        </section>
      ) : (
        <AdminCatalogServicesSection
          filtered={filtered}
          savingId={savingId}
          panelStyle={panelStyle}
          ghostBtn={ghostBtn}
          ghostButtonElement={ghostButtonElement}
          categoryPill={categoryPill}
          statusPill={statusPill}
          statusOn={statusOn}
          statusOff={statusOff}
          licensePill={licensePill}
          toggleRow={toggleRow}
          onRename={(service) => {
            const newName = window.prompt("Nuevo nombre del servicio:", service.name) ?? "";
            if (!newName.trim() || newName.trim() === service.name) return;
            void patchService(service.id, { name: newName.trim() });
          }}
          onToggleLicense={(service) => {
            void patchService(service.id, { isLicense: !service.isLicense });
          }}
          onPatchService={(id, patch) => {
            void patchService(id, patch);
          }}
        />
      )}

      <div style={footerNoteStyle}>
        Siguiente paso natural: revisar opciones de cada servicio para definir duración, pax y minutos contratados.
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1200px, 100%)",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(59, 130, 246, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 30%)",
};

const heroStyle: CSSProperties = {
  ...opsStyles.heroCard,
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
  ...opsStyles.heroTitle,
  lineHeight: 1,
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
  ...opsStyles.metricCard,
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
  ...opsStyles.sectionCard,
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
};

const filtersPanel: CSSProperties = {
  ...opsStyles.sectionCard,
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#334155",
};

const inputStyle: CSSProperties = {
  ...opsStyles.field,
  padding: 10,
  borderRadius: 10,
};

const ghostBtn: CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  border: "1px solid #dbe4ea",
  color: "#0f172a",
};

const ghostButtonElement: CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  border: "1px solid #dbe4ea",
  color: "#0f172a",
};

const darkBtn: CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  border: "1px solid #0f172a",
  background: "#0f172a",
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
