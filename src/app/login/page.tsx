"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginView errorText={null} />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorText =
    error === "bad_credentials"
      ? "Usuario o contraseña incorrectos."
      : error === "no_role"
        ? "Tu usuario no tiene un rol asignado."
        : error === "invalid_form"
          ? "Formulario inválido."
          : error === "invalid_role"
            ? "El rol seleccionado no es válido para este usuario."
            : error === "session_expired"
              ? "La selección de acceso ha expirado. Vuelve a entrar."
              : null;

  return <LoginView errorText={errorText} />;
}

function LoginView({ errorText }: { errorText: string | null }) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
  };

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
              Control operativo para tienda, plataforma y flota.
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.55, opacity: 0.86, maxWidth: 420 }}>
              Accede al panel diario con una vista más limpia, rápida y preparada para caja,
              reservas y operativa real. Si tu usuario tiene varios accesos, podrás elegir el rol
              después de validar la contraseña.
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                opacity: 0.72,
                fontWeight: 800,
              }}
            >
              Usuarios frecuentes
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["mike", "charles", "tomas", "maria", "carlos", "moha", "gisela", "aaron", "jose", "mechanic"].map((name) => (
                <span
                  key={name}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {name}
                </span>
              ))}
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
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#0f766e",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Login
            </div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 950, color: "#111827" }}>
              Entrar al panel
            </h1>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              Usa tu usuario interno y selecciona el turno de trabajo.
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

          <form method="POST" action="/api/login" style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: "#374151" }}>
              Usuario
              <input name="username" required style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: "#374151" }}>
              Contraseña
              <input name="password" type="password" required style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: "#374151" }}>
              Turno
              <select name="shift" required style={inputStyle}>
                <option value="MORNING">Mañana</option>
                <option value="AFTERNOON">Tarde</option>
              </select>
            </label>

            <button
              type="submit"
              style={{
                padding: 14,
                fontWeight: 900,
                borderRadius: 14,
                border: "1px solid #0f172a",
                background: "#0f172a",
                color: "#fff",
              }}
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
