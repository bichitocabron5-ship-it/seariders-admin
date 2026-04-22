import { SeaRidersLogo } from "@/components/brand";
import {
  ActionButton,
  AlertBanner,
  SectionCard,
  StatusBadge,
} from "@/components/seariders-ui";
import { brand } from "@/lib/brand";

export default function AdminDesignSystemPage() {
  return (
    <div
      style={{
        width: "min(1120px, 100%)",
        margin: "0 auto",
        display: "grid",
        gap: 18,
      }}
    >
      <SectionCard
        eyebrow="SeaRiders Visual Base"
        title="Preview de sistema visual"
        action={<StatusBadge tone="info">Fase A</StatusBadge>}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <SeaRidersLogo subtitle="Base visual reutilizable para aplicacion gradual" />
          <div style={{ color: "#526277", lineHeight: 1.6, maxWidth: 760 }}>
            Esta pagina valida la base compartida de marca sin extender aun el rediseño al resto de modulos.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ActionButton href="/admin" variant="primary">
              Volver a admin
            </ActionButton>
            <ActionButton href="/admin/design-system" variant="secondary">
              Recargar preview
            </ActionButton>
          </div>
        </div>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <SectionCard eyebrow="Buttons" title="Acciones base">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ActionButton variant="primary">Accion principal</ActionButton>
            <ActionButton variant="secondary">Accion secundaria</ActionButton>
          </div>
        </SectionCard>

        <SectionCard eyebrow="States" title="Estados y feedback">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <StatusBadge>Neutral</StatusBadge>
            <StatusBadge tone="success">Operativo</StatusBadge>
            <StatusBadge tone="info">En revision</StatusBadge>
            <StatusBadge tone="warning">Pendiente</StatusBadge>
            <StatusBadge tone="danger">Bloqueado</StatusBadge>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <AlertBanner tone="info" title="Aviso">
              Banner base para mensajes operativos o informativos.
            </AlertBanner>
            <AlertBanner tone="danger" title="Alerta">
              Variante lista para errores visibles sin inventar estilos pantalla a pantalla.
            </AlertBanner>
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Tokens" title="Base SeaRiders">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {[
            { label: "Primario", value: brand.colors.primary },
            { label: "Secundario", value: brand.colors.secondary },
            { label: "Exito", value: brand.colors.success },
            { label: "Alerta", value: brand.colors.warning },
            { label: "Error", value: brand.colors.danger },
          ].map((token) => (
            <div
              key={token.label}
              style={{
                border: `1px solid ${brand.colors.border}`,
                borderRadius: 16,
                padding: 14,
                background: "#fff",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>
                {token.label}
              </div>
              <div
                style={{
                  height: 42,
                  borderRadius: 12,
                  background: token.value,
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                }}
              />
              <code style={{ color: "#31455f" }}>{token.value}</code>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
