"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Input, Page } from "@/components/ui";

type Row = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  productsCount: number;
};

export default function AdminBarCategoriesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bar/categories", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(data.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCategory() {
    try {
      setError(null);
      const res = await fetch("/api/admin/bar/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sortOrder: Number(sortOrder || 0),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setName("");
      setSortOrder("0");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function toggleActive(row: Row) {
    try {
      setBusyId(row.id);
      setError(null);
      const res = await fetch(`/api/admin/bar/categories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditSortOrder(String(row.sortOrder));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditSortOrder("0");
  }

  async function saveEdit(row: Row) {
    try {
      setBusyId(row.id);
      setError(null);
      const res = await fetch(`/api/admin/bar/categories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          sortOrder: Number(editSortOrder || 0),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      cancelEdit();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  const headerRight = (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Link href="/admin/bar" style={ghostLink}>
        Módulo Bar
      </Link>
      <Link href="/admin/bar/products" style={ghostLink}>
        Productos
      </Link>
    </div>
  );

  return (
    <Page title="Admin Bar - Categorías" right={headerRight}>
      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card
        title="Nueva categoría"
        right={<div style={{ fontSize: 12, color: "#64748b" }}>Ejemplo: Bebidas frías, Snacks, Merch, Extras de playa</div>}
      >
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "2fr 1fr auto" }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Bebidas frías" />
          <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="Ej: 10, 20, 30" />
          <Button onClick={createCategory}>Crear</Button>
        </div>
      </Card>

      <Card title="Categorías">
        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <div key={row.id} style={{ display: "grid", gap: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 100px 120px auto", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{row.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{row.productsCount} productos</div>
                  </div>
                  <div>#{row.sortOrder}</div>
                  <div>{row.isActive ? "Activa" : "Inactiva"}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button onClick={() => startEdit(row)} disabled={busyId === row.id}>
                      Editar
                    </Button>
                    <Button onClick={() => void toggleActive(row)} disabled={busyId === row.id}>
                      {busyId === row.id ? "Guardando..." : row.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </div>

                {editingId === row.id ? (
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 12, paddingTop: 8, borderTop: "1px dashed #cbd5e1" }}>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ej: Bebidas frías" />
                    <Input value={editSortOrder} onChange={(e) => setEditSortOrder(e.target.value)} placeholder="Ej: 10, 20, 30" />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button onClick={() => void saveEdit(row)} disabled={busyId === row.id}>
                        {busyId === row.id ? "Guardando..." : "Guardar"}
                      </Button>
                      <Button onClick={cancelEdit} disabled={busyId === row.id}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}

const ghostLink: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #d0d9e4",
  background: "#fff",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 900,
};
