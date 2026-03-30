"use client";

import { useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";

type ExpenseCategoryRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
};

const EXPENSE_CATEGORIES_API = "/api/admin/expenses/expense-categories";

function normalizeText(value: string | null | undefined) {
  if (value == null) return value;
  const trimmed = value.trim();
  if (!trimmed) return "";

  let normalized = trimmed;
  if (/[ÃƒÃ‚Ã¢]/.test(normalized)) {
    try {
      normalized = decodeURIComponent(escape(normalized));
    } catch {
      // Keep original value if decoding fails.
    }
  }

  return normalized
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

export default function CategoryModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: ExpenseCategoryRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!initial;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      if (!name.trim()) {
        throw new Error("El nombre es obligatorio.");
      }

      const payload = {
        name: normalizeText(name) ?? "",
        code: normalizeText(code) || null,
        description: normalizeText(description) || null,
        isActive,
      };

      const res = await fetch(
        isEdit ? `/api/admin/expenses/expense-categories/${initial!.id}` : EXPENSE_CATEGORIES_API,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error(await res.text());
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando categoría");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>{isEdit ? "Editar categoría" : "Nueva categoría"}</div>
          <button type="button" onClick={onClose} style={ghostBtn}>Cerrar</button>
        </div>

        <div style={modalGrid2}>
          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Código">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={inputStyle} />
          </Field>

          <Field label="Descripción">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={inputStyle} />
          </Field>

          <Field label="Activa">
            <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>Sí</span>
            </label>
          </Field>
        </div>

        {error ? <div style={errorBox}>{error}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>Cerrar</button>
          <button type="button" onClick={submit} disabled={busy} style={primaryBtn}>
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
      {label}
      {children}
    </label>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 1000,
};

const modalStyle: CSSProperties = {
  width: "min(760px, 96vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: 24,
  padding: 20,
  border: "1px solid #dbe4ea",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
  display: "grid",
  gap: 14,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
};

const titleStyle: CSSProperties = {
  fontWeight: 950,
  fontSize: 28,
};

const modalGrid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const inputStyle: CSSProperties = {
  ...opsStyles.field,
  padding: 12,
  borderRadius: 12,
};

const primaryBtn: CSSProperties = {
  ...opsStyles.primaryButton,
};

const ghostBtn: CSSProperties = {
  ...opsStyles.ghostButton,
};

const errorBox: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};
