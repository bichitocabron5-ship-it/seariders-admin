"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import OptionsCreateSection from "@/app/admin/catalog/[serviceId]/options/_components/OptionsCreateSection";
import OptionsListSection from "@/app/admin/catalog/[serviceId]/options/_components/OptionsListSection";

type OptionRow = {
  id: string;
  durationMinutes: number;
  paxMax: number;
  contractedMinutes: number;
  isActive: boolean;
  basePriceCents?: number;
};

type OptionDraft = {
  durationMinutes: number;
  paxMax: number;
  contractedMinutes: number;
  isActive: boolean;
};

export default function AdminServiceOptionsClient({ serviceId }: { serviceId: string }) {
  const [serviceName, setServiceName] = useState<string>("Servicio");
  const [serviceCategory, setServiceCategory] = useState<string>("");
  const [rows, setRows] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OptionDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dur, setDur] = useState(60);
  const [pax, setPax] = useState(2);
  const [contracted, setContracted] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const optionsRes = await fetch(`/api/admin/catalog/services/${serviceId}/options`, { cache: "no-store" });
    if (!optionsRes.ok) {
      setError(await optionsRes.text());
      setLoading(false);
      return;
    }

    const optionsJson = await optionsRes.json();
    setRows(optionsJson.options ?? []);

    const servicesRes = await fetch("/api/admin/catalog/services", { cache: "no-store" });
    if (servicesRes.ok) {
      const servicesJson = await servicesRes.json();
      const service = ((servicesJson.services ?? []) as Array<{ id: string; name: string; category: string }>).find(
        (row) => row.id === serviceId
      );
      if (service) {
        setServiceName(service.name);
        setServiceCategory(service.category);
      }
    }

    setLoading(false);
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId) return;
    void load();
  }, [load, serviceId]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.durationMinutes !== b.durationMinutes) return a.durationMinutes - b.durationMinutes;
      return a.paxMax - b.paxMax;
    });
  }, [rows]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((row) => row.isActive).length,
      maxPax: rows.length ? Math.max(...rows.map((row) => row.paxMax)) : 0,
    };
  }, [rows]);

  async function createOption() {
    setCreating(true);
    setError(null);
    try {
      const payload = {
        durationMinutes: dur,
        paxMax: pax,
        contractedMinutes: contracted,
        basePriceCents: 0,
      };

      const res = await fetch(`/api/admin/catalog/services/${serviceId}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      await load();
      setEditingId(null);
      setDraft(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando opción");
    } finally {
      setCreating(false);
    }
  }

  async function patchOption(optionId: string, patch: Partial<OptionRow>) {
    setSavingId(optionId);
    setError(null);

    const res = await fetch(`/api/admin/catalog/options/${optionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      setError(await res.text());
      setSavingId(null);
      return false;
    }

    const data = await res.json();
    const updated: OptionRow = data.option;
    setRows((prev) => prev.map((row) => (row.id === optionId ? updated : row)));
    setSavingId(null);
    return true;
  }

  function startEdit(option: OptionRow) {
    setEditingId(option.id);
    setDraft({
      durationMinutes: option.durationMinutes,
      paxMax: option.paxMax,
      contractedMinutes: option.contractedMinutes,
      isActive: option.isActive,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setError(null);
  }

  async function saveEdit(optionId: string) {
    if (!draft) return;
    const ok = await patchOption(optionId, draft);
    if (ok) {
      setEditingId(null);
      setDraft(null);
    }
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Catálogo</div>
          <h1 style={titleStyle}>Opciones</h1>
          <p style={subtitleStyle}>
            {serviceName}
            {serviceCategory ? ` · ${serviceCategory}` : ""}. Aquí defines duración, PAX y minutos contratados del
            catálogo. El precio se gestiona después desde precios versionados.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/catalog" style={ghostBtn}>
            Volver al catálogo
          </Link>
          <button type="button" onClick={() => void load()} style={darkBtn} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Opciones</div>
          <div style={summaryValue}>{stats.total}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Activas</div>
          <div style={summaryValue}>{stats.active}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>PAX máximo</div>
          <div style={summaryValue}>{stats.maxPax}</div>
        </article>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <OptionsCreateSection
        panelStyle={panelStyle}
        panelHeader={panelHeader}
        formGrid={formGrid}
        fieldStyle={fieldStyle}
        inputStyle={inputStyle}
        darkBtn={darkBtn}
        dur={dur}
        pax={pax}
        contracted={contracted}
        creating={creating}
        onDurChange={setDur}
        onPaxChange={setPax}
        onContractedChange={setContracted}
        onCreate={createOption}
      />

      <OptionsListSection
        loading={loading}
        sorted={sorted}
        savingId={savingId}
        editingId={editingId}
        draft={draft}
        panelStyle={panelStyle}
        panelHeader={panelHeader}
        rowCard={rowCard}
        editGrid={editGrid}
        fieldStyle={fieldStyle}
        inputStyle={inputStyle}
        ghostButtonElement={ghostButtonElement}
        darkBtn={darkBtn}
        metaGrid={metaGrid}
        metaItem={metaItem}
        metaLabel={metaLabel}
        metaValue={metaValue}
        statusPill={statusPill}
        statusOn={statusOn}
        statusOff={statusOff}
        toggleRow={toggleRow}
        editActions={editActions}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onSaveEdit={saveEdit}
        setDraft={setDraft}
      />

      <div style={footerNoteStyle}>
        Siguiente paso: revisar <strong>Precios versionados</strong> para asignar PVP base a cada opción activa.
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

const panelHeader: CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  display: "grid",
  gap: 4,
};

const rowCard: CSSProperties = {
  border: "1px solid #e5edf3",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  display: "grid",
  gap: 12,
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  alignItems: "end",
};

const editGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  alignItems: "end",
};

const metaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const metaItem: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#f8fafc",
};

const metaLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const metaValue: CSSProperties = {
  marginTop: 4,
  fontSize: 16,
  fontWeight: 950,
  color: "#0f172a",
};

const fieldStyle: CSSProperties = {
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

const editActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "end",
  gap: 8,
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
