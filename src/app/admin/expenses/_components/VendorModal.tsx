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

type ExpenseVendorCategoryLinkRow = {
  id: string;
  isDefault: boolean;
  category: {
    id: string;
    name: string;
    code: string | null;
    isActive: boolean;
  };
};

type ExpenseVendorRow = {
  id: string;
  name: string;
  code: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  contactPerson: string | null;
  note: string | null;
  isActive: boolean;
  categoryLinks?: ExpenseVendorCategoryLinkRow[];
};

const EXPENSE_VENDORS_API = "/api/admin/expenses/expense-vendors";

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

export default function VendorModal({
  categories,
  initial,
  onClose,
  onSaved,
}: {
  categories: ExpenseCategoryRow[];
  initial: ExpenseVendorRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!initial;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    (initial?.categoryLinks ?? []).map((x) => x.category.id)
  );
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>(
    initial?.categoryLinks?.find((x) => x.isDefault)?.category.id ??
      (initial?.categoryLinks?.[0]?.category.id ?? "")
  );

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        const next = prev.filter((id) => id !== categoryId);
        if (defaultCategoryId === categoryId) {
          setDefaultCategoryId(next[0] ?? "");
        }
        return next;
      }

      const next = [...prev, categoryId];
      if (!defaultCategoryId) setDefaultCategoryId(categoryId);
      return next;
    });
  }

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      if (!name.trim()) {
        throw new Error("El nombre es obligatorio.");
      }

      if (selectedCategoryIds.length > 0 && !defaultCategoryId) {
        throw new Error("Debes indicar una categoría por defecto.");
      }

      const payload = {
        name: normalizeText(name) ?? "",
        code: normalizeText(code) || null,
        taxId: normalizeText(taxId) || null,
        email: normalizeText(email) || null,
        phone: normalizeText(phone) || null,
        contactPerson: normalizeText(contactPerson) || null,
        note: normalizeText(note) || null,
        isActive,
        categoryIds: selectedCategoryIds,
        defaultCategoryId: defaultCategoryId || null,
      };

      const res = await fetch(
        isEdit ? `/api/admin/expenses/expense-vendors/${initial!.id}` : EXPENSE_VENDORS_API,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error(await res.text());
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando proveedor");
    } finally {
      setBusy(false);
    }
  }

  const activeCategories = categories.filter((c) => c.isActive);

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>{isEdit ? "Editar proveedor" : "Nuevo proveedor"}</div>
          <button type="button" onClick={onClose} style={ghostBtn}>Cerrar</button>
        </div>

        <div style={modalGrid2}>
          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Código">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={inputStyle} />
          </Field>

          <Field label="NIF/CIF">
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Teléfono">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Contacto">
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div style={categoriesBoxStyle}>
          <div style={{ fontWeight: 900 }}>Categorías asignadas</div>

          {activeCategories.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.75 }}>No hay categorías activas disponibles.</div>
          ) : (
            <div style={categoriesGridStyle}>
              {activeCategories.map((category) => {
                const checked = selectedCategoryIds.includes(category.id);

                return (
                  <label key={category.id} style={{ ...categoryItemStyle, background: checked ? "#f8fafc" : "#fff" }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCategory(category.id)} />
                    <span>
                      {category.name}
                      {category.code ? ` (${category.code})` : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <Field label="Categoría por defecto">
            <select
              value={defaultCategoryId}
              onChange={(e) => setDefaultCategoryId(e.target.value)}
              style={inputStyle}
              disabled={selectedCategoryIds.length === 0}
            >
              <option value="">-</option>
              {activeCategories
                .filter((category) => selectedCategoryIds.includes(category.id))
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>

        <Field label="Nota">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={inputStyle} />
        </Field>

        <Field label="Activo">
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Sí</span>
          </label>
        </Field>

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
  width: "min(980px, 96vw)",
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

const categoriesBoxStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fafafa",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 10,
};

const categoriesGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 8,
};

const categoryItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 10,
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
