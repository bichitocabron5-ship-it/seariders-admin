"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Input, Page, Select } from "@/components/ui";

type Asset = {
  id: string;
  type: "GOPRO" | "WETSUIT" | "OTHER";
  name: string;
  code: string | null;
  size: string | null;
  status: "AVAILABLE" | "DELIVERED" | "MAINTENANCE" | "DAMAGED" | "LOST" | "INACTIVE";
  isActive: boolean;
  notes: string | null;
};

function assetTypeLabel(type: Asset["type"]) {
  switch (type) {
    case "GOPRO":
      return "GoPro";
    case "WETSUIT":
      return "Neopreno";
    default:
      return "Otro";
  }
}

function assetStatusLabel(status: Asset["status"]) {
  switch (status) {
    case "AVAILABLE":
      return "Disponible";
    case "DELIVERED":
      return "Entregado";
    case "MAINTENANCE":
      return "Mantenimiento";
    case "DAMAGED":
      return "Dañado";
    case "LOST":
      return "Perdido";
    default:
      return "Inactivo";
  }
}

export default function AdminBarAssetsPage() {
  const [rows, setRows] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<Asset["type"]>("GOPRO");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [size, setSize] = useState("");
  const [status, setStatus] = useState<Asset["status"]>("AVAILABLE");
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<Asset["type"]>("GOPRO");
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editStatus, setEditStatus] = useState<Asset["status"]>("AVAILABLE");
  const [editNotes, setEditNotes] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bar/assets", { cache: "no-store" });
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

  async function createAsset() {
    try {
      setError(null);
      const res = await fetch("/api/admin/bar/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name,
          code,
          size: type === "WETSUIT" ? size : null,
          status,
          notes,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setName("");
      setCode("");
      setSize("");
      setStatus("AVAILABLE");
      setNotes("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function updateStatus(id: string, nextStatus: Asset["status"]) {
    try {
      setBusyId(id);
      setError(null);
      const res = await fetch(`/api/admin/bar/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(row: Asset) {
    try {
      setBusyId(row.id);
      setError(null);
      const res = await fetch(`/api/admin/bar/assets/${row.id}`, {
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

  function startEdit(row: Asset) {
    setEditingId(row.id);
    setEditType(row.type);
    setEditName(row.name);
    setEditCode(row.code ?? "");
    setEditSize(row.size ?? "");
    setEditStatus(row.status);
    setEditNotes(row.notes ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditType("GOPRO");
    setEditName("");
    setEditCode("");
    setEditSize("");
    setEditStatus("AVAILABLE");
    setEditNotes("");
  }

  async function saveEdit(row: Asset) {
    try {
      setBusyId(row.id);
      setError(null);
      const res = await fetch(`/api/admin/bar/assets/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editType,
          name: editName,
          code: editCode,
          size: editType === "WETSUIT" ? editSize : null,
          status: editStatus,
          notes: editNotes,
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
      <Link href="/admin/bar/promotions" style={ghostLink}>
        Promociones
      </Link>
    </div>
  );

  return (
    <Page title="Admin Bar - Inventario por unidad" right={headerRight}>
      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card title="Nueva unidad" right={<div style={{ fontSize: 12, color: "#64748b" }}>Ejemplo: GoPro Hero 12, GOPRO-01, Neopreno adulto M</div>}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <Select value={type} onChange={(e) => setType(e.target.value as Asset["type"])}>
            <option value="GOPRO">GoPro</option>
            <option value="WETSUIT">Neopreno</option>
            <option value="OTHER">Otro</option>
          </Select>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: GoPro Hero 12" />
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: GOPRO-01" />
          {type === "WETSUIT" ? (
            <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Ej: XS, S, M, L, XL" />
          ) : (
            <div />
          )}
          <Select value={status} onChange={(e) => setStatus(e.target.value as Asset["status"])}>
            <option value="AVAILABLE">Disponible</option>
            <option value="DELIVERED">Entregado</option>
            <option value="MAINTENANCE">Mantenimiento</option>
            <option value="DAMAGED">Dañado</option>
            <option value="LOST">Perdido</option>
            <option value="INACTIVE">Inactivo</option>
          </Select>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: Equipo nuevo / revisión pendiente / funda incluida" />
        </div>

        <div style={{ marginTop: 12 }}>
          <Button onClick={createAsset}>Crear unidad</Button>
        </div>
      </Card>

      <Card title="Unidades">
        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <div key={row.id} style={{ display: "grid", gap: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 120px 140px 120px auto", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{row.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {row.code ?? "Sin código"} {row.size ? `- Talla ${row.size}` : ""}
                    </div>
                  </div>
                  <div>{assetTypeLabel(row.type)}</div>
                  <div>{assetStatusLabel(row.status)}</div>
                  <div>{row.isActive ? "Activa" : "Inactiva"}</div>
                  <Select value={row.status} onChange={(e) => void updateStatus(row.id, e.target.value as Asset["status"])} disabled={busyId === row.id}>
                    <option value="AVAILABLE">Disponible</option>
                    <option value="DELIVERED">Entregado</option>
                    <option value="MAINTENANCE">Mantenimiento</option>
                    <option value="DAMAGED">Dañado</option>
                    <option value="LOST">Perdido</option>
                    <option value="INACTIVE">Inactivo</option>
                  </Select>
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
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", paddingTop: 8, borderTop: "1px dashed #cbd5e1" }}>
                    <Select value={editType} onChange={(e) => setEditType(e.target.value as Asset["type"])}>
                      <option value="GOPRO">GoPro</option>
                      <option value="WETSUIT">Neopreno</option>
                      <option value="OTHER">Otro</option>
                    </Select>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ej: GoPro Hero 12" />
                    <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="Ej: GOPRO-01" />
                    {editType === "WETSUIT" ? (
                      <Input value={editSize} onChange={(e) => setEditSize(e.target.value)} placeholder="Ej: XS, S, M, L, XL" />
                    ) : (
                      <div />
                    )}
                    <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value as Asset["status"])}>
                      <option value="AVAILABLE">Disponible</option>
                      <option value="DELIVERED">Entregado</option>
                      <option value="MAINTENANCE">Mantenimiento</option>
                      <option value="DAMAGED">Dañado</option>
                      <option value="LOST">Perdido</option>
                      <option value="INACTIVE">Inactivo</option>
                    </Select>
                    <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Ej: Equipo nuevo / revisión pendiente / funda incluida" />
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
