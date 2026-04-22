"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SeaRidersLogo } from "@/components/brand";
import { brand } from "@/lib/brand";

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
      ? "Usuario o contrasena incorrectos."
      : error === "no_role"
        ? "Tu usuario no tiene un rol asignado."
        : error === "invalid_form"
          ? "Formulario invalido."
          : error === "invalid_role"
            ? "El rol seleccionado no es valido para este usuario."
            : error === "session_expired"
              ? "La seleccion de acceso ha expirado. Vuelve a entrar."
              : null;

  return <LoginView errorText={errorText} />;
}

function LoginView({ errorText }: { errorText: string | null }) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #d1dbe6",
    background: "#fff",
  };

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
            <SeaRidersLogo light compact subtitle="Operations access" />
            <div style={{ fontSize: 42, lineHeight: 1.02, fontWeight: 950, maxWidth: 380 }}>
              Control operativo para tienda, plataforma y flota.
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.55, opacity: 0.88, maxWidth: 430 }}>
              Accede al panel diario con una identidad mas clara y una entrada preparada para operativa real, caja y reservas.
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
            background: "rgba(255,255,255,0.9)",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: brand.colors.secondary,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Login
            </div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 950, color: brand.colors.primary }}>
              Entrar al panel
            </h1>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              Usa tu usuario interno y selecciona el turno de trabajo.
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
              Acceso operativo
            </div>
            <div style={{ fontSize: 13, color: "#526277", lineHeight: 1.5 }}>
              Entrada para Store, Booth, Platform, Bar, HR y administracion interna de SeaRiders.
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
              Contrasena
              <input name="password" type="password" required style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: "#374151" }}>
              Turno
              <select name="shift" required style={inputStyle}>
                <option value="MORNING">Manana</option>
                <option value="AFTERNOON">Tarde</option>
              </select>
            </label>

            <button
              type="submit"
              style={{
                padding: 14,
                fontWeight: 900,
                borderRadius: 14,
                border: `1px solid ${brand.colors.primary}`,
                background: brand.colors.primary,
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
