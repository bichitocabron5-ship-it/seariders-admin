"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

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

    const r = await fetch(`/api/admin/catalog/services/${serviceId}/options`, { cache: "no-store" });
    if (!r.ok) {
      setError(await r.text());
      setLoading(false);
      return;
    }

    const data = await r.json();
    setRows(data.options ?? []);

    const r2 = await fetch("/api/admin/catalog/services", { cache: "no-store" });
    if (r2.ok) {
      const d2 = await r2.json();
      const svc = ((d2.services ?? []) as Array<{ id: string; name: string; category: string }>).find(
        (service) => service.id === serviceId
      );
      if (svc) {
        setServiceName(svc.name);
        setServiceCategory(svc.category);
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

      const r = await fetch(`/api/admin/catalog/services/${serviceId}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        throw new Error(await r.text());
      }

      await load();
      setEditingId(null);
      setDraft(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando opcion");
    } finally {
      setCreating(false);
    }
  }

  async function patchOption(optionId: string, patch: Partial<OptionRow>) {
    setSavingId(optionId);
    setError(null);

    const r = await fetch(`/api/admin/catalog/options/${optionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!r.ok) {
      setError(await r.text());
      setSavingId(null);
      return false;
    }

    const data = await r.json();
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
          <div style={eyebrowStyle}>Catalogo</div>
          <h1 style={titleStyle}>Opciones</h1>
          <p style={subtitleStyle}>
            {serviceName}
            {serviceCategory ? ` · ${serviceCategory}` : ""}. Aqui defines duracion, pax y minutos contratados del
            catalogo. El precio se gestiona despues desde precios versionados.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/catalog" style={ghostBtn}>
            Volver al catalogo
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
          <div style={summaryLabel}>Pax maximo</div>
          <div style={summaryValue}>{stats.maxPax}</div>
        </article>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <section style={panelStyle}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>Crear opcion</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Define la ficha operativa base. El precio se edita en la pantalla de precios.
          </div>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <div style={formGrid}>
            <label style={fieldStyle}>
              Duracion (min)
              <input
                type="number"
                min={1}
                max={600}
                value={dur}
                onChange={(e) => setDur(Number(e.target.value || 0))}
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              PAX max
              <input
                type="number"
                min={1}
                max={30}
                value={pax}
                onChange={(e) => setPax(Number(e.target.value || 0))}
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              Minutos contratados
              <input
                type="number"
                min={1}
                max={600}
                value={contracted}
                onChange={(e) => setContracted(Number(e.target.value || 0))}
                style={inputStyle}
              />
            </label>

            <div style={{ display: "grid", alignItems: "end" }}>
              <button type="button" onClick={() => void createOption()} style={darkBtn} disabled={creating}>
                {creating ? "Creando..." : "Anadir opcion"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <section style={panelStyle}>
          <div style={{ padding: 18, opacity: 0.7 }}>Cargando...</div>
        </section>
      ) : (
        <section style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ fontWeight: 950 }}>Opciones configuradas</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Las opciones inactivas quedan al final para priorizar la configuracion vigente.
            </div>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 12 }}>
            {sorted.map((option) => {
              const busy = savingId === option.id;
              const isEditing = editingId === option.id;
              const currentDraft = isEditing ? draft : null;

              return (
                <article key={option.id} style={{ ...rowCard, opacity: busy ? 0.65 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 950, fontSize: 17, color: "#0f172a" }}>
                          {option.durationMinutes} min · hasta {option.paxMax} pax
                        </div>
                        <span style={{ ...statusPill, ...(option.isActive ? statusOn : statusOff) }}>
                          {option.isActive ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Tiempo contratado actual: {option.contractedMinutes} min
                      </div>
                    </div>

                    <button type="button" disabled={busy} onClick={() => (isEditing ? cancelEdit() : startEdit(option))} style={ghostButtonElement}>
                      {isEditing ? "Cancelar" : "Editar"}
                    </button>
                  </div>

                  {isEditing ? (
                    <div style={editGrid}>
                      <label style={fieldStyle}>
                        Duracion
                        <input
                          type="number"
                          min={1}
                          max={600}
                          value={currentDraft?.durationMinutes ?? option.durationMinutes}
                          disabled={busy}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              durationMinutes: Number(e.target.value || 0),
                              paxMax: prev?.paxMax ?? option.paxMax,
                              contractedMinutes: prev?.contractedMinutes ?? option.contractedMinutes,
                              isActive: prev?.isActive ?? option.isActive,
                            }))
                          }
                          style={inputStyle}
                        />
                      </label>

                      <label style={fieldStyle}>
                        PAX max
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={currentDraft?.paxMax ?? option.paxMax}
                          disabled={busy}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              durationMinutes: prev?.durationMinutes ?? option.durationMinutes,
                              paxMax: Number(e.target.value || 0),
                              contractedMinutes: prev?.contractedMinutes ?? option.contractedMinutes,
                              isActive: prev?.isActive ?? option.isActive,
                            }))
                          }
                          style={inputStyle}
                        />
                      </label>

                      <label style={fieldStyle}>
                        Minutos contratados
                        <input
                          type="number"
                          min={1}
                          max={600}
                          value={currentDraft?.contractedMinutes ?? option.contractedMinutes}
                          disabled={busy}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              durationMinutes: prev?.durationMinutes ?? option.durationMinutes,
                              paxMax: prev?.paxMax ?? option.paxMax,
                              contractedMinutes: Number(e.target.value || 0),
                              isActive: prev?.isActive ?? option.isActive,
                            }))
                          }
                          style={inputStyle}
                        />
                      </label>

                      <label style={{ ...fieldStyle, justifyContent: "end" }}>
                        Estado
                        <span style={toggleRow}>
                          <input
                            type="checkbox"
                            checked={currentDraft?.isActive ?? option.isActive}
                            disabled={busy}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                durationMinutes: prev?.durationMinutes ?? option.durationMinutes,
                                paxMax: prev?.paxMax ?? option.paxMax,
                                contractedMinutes: prev?.contractedMinutes ?? option.contractedMinutes,
                                isActive: e.target.checked,
                              }))
                            }
                          />
                          Opcion activa
                        </span>
                      </label>

                      <div style={editActions}>
                        <button type="button" onClick={cancelEdit} disabled={busy} style={ghostButtonElement}>
                          Cancelar
                        </button>
                        <button type="button" onClick={() => void saveEdit(option.id)} disabled={busy} style={darkBtn}>
                          {busy ? "Guardando..." : "Guardar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={metaGrid}>
                      <div style={metaItem}>
                        <div style={metaLabel}>Duracion</div>
                        <div style={metaValue}>{option.durationMinutes} min</div>
                      </div>
                      <div style={metaItem}>
                        <div style={metaLabel}>PAX max</div>
                        <div style={metaValue}>{option.paxMax}</div>
                      </div>
                      <div style={metaItem}>
                        <div style={metaLabel}>Contratado</div>
                        <div style={metaValue}>{option.contractedMinutes} min</div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}

            {sorted.length === 0 ? <div style={{ opacity: 0.7 }}>No hay opciones para este servicio.</div> : null}
          </div>
        </section>
      )}

      <div style={footerNoteStyle}>
        Siguiente paso: revisar <strong>Precios versionados</strong> para asignar PVP base a cada opcion activa.
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
