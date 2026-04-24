import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicBrandHeader } from "@/components/brand";
import { AlertBanner, SectionCard, StatusBadge } from "@/components/seariders-ui";
import { brand } from "@/lib/brand";
import { buildPublicPageMetadata } from "@/lib/metadata";
import { verifyPassPortalToken } from "@/lib/passes/public-pass-link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return buildPublicPageMetadata({
    title: "Bono SeaRiders",
    description: "Portal publico para consultar saldo y movimientos de bonos SeaRiders.",
    path: `/passes/${encodeURIComponent(token)}`,
  });
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(value);
}

export default async function PassPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = verifyPassPortalToken(token);
  if (!payload) notFound();

  const voucher = await prisma.passVoucher.findUnique({
    where: { id: payload.voucherId },
    select: {
      code: true,
      soldAt: true,
      expiresAt: true,
      buyerName: true,
      buyerPhone: true,
      buyerEmail: true,
      minutesTotal: true,
      minutesRemaining: true,
      product: {
        select: {
          name: true,
          service: { select: { name: true } },
        },
      },
      consumes: {
        orderBy: { consumedAt: "desc" },
        take: 25,
        select: {
          id: true,
          consumedAt: true,
          minutesUsed: true,
          reservation: {
            select: {
              activityDate: true,
              scheduledTime: true,
            },
          },
        },
      },
    },
  });

  if (!voucher) notFound();

  const consumed = Math.max(0, Number(voucher.minutesTotal) - Number(voucher.minutesRemaining));

  return (
    <main
      style={{
        minHeight: "100vh",
        background: brand.gradients.publicHero,
        padding: "32px 18px 64px",
        color: brand.colors.primary,
      }}
    >
      <div style={{ width: "min(920px, 100%)", margin: "0 auto", display: "grid", gap: 18 }}>
        <PublicBrandHeader
          eyebrow="Bono SeaRiders"
          title={voucher.product?.name ?? "Bolsa de horas"}
          subtitle="Consulta de saldo y consumos dentro del portal publico de SeaRiders."
        />

        <SectionCard
          eyebrow="Portal de bonos"
          title={voucher.product?.name ?? "Bolsa de horas"}
          action={<StatusBadge tone="success">Bono activo</StatusBadge>}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ marginTop: 8, color: "#475569" }}>
                Codigo {voucher.code} | Servicio {voucher.product?.service?.name ?? "-"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <StatusBadge tone="neutral">Codigo {voucher.code}</StatusBadge>
                <StatusBadge tone="neutral">Servicio {voucher.product?.service?.name ?? "-"}</StatusBadge>
              </div>
            </div>
          </div>
        </SectionCard>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {[
            { label: "Contratadas", value: `${voucher.minutesTotal} min` },
            { label: "Gastadas", value: `${consumed} min` },
            { label: "Pendientes", value: `${voucher.minutesRemaining} min` },
            { label: "Caducidad", value: voucher.expiresAt ? formatDateTime(voucher.expiresAt) : "Sin caducidad" },
          ].map((item) => (
            <article
              key={item.label}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 20,
                padding: 18,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{item.value}</div>
            </article>
          ))}
        </section>

        <SectionCard eyebrow="Identificacion" title="Datos basicos">
          <div>
            <div style={{ marginTop: 6, color: "#64748b" }}>Mostramos solo la informacion necesaria para identificar tu bono y seguir su consumo.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <InfoCard label="Titular" value={voucher.buyerName || "-"} />
            <InfoCard label="Telefono" value={voucher.buyerPhone || "-"} />
            <InfoCard label="Email" value={voucher.buyerEmail || "-"} />
            <InfoCard label="Fecha de compra" value={formatDateTime(voucher.soldAt)} />
          </div>
        </SectionCard>

        <SectionCard eyebrow="Actividad" title="Historial de consumos">
          <div>
            <div style={{ marginTop: 6, color: "#64748b" }}>Ultimos movimientos registrados sobre esta bolsa de horas.</div>
          </div>

          {voucher.consumes.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {voucher.consumes.map((consume) => (
                <article
                  key={consume.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 18,
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 800 }}>{formatDateTime(consume.consumedAt)}</div>
                    <div style={{ color: "#64748b", fontSize: 14 }}>
                      Actividad {formatDateTime(consume.reservation?.scheduledTime ?? consume.reservation?.activityDate ?? null)}
                    </div>
                  </div>
                  <StatusBadge tone="danger">-{consume.minutesUsed} min</StatusBadge>
                </article>
              ))}
            </div>
          ) : (
            <AlertBanner tone="info">Todavia no hay consumos registrados.</AlertBanner>
          )}
        </SectionCard>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article style={{ padding: 16, borderRadius: 18, border: "1px solid #e2e8f0", background: "#f8fafc", display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
    </article>
  );
}
