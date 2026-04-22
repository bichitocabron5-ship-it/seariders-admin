import { RoleName } from "@prisma/client";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SeaRidersLogo } from "@/components/brand";
import { brand } from "@/lib/brand";
import { type AppSession, sessionOptions } from "@/lib/session";

const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: "Administrador",
  STORE: "Tienda",
  PLATFORM: "Plataforma",
  BOOTH: "Carpa",
  BAR: "Bar",
  MECHANIC: "Mecanica",
  HR: "RR. HH.",
};

export default async function LoginSelectRolePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session.pendingLogin) {
    redirect("/login");
  }

  const params = await searchParams;
  const errorText =
    params.error === "invalid_role"
      ? "Selecciona un acceso valido para este usuario."
      : null;

  return (
    <div
      className="login-shell"
      style={{
        background: brand.gradients.publicHero,
      }}
    >
      <div className="login-card">
        <div
          className="login-aside"
          style={{
            padding: 32,
            background: brand.gradients.hero,
            color: "#f8fafc",
            display: "grid",
            gap: 20,
            alignContent: "space-between",
          }}
        >
          <div style={{ display: "grid", gap: 18 }}>
            <SeaRidersLogo light compact subtitle="Role selection" />
            <div style={{ fontSize: 42, lineHeight: 1.02, fontWeight: 950, maxWidth: 380 }}>
              Selecciona el acceso con el que vas a trabajar.
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.55, opacity: 0.88, maxWidth: 430 }}>
              El mismo usuario puede entrar con distintos perfiles. Elige el rol operativo que necesitas para este turno.
            </div>
          </div>

          <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
            <div>
              <strong>Usuario:</strong> {session.pendingLogin.username}
            </div>
            <div>
              <strong>Turno:</strong>{" "}
              {session.pendingLogin.shift === "MORNING" ? "Manana" : "Tarde"}
            </div>
          </div>
        </div>

        <div
          className="login-form-panel"
          style={{
            padding: 32,
            display: "grid",
            alignContent: "center",
            gap: 16,
            background: "rgba(255,255,255,0.9)",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: brand.colors.secondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Acceso
            </div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 950, color: brand.colors.primary }}>
              Elegir rol de entrada
            </h1>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              La sesion se abrira con el rol seleccionado y te llevara al modulo correcto.
            </div>
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #dbe4ea",
              background: "#f8fafc",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: brand.colors.primary, textTransform: "uppercase", letterSpacing: 0.04 }}>
              Roles disponibles
            </div>
            <div style={{ fontSize: 13, color: "#526277", lineHeight: 1.5 }}>
              {session.pendingLogin.roles.length} acceso(s) operativo(s) habilitado(s) para este usuario.
            </div>
          </div>

          {errorText ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#991b1b",
                fontWeight: 700,
              }}
            >
              {errorText}
            </div>
          ) : null}

          <form method="POST" action="/api/login/select-role" style={{ display: "grid", gap: 12 }}>
            {session.pendingLogin.roles.map((role) => (
              <button
                key={role}
                type="submit"
                name="role"
                value={role}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: "1px solid #d1dbe6",
                  background: "#fff",
                  textAlign: "left",
                  display: "grid",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 900, color: brand.colors.primary }}>
                  {ROLE_LABEL[role as RoleName] ?? role}
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{role}</span>
              </button>
            ))}
          </form>
        </div>
      </div>
    </div>
  );
}
