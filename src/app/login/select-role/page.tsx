import { RoleName } from "@prisma/client";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { type AppSession, sessionOptions } from "@/lib/session";

const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: "Administrador",
  STORE: "Tienda",
  PLATFORM: "Plataforma",
  BOOTH: "Carpa",
  BAR: "Bar",
  MECHANIC: "Mecánica",
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
      ? "Selecciona un acceso válido para este usuario."
      : null;

  return (
    <div
      className="login-shell"
      style={{
        background: "linear-gradient(135deg, #e0f2fe 0%, #f8fafc 45%, #ecfccb 100%)",
      }}
    >
      <div className="login-card">
        <div
          className="login-aside"
          style={{
            padding: 32,
            background: "linear-gradient(160deg, #082f49 0%, #0f766e 55%, #164e63 100%)",
            color: "#f8fafc",
            display: "grid",
            gap: 18,
            alignContent: "space-between",
          }}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              SeaRiders Admin
            </div>
            <div style={{ fontSize: 42, lineHeight: 1.02, fontWeight: 950, maxWidth: 360 }}>
              Selecciona el acceso con el que vas a trabajar.
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.55, opacity: 0.86, maxWidth: 420 }}>
              El mismo usuario puede entrar con distintos perfiles. Elige el rol operativo que
              necesitas para este turno.
            </div>
          </div>

          <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
            <div>
              <strong>Usuario:</strong> {session.pendingLogin.username}
            </div>
            <div>
              <strong>Turno:</strong>{" "}
              {session.pendingLogin.shift === "MORNING" ? "Mañana" : "Tarde"}
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
            background: "rgba(255,255,255,0.88)",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f766e", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Acceso
            </div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 950, color: "#111827" }}>
              Elegir rol de entrada
            </h1>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              La sesión se abrirá con el rol seleccionado y te llevará al módulo correcto.
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
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  textAlign: "left",
                  display: "grid",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
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
