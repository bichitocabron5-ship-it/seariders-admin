import type { Metadata } from "next";
import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { SeaRidersLogo } from "@/components/brand";
import { buildAdminMetadata } from "@/lib/admin-metadata";
import { sessionOptions, AppSession } from "@/lib/session";

export const metadata: Metadata = buildAdminMetadata({
  title: "Admin",
  description: "Configuracion comercial, operativa, flota y estructura interna de SeaRiders.",
});

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || session.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div>
      <div className="topbar-shell">
        <div className="topbar-shell__inner">
          <div className="admin-topbar">
            <div className="admin-brand">
              <SeaRidersLogo href="/admin" subtitle="Configuracion comercial, operativa y de flota" />
            </div>

            <div className="admin-user-badge">
              <span>SeaRiders System</span>
              <strong>{session.username ?? session.userId}</strong>
            </div>
          </div>

          <nav className="admin-nav" aria-label="Navegacion de administracion">
            <a href="/admin/catalog" className="admin-nav__link">
              Catalogo
            </a>
            <a href="/admin/pricing" className="admin-nav__link">
              Precios
            </a>
            <a href="/admin/pricing/history" className="admin-nav__link">
              Historico
            </a>
            <a href="/admin/channels" className="admin-nav__link">
              Canales y comisiones
            </a>
            <a href="/admin/discounts" className="admin-nav__link">
              Descuentos
            </a>
            <a href="/admin/packs" className="admin-nav__link">
              Packs
            </a>
            <a href="/admin/cash-closures" className="admin-nav__link">
              Cierres de caja
            </a>
            <a href="/admin/gifts" className="admin-nav__link">
              Regalos
            </a>
            <a href="/admin/design-system" className="admin-nav__link">
              Design system
            </a>
            <a href="/admin/slots" className="admin-nav__link">
              Slots
            </a>
            <a href="/admin/passes" className="admin-nav__link">
              Bonos
            </a>
            <a href="/admin/assets" className="admin-nav__link">
              Nautica
            </a>
            <a href="/admin/jetskis" className="admin-nav__link">
              JetSkis
            </a>
            <a href="/admin/hr" className="admin-nav__link">
              Recursos humanos
            </a>
            <a href="/admin/users" className="admin-nav__link">
              Usuarios
            </a>
            <a href="/operations" className="admin-nav__link">
              Centro operativo
            </a>
            <a href="/admin/operations" className="admin-nav__link">
              Salidas internas
            </a>
            <a href="/executive" className="admin-nav__link">
              Ejecutivo
            </a>
            <a href="/admin/expenses" className="admin-nav__link">
              Gastos
            </a>
            <a href="/admin/bar" className="admin-nav__link">
              Bar
            </a>
          </nav>
        </div>
      </div>

      <div className="admin-page">{children}</div>
    </div>
  );
}
