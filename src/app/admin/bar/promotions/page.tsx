"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Input, Page, Select } from "@/components/ui";

type Product = {
  id: string;
  name: string;
  category: { id: string; name: string };
};

type Promotion = {
  id: string;
  name: string;
  type: "FIXED_TOTAL_FOR_QTY" | "BUY_X_PAY_Y";
  exactQty: number | null;
  fixedTotalCents: number | null;
  buyQty: number | null;
  payQty: number | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  product: Product;
};

export default function AdminBarPromotionsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"FIXED_TOTAL_FOR_QTY" | "BUY_X_PAY_Y">("FIXED_TOTAL_FOR_QTY");
  const [exactQty, setExactQty] = useState("2");
  const [fixedTotalEuros, setFixedTotalEuros] = useState("15");
  const [buyQty, setBuyQty] = useState("2");
  const [payQty, setPayQty] = useState("1");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"FIXED_TOTAL_FOR_QTY" | "BUY_X_PAY_Y">("FIXED_TOTAL_FOR_QTY");
  const [editExactQty, setEditExactQty] = useState("2");
  const [editFixedTotalEuros, setEditFixedTotalEuros] = useState("15");
  const [editBuyQty, setEditBuyQty] = useState("2");
  const [editPayQty, setEditPayQty] = useState("1");

  function cents(s: string) {
    const n = Number((s ?? "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, promoRes] = await Promise.all([
        fetch("/api/admin/bar/products", { cache: "no-store" }),
        fetch("/api/admin/bar/promotions", { cache: "no-store" }),
      ]);
      if (!prodRes.ok) throw new Error(await prodRes.text());
      if (!promoRes.ok) throw new Error(await promoRes.text());

      const prodData = await prodRes.json();
      const promoData = await promoRes.json();

      setProducts(
        (prodData.rows ?? []).map((r: Product) => ({
          id: r.id,
          name: r.name,
          category: r.category,
        }))
      );
      setRows(promoData.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createPromotion() {
    try {
      setError(null);

      const body =
        type === "FIXED_TOTAL_FOR_QTY"
          ? {
              productId,
              name,
              type,
              exactQty: Number(exactQty),
              fixedTotalCents: cents(fixedTotalEuros),
            }
          : {
              productId,
              name,
              type,
              buyQty: Number(buyQty),
              payQty: Number(payQty),
            };

      const res = await fetch("/api/admin/bar/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());

      setName("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function togglePromotion(row: Promotion) {
    try {
      setBusyId(row.id);
      setError(null);

      const res = await fetch(`/api/admin/bar/promotions/${row.id}`, {
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

  function startEdit(row: Promotion) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditType(row.type);
    setEditExactQty(String(row.exactQty ?? 2));
    setEditFixedTotalEuros(
      row.fixedTotalCents != null ? (Number(row.fixedTotalCents) / 100).toFixed(2) : "15"
    );
    setEditBuyQty(String(row.buyQty ?? 2));
    setEditPayQty(String(row.payQty ?? 1));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditType("FIXED_TOTAL_FOR_QTY");
    setEditExactQty("2");
    setEditFixedTotalEuros("15");
    setEditBuyQty("2");
    setEditPayQty("1");
  }

  async function saveEdit(row: Promotion) {
    try {
      setBusyId(row.id);
      setError(null);

      const body =
        editType === "FIXED_TOTAL_FOR_QTY"
          ? {
              name: editName,
              type: editType,
              exactQty: Number(editExactQty),
              fixedTotalCents: cents(editFixedTotalEuros),
            }
          : {
              name: editName,
              type: editType,
              buyQty: Number(editBuyQty),
              payQty: Number(editPayQty),
            };

      const res = await fetch(`/api/admin/bar/promotions/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  async function deletePromotion(row: Promotion) {
    try {
      setBusyId(row.id);
      setError(null);

      const res = await fetch(`/api/admin/bar/promotions/${row.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(await res.text());

      if (editingId === row.id) cancelEdit();
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
        Modulo Bar
      </Link>
      <Link href="/admin/bar/products" style={ghostLink}>
        Productos
      </Link>
      <Link href="/admin/bar/assets" style={ghostLink}>
        Inventario
      </Link>
    </div>
  );

  return (
    <Page title="Admin Bar - Promociones" right={headerRight}>
      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card
        title="Nueva promocion"
        right={
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Ejemplo: 2 aguas por 4,00 EUR o compra 3 y paga 2
          </div>
        }
      >
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Selecciona el producto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.category.name} - {p.name}
              </option>
            ))}
          </Select>

          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: 2x1 cerveza / Pack 3 aguas" />

          <Select value={type} onChange={(e) => setType(e.target.value as Promotion["type"])}>
            <option value="FIXED_TOTAL_FOR_QTY">Total fijo por cantidad</option>
            <option value="BUY_X_PAY_Y">Compra X y paga Y</option>
          </Select>

          {type === "FIXED_TOTAL_FOR_QTY" ? (
            <>
              <Input value={exactQty} onChange={(e) => setExactQty(e.target.value)} placeholder="Ej: 2 o 3" />
              <Input value={fixedTotalEuros} onChange={(e) => setFixedTotalEuros(e.target.value)} placeholder="Ej: 4,00 o 9,50" />
              <div />
            </>
          ) : (
            <>
              <Input value={buyQty} onChange={(e) => setBuyQty(e.target.value)} placeholder="Ej: 3" />
              <Input value={payQty} onChange={(e) => setPayQty(e.target.value)} placeholder="Ej: 2" />
              <div />
            </>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <Button onClick={createPromotion}>Crear promocion</Button>
        </div>
      </Card>

      <Card title="Promociones">
        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 12,
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.3fr 120px auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>{row.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {row.product.category.name} - {row.product.name}
                    </div>
                  </div>

                  <div style={{ fontSize: 13 }}>
                    {row.type === "FIXED_TOTAL_FOR_QTY"
                      ? `${row.exactQty} por ${((Number(row.fixedTotalCents ?? 0)) / 100).toFixed(2)} EUR`
                      : `${row.buyQty}x${row.payQty}`}
                  </div>

                  <div>{row.isActive ? "Activa" : "Inactiva"}</div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button onClick={() => startEdit(row)} disabled={busyId === row.id}>
                      Editar
                    </Button>

                    <Button onClick={() => void togglePromotion(row)} disabled={busyId === row.id}>
                      {busyId === row.id ? "Guardando..." : row.isActive ? "Desactivar" : "Activar"}
                    </Button>

                    <Button onClick={() => void deletePromotion(row)} disabled={busyId === row.id}>
                      {busyId === row.id ? "Borrando..." : "Borrar"}
                    </Button>
                  </div>
                </div>

                {editingId === row.id ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      paddingTop: 8,
                      borderTop: "1px dashed #cbd5e1",
                    }}
                  >
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ej: 2x1 cerveza" />

                    <Select value={editType} onChange={(e) => setEditType(e.target.value as Promotion["type"])}>
                      <option value="FIXED_TOTAL_FOR_QTY">Total fijo por cantidad</option>
                      <option value="BUY_X_PAY_Y">Compra X y paga Y</option>
                    </Select>

                    <div />

                    {editType === "FIXED_TOTAL_FOR_QTY" ? (
                      <>
                        <Input value={editExactQty} onChange={(e) => setEditExactQty(e.target.value)} placeholder="Ej: 2 o 3" />
                        <Input value={editFixedTotalEuros} onChange={(e) => setEditFixedTotalEuros(e.target.value)} placeholder="Ej: 4,00 o 9,50" />
                        <div />
                      </>
                    ) : (
                      <>
                        <Input value={editBuyQty} onChange={(e) => setEditBuyQty(e.target.value)} placeholder="Ej: 3" />
                        <Input value={editPayQty} onChange={(e) => setEditPayQty(e.target.value)} placeholder="Ej: 2" />
                        <div />
                      </>
                    )}

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
