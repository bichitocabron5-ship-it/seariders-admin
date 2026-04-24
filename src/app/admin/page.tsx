import Link from "next/link";
import type { Metadata } from "next";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Panel Admin",
  description: "Entrada centralizada al panel de administracion de SeaRiders.",
});

type AdminSection = "Comercial" | "Operativa" | "Flota" | "Personal";

type AdminCard = {
  href: string;
  tag: string;
  icon: string;
  title: string;
  description: string;
  section: AdminSection;
  accent: string;
};

const cards: AdminCard[] = [
  { href: "/admin/catalog", tag: "CAT", icon: "[]", title: "Catálogo", description: "Servicios, opciones y estructura operativa.", section: "Comercial", accent: "#dbeafe" },
  { href: "/admin/pricing", tag: "PVP", icon: "$", title: "Precios", description: "Tarifas, importes y configuración comercial.", section: "Comercial", accent: "#dbeafe" },
  { href: "/admin/discounts", tag: "DSC", icon: "%", title: "Descuentos", description: "Campañas, reglas y promociones activas.", section: "Comercial", accent: "#dbeafe" },
  { href: "/admin/channels", tag: "CHN", icon: ">>", title: "Canales", description: "Canales de venta y comisiones asociadas.", section: "Comercial", accent: "#dbeafe" },
  { href: "/admin/pricing/history", tag: "LOG", icon: "H:", title: "Histórico de precios", description: "Seguimiento de cambios y trazabilidad.", section: "Comercial", accent: "#dbeafe" },
  { href: "/admin/packs", tag: "PKG", icon: "PK", title: "Packs", description: "Configuración y gestión de packs comerciales.", section: "Comercial", accent: "#dbeafe" },
  { href: "/admin/gifts", tag: "GFT", icon: "GF", title: "Regalos", description: "Gift vouchers y control de canjes.", section: "Comercial", accent: "#dbeafe" },
  { href: "/admin/passes", tag: "BON", icon: "BO", title: "Bonos", description: "Bonos, consumos y seguimiento.", section: "Comercial", accent: "#dbeafe" },
  { href: "/executive", tag: "OPS", icon: "BI", title: "Dashboard operativo", description: "Dirección, rendimiento y salud del negocio.", section: "Operativa", accent: "#ccfbf1" },
  { href: "/operations", tag: "CTR", icon: "OP", title: "Centro de operaciones", description: "Visión unificada de Booth, Store y Platform con alertas, contratos y extras pendientes.", section: "Operativa", accent: "#ccfbf1" },
  { href: "/admin/operations", tag: "INT", icon: "SI", title: "Salidas internas", description: "Control operativo de salidas de staff con trazabilidad y vínculo opcional a trabajador.", section: "Operativa", accent: "#ccfbf1" },
  { href: "/store", tag: "STO", icon: "ST", title: "Store", description: "Caja, calendario, creación y operativa diaria de tienda.", section: "Operativa", accent: "#ccfbf1" },
  { href: "/platform", tag: "PLT", icon: "PF", title: "Platform", description: "Cola operativa, salidas, asignaciones y gestión de extras de plataforma.", section: "Operativa", accent: "#ccfbf1" },
  { href: "/admin/cash-closures", tag: "BOX", icon: "CA", title: "Cierres de caja", description: "Turnos, cierres y control de caja.", section: "Operativa", accent: "#ccfbf1" },
  { href: "/admin/expenses", tag: "EXP", icon: "EX", title: "Gastos", description: "Contabilidad operativa, proveedores y categorías.", section: "Operativa", accent: "#ccfbf1" },
  { href: "/admin/slots", tag: "SLT", icon: "TM", title: "Slots", description: "Disponibilidad, cupos y reglas de reserva.", section: "Operativa", accent: "#ccfbf1" },
  { href: "/admin/bar", tag: "BAR", icon: "BA", title: "Bar", description: "Catalogo, stock y accesos al flujo operativo del punto BAR.", section: "Operativa", accent: "#ccfbf1" },
  { href: "/admin/assets", tag: "AST", icon: "NA", title: "Náutica", description: "Boats, towboat, jetcar y otros recursos.", section: "Flota", accent: "#ede9fe" },
  { href: "/admin/jetskis", tag: "JSK", icon: "JS", title: "Jetskis", description: "Flota, matricula, horas y service.", section: "Flota", accent: "#ede9fe" },
  { href: "/admin/hr", tag: "HR", icon: "HR", title: "Recursos humanos", description: "Trabajadores, perfiles y organizacion interna.", section: "Personal", accent: "#dcfce7" },
  { href: "/admin/users", tag: "USR", icon: "ID", title: "Usuarios", description: "Accesos, roles, credenciales y passport.", section: "Personal", accent: "#dcfce7" },
];

