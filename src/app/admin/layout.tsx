import type { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";
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

const navItems = [
  { href: "/admin/catalog", label: "Catalogo" },
  { href: "/admin/pricing", label: "Precios" },
  { href: "/admin/pricing/history", label: "Historico" },
  { href: "/admin/channels", label: "Canales y comisiones" },
  { href: "/admin/discounts", label: "Descuentos" },
  { href: "/admin/packs", label: "Packs" },
  { href: "/admin/gifts", label: "Regalos" },
  { href: "/admin/passes", label: "Bonos" },
  { href: "/admin/cash-closures", label: "Cierres de caja" },
  { href: "/admin/slots", label: "Slots" },
  { href: "/admin/assets", label: "Nautica" },
  { href: "/admin/jetskis", label: "JetSkis" },
  { href: "/admin/hr", label: "Recursos humanos" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/expenses", label: "Gastos" },
  { href: "/admin/bar", label: "Bar" },
  { href: "/admin/design-system", label: "Design system" },
] as const;

const quickLinks = [
  { href: "/operations", label: "Centro operativo" },
  { href: "/executive", label: "Ejecutivo" },
  { href: "/admin/operations", label: "Salidas internas" },
] as const;

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

            <div className="admin-topbar__actions" aria-label="Accesos rapidos administrativos">
              {quickLinks.map((item) => (
                <Link key={item.href} href={item.href} className="admin-topbar__action">
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="admin-user-badge">
              <span>SeaRiders System</span>
              <strong>{session.username ?? session.userId}</strong>
            </div>
          </div>

          <div className="admin-nav__meta">
            <span className="admin-nav__eyebrow">Mapa administrativo</span>
            <span className="admin-nav__caption">Configuracion, control operativo y estructura interna en un solo punto.</span>
          </div>
          <nav className="admin-nav" aria-label="Navegacion de administracion">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="admin-nav__link">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="admin-page">{children}</div>
    </div>
  );
}
