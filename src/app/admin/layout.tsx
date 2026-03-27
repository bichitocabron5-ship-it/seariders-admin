// src/app/admin/layout.tsx
import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || session.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div style={{ fontFamily: "system-ui" }}>
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "white",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 16px",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <a href="/admin" style={{ textDecoration: "none", color: "inherit" }}>
              <strong>SeaRiders</strong> <span style={{ opacity: 0.7 }}>· Admin</span>
            </a>
          </div>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Usuario: <strong>{session.username ?? session.userId}</strong>
          </div>
        </div>

        {/* Nav */}
        <div style={{ borderTop: "1px solid #f3f4f6" }}>
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "10px 16px",
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <a href="/admin/catalog" style={navLink}>
              Catálogo
            </a>
            <a href="/admin/pricing" style={navLink}>
              Precios
            </a>
            <a href="/admin/pricing/history" style={navLink}>
              Histórico
            </a>
            <a href="/admin/channels" style={navLink}>
              Canales y comisiones
            </a>
            <a href="/admin/discounts" style={navLink}>
              Descuentos
            </a>
            <a href="/admin/packs" style={navLink}>
              Packs
            </a>
            <a href="/admin/cash-closures" style={navLink}>
              Cierres de caja
            </a>
            <a href="/admin/gifts" style={navLink}>
              Regalos
            </a>
            <a href="/admin/slots" style={navLink}>
              Slots
            </a>
            <a href="/admin/passes" style={navLink}>
              Bonos
            </a>
            <a href="/admin/assets" style={navLink}>
              Náutica
            </a>
            <a href="/admin/jetskis" style={navLink}>
              JetSkis
            </a>
            <a href="/admin/hr" style={navLink}>
              Recursos Humanos
            </a>
            <a href="/admin/users" style={navLink}>
              Usuarios
            </a>
            <a href="/operations" style={navLink}>
              Centro de Operaciones
            </a>
            <a href="/executive" style={navLink}>
              Dashboard ejecutivo
            </a>
            <a href="/admin/expenses" style={navLink}>
              Gastos / Contabilidad
            </a>
            <a href="/admin/bar" style={navLink}>
              Stock Bar
            </a>
          </div>
        </div>
      </div>

      {/* Page */}
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

const navLink: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  fontSize: 13,
  background: "#fff",
};