const sections: AdminSection[] = ["Comercial", "Operativa", "Flota", "Personal"];

const sectionThemes: Record<AdminSection, { bg: string; ink: string }> = {
  Comercial: { bg: "#eff6ff", ink: "#1d4ed8" },
  Operativa: { bg: "#ecfeff", ink: "#0f766e" },
  Flota: { bg: "#f5f3ff", ink: "#6d28d9" },
  Personal: { bg: "#f0fdf4", ink: "#15803d" },
};

export default function AdminHome() {
  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Administracion</div>
          <h1 style={titleStyle}>Panel Admin</h1>
          <p style={subtitleStyle}>
            Acceso centralizado a configuración comercial, operación, flota y equipo. Store, Platform y el centro operativo quedan visibles como entrada diaria.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/operations" style={heroGhostLink}>
            Abrir centro operativo
          </Link>
          <Link href="/executive" style={heroLink}>
            Abrir dashboard operativo
          </Link>
        </div>
      </section>

      {sections.map((section) => {
        const items = cards.filter((card) => card.section === section);
        const theme = sectionThemes[section];

        return (
          <section key={section} style={{ display: "grid", gap: 12 }}>
            <div style={sectionHeader}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 950, color: "#0f172a" }}>{section}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {section === "Operativa"
                    ? "Herramientas de control, caja, seguimiento diario y coordinacion entre Booth, Store y Platform."
                    : section === "Comercial"
                      ? "Configuracion de oferta, precios y venta."
                      : section === "Flota"
                        ? "Gestión de activos y mantenimiento de flota."
                        : "Gestión de personal, accesos y estructura interna."}
                </div>
              </div>

              <div style={{ ...countPill, background: theme.bg, color: theme.ink }}>
                {items.length} módulos
              </div>
            </div>

            <div style={gridStyle}>
              {items.map((item) => (
                <Link key={item.href} href={item.href} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ ...iconBox, background: item.accent }}>{item.icon}</div>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontSize: 16, fontWeight: 950, color: "#0f172a" }}>{item.title}</div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>{item.tag}</div>
                      </div>
                    </div>

                    <div style={arrowPill}>-&gt;</div>
                  </div>

                  <div style={cardText}>{item.description}</div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1360,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 18,
  fontFamily: "system-ui",
  background:
    "radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 30%), radial-gradient(circle at top right, rgba(20, 184, 166, 0.08), transparent 24%)",
};

const heroStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 28,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #eef2ff 100%)",
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
  color: "#2563eb",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
};

const heroLink: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 950,
};

const heroGhostLink: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #dbe4ea",
  background: "#fff",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 950,
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const countPill: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #dbe4ea",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 12,
};

const cardStyle: React.CSSProperties = {
  display: "block",
  padding: 16,
  borderRadius: 20,
  border: "1px solid #dbe4ea",
  textDecoration: "none",
  color: "inherit",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.05)",
  minHeight: 126,
};

const iconBox: React.CSSProperties = {
  width: 46,
  height: 46,
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
  marginTop: 14,
  fontSize: 13,
  lineHeight: 1.5,
  color: "#475569",
};
