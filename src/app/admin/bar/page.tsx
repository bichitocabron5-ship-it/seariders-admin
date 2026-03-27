"use client";

import Link from "next/link";

const shortcuts = [
  {
    href: "/admin/bar/categories",
    tag: "CAT",
    title: "Categorías",
    description: "Define las familias del catálogo: por ejemplo bebidas, comida, hielo o merchandising.",
    accent: "#dbeafe",
  },
  {
    href: "/admin/bar/products",
    tag: "SKU",
    title: "Productos",
    description: "Da de alta productos, stock mínimo, precio de venta y configuración comercial.",
    accent: "#ccfbf1",
  },
  {
    href: "/admin/bar/assets",
    tag: "AST",
    title: "Inventario",
    description: "Gestiona GoPro, neoprenos y otros equipos reutilizables por unidad física.",
    accent: "#ccfbf1",
  },
  {
    href: "/admin/bar/promotions",
    tag: "PRO",
    title: "Promociones",
    description: "Configura 2x1, packs con total fijo y otras promociones aplicables por producto.",
    accent: "#ccfbf1",
  },
];

const quickStats = [
  { label: "Catálogo", value: "4 bloques" },
  { label: "Origen", value: "BAR" },
  { label: "Flujo", value: "Admin + Operativa" },
];

export default function AdminBarPage() {
  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={eyebrowStyle}>Operativa comercial</div>
          <div style={titleStyle}>Admin / Bar</div>
          <div style={subtitleStyle}>
            Punto central para mantener coherentes las altas, promociones y equipos del módulo BAR dentro de admin.
          </div>

          <div style={badgeRow}>
            {quickStats.map((item) => (
              <div key={item.label} style={miniBadge}>
                <div style={miniBadgeLabel}>{item.label}</div>
                <div style={miniBadgeValue}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin" style={ghostBtn}>
            Volver a Admin
          </Link>
        </div>
      </section>

      <section style={gridStyle}>
        {shortcuts.map((item) => (
          <Link key={item.href} href={item.href} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ ...iconBox, background: item.accent }}>{item.tag}</div>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontSize: 18, fontWeight: 950, color: "#0f172a" }}>{item.title}</div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>{item.tag}</div>
                </div>
              </div>

              <div style={arrowPill}>-&gt;</div>
            </div>

            <div style={cardText}>{item.description}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 18,
  fontFamily: "system-ui",
  background:
    "radial-gradient(circle at top left, rgba(20, 184, 166, 0.08), transparent 30%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 26%)",
};

const heroStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 28,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-end",
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#0f766e",
};

const titleStyle: React.CSSProperties = {
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  maxWidth: 760,
  fontSize: 14,
  lineHeight: 1.6,
  color: "#475569",
};

const badgeRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const miniBadge: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.82)",
  display: "grid",
  gap: 4,
  minWidth: 120,
};

const miniBadgeLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const miniBadgeValue: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  color: "#0f172a",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #dbe4ea",
  background: "#fff",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 900,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const cardStyle: React.CSSProperties = {
  display: "block",
  padding: 18,
  borderRadius: 22,
  border: "1px solid #dbe4ea",
  textDecoration: "none",
  color: "inherit",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.05)",
  minHeight: 146,
};

const iconBox: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  border: "1px solid #dbe4ea",
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  fontWeight: 900,
  color: "#0f172a",
  flex: "0 0 auto",
};

const arrowPill: React.CSSProperties = {
  minWidth: 36,
  textAlign: "center",
  padding: "5px 8px",
  borderRadius: 999,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontSize: 12,
  fontWeight: 900,
  color: "#334155",
};

const cardText: React.CSSProperties = {
  marginTop: 16,
  fontSize: 13,
  lineHeight: 1.55,
  color: "#475569",
};
