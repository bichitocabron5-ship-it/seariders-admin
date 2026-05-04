"use client";

import type { CSSProperties } from "react";
import { buildOptionPresentation } from "@/lib/service-option-labels";

type OptionRow = {
  id: string;
  serviceId?: string;
  durationMinutes: number;
  paxMax: number;
  contractedMinutes: number;
  isActive: boolean;
  visibleInStore: boolean;
  visibleInBooth: boolean;
  basePriceCents?: number;
};

type OptionDraft = {
  durationMinutes: number;
  paxMax: number;
  contractedMinutes: number;
  isActive: boolean;
  visibleInStore: boolean;
  visibleInBooth: boolean;
};

type Props = {
  loading: boolean;
  sorted: OptionRow[];
  savingId: string | null;
  editingId: string | null;
  draft: OptionDraft | null;
  panelStyle: CSSProperties;
  panelHeader: CSSProperties;
  rowCard: CSSProperties;
  editGrid: CSSProperties;
  fieldStyle: CSSProperties;
  inputStyle: CSSProperties;
  ghostButtonElement: CSSProperties;
  darkBtn: CSSProperties;
  metaGrid: CSSProperties;
  metaItem: CSSProperties;
  metaLabel: CSSProperties;
  metaValue: CSSProperties;
  statusPill: CSSProperties;
  statusOn: CSSProperties;
  statusOff: CSSProperties;
  toggleRow: CSSProperties;
  editActions: CSSProperties;
  onStartEdit: (option: OptionRow) => void;
  onCancelEdit: () => void;
  onSaveEdit: (optionId: string) => void | Promise<void>;
  setDraft: React.Dispatch<React.SetStateAction<OptionDraft | null>>;
};

export default function OptionsListSection({
  loading,
  sorted,
  savingId,
  editingId,
  draft,
  panelStyle,
  panelHeader,
  rowCard,
  editGrid,
  fieldStyle,
  inputStyle,
  ghostButtonElement,
  darkBtn,
  metaGrid,
  metaItem,
  metaLabel,
  metaValue,
  statusPill,
  statusOn,
  statusOff,
  toggleRow,
  editActions,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  setDraft,
}: Props) {
  if (loading) {
    return (
      <section style={panelStyle}>
        <div style={{ padding: 18, opacity: 0.7 }}>Cargando...</div>
      </section>
    );
  }

  return (
    <section style={panelStyle}>
      <div style={panelHeader}>
        <div style={{ fontWeight: 950 }}>Opciones configuradas</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Las opciones inactivas quedan al final para priorizar la configuración vigente.
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        {sorted.map((option) => {
          const busy = savingId === option.id;
          const isEditing = editingId === option.id;
          const currentDraft = isEditing ? draft : null;
          const optionPresentation = buildOptionPresentation(
            { ...option, serviceId: option.serviceId ?? "service" },
            sorted.map((row) => ({ ...row, serviceId: row.serviceId ?? "service" })),
          );

          return (
            <article key={option.id} style={{ ...rowCard, opacity: busy ? 0.65 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950, fontSize: 17, color: "#0f172a" }}>
                      {optionPresentation.displayLabel}
                    </div>
                    <span style={{ ...statusPill, ...(option.isActive ? statusOn : statusOff) }}>
                      {option.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {optionPresentation.secondaryLabel ?? `Duración operativa: ${option.durationMinutes} min`} · Tiempo contratado actual: {option.contractedMinutes} min
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (isEditing ? onCancelEdit() : onStartEdit(option))}
                  style={ghostButtonElement}
                >
                  {isEditing ? "Cancelar" : "Editar"}
                </button>
              </div>

              {isEditing ? (
                <div style={editGrid}>
                  <label style={fieldStyle}>
                    Duración
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
                          visibleInStore: prev?.visibleInStore ?? option.visibleInStore,
                          visibleInBooth: prev?.visibleInBooth ?? option.visibleInBooth,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldStyle}>
                    PAX máx.
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
                          visibleInStore: prev?.visibleInStore ?? option.visibleInStore,
                          visibleInBooth: prev?.visibleInBooth ?? option.visibleInBooth,
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
                          visibleInStore: prev?.visibleInStore ?? option.visibleInStore,
                          visibleInBooth: prev?.visibleInBooth ?? option.visibleInBooth,
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
                            visibleInStore: prev?.visibleInStore ?? option.visibleInStore,
                            visibleInBooth: prev?.visibleInBooth ?? option.visibleInBooth,
                          }))
                        }
                      />
                      Opción activa
                    </span>
                  </label>

                  <label style={{ ...fieldStyle, justifyContent: "end" }}>
                    Canal
                    <span style={{ display: "grid", gap: 8, fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={currentDraft?.visibleInStore ?? option.visibleInStore}
                          disabled={busy}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              durationMinutes: prev?.durationMinutes ?? option.durationMinutes,
                              paxMax: prev?.paxMax ?? option.paxMax,
                              contractedMinutes: prev?.contractedMinutes ?? option.contractedMinutes,
                              isActive: prev?.isActive ?? option.isActive,
                              visibleInStore: e.target.checked,
                              visibleInBooth: prev?.visibleInBooth ?? option.visibleInBooth,
                            }))
                          }
                        />
                        Visible en Store
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={currentDraft?.visibleInBooth ?? option.visibleInBooth}
                          disabled={busy}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              durationMinutes: prev?.durationMinutes ?? option.durationMinutes,
                              paxMax: prev?.paxMax ?? option.paxMax,
                              contractedMinutes: prev?.contractedMinutes ?? option.contractedMinutes,
                              isActive: prev?.isActive ?? option.isActive,
                              visibleInStore: prev?.visibleInStore ?? option.visibleInStore,
                              visibleInBooth: e.target.checked,
                            }))
                          }
                        />
                        Visible en Booth
                      </label>
                    </span>
                  </label>

                  <div style={editActions}>
                    <button type="button" onClick={onCancelEdit} disabled={busy} style={ghostButtonElement}>
                      Cancelar
                    </button>
                    <button type="button" onClick={() => void onSaveEdit(option.id)} disabled={busy} style={darkBtn}>
                      {busy ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={metaGrid}>
                  <div style={metaItem}>
                    <div style={metaLabel}>Duración</div>
                    <div style={metaValue}>{option.durationMinutes} min</div>
                  </div>
                  <div style={metaItem}>
                    <div style={metaLabel}>PAX máx.</div>
                    <div style={metaValue}>{option.paxMax}</div>
                  </div>
                  <div style={metaItem}>
                    <div style={metaLabel}>Contratado</div>
                    <div style={metaValue}>{option.contractedMinutes} min</div>
                  </div>
                  <div style={metaItem}>
                    <div style={metaLabel}>Store</div>
                    <div style={metaValue}>{option.visibleInStore ? "Visible" : "Oculta"}</div>
                  </div>
                  <div style={metaItem}>
                    <div style={metaLabel}>Booth</div>
                    <div style={metaValue}>{option.visibleInBooth ? "Visible" : "Oculta"}</div>
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {sorted.length === 0 ? <div style={{ opacity: 0.7 }}>No hay opciones para este servicio.</div> : null}
      </div>
    </section>
  );
}
