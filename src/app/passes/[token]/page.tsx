import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassPortalToken } from "@/lib/passes/public-pass-link";

export const runtime = "nodejs";

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
        background: "linear-gradient(180deg, #ecfeff 0%, #f8fafc 42%, #ffffff 100%)",
        padding: "32px 18px 64px",
        color: "#0f172a",
      }}
    >
      <div style={{ width: "min(920px, 100%)", margin: "0 auto", display: "grid", gap: 18 }}>
        <section
          style={{
            background: "#ffffffee",
            border: "1px solid #cbd5e1",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f766e" }}>
            Bono Seariders
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05 }}>{voucher.product?.name ?? "Bolsa de horas"}</h1>
              <div style={{ marginTop: 8, color: "#475569" }}>
                Codigo {voucher.code} · Servicio {voucher.product?.service?.name ?? "-"}
              </div>
            </div>
            <div style={{ padding: "10px 14px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontWeight: 900 }}>
              Bono activo
            </div>
          </div>
        </section>

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

        <section
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 24,
            padding: 24,
            display: "grid",
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Datos basicos</h2>
            <div style={{ marginTop: 6, color: "#64748b" }}>Mostramos solo la informacion necesaria para identificar tu bono y seguir su consumo.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <InfoCard label="Titular" value={voucher.buyerName || "-"} />
            <InfoCard label="Telefono" value={voucher.buyerPhone || "-"} />
            <InfoCard label="Email" value={voucher.buyerEmail || "-"} />
            <InfoCard label="Fecha de compra" value={formatDateTime(voucher.soldAt)} />
          </div>
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 24,
            padding: 24,
            display: "grid",
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Historial de consumos</h2>
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
                  <div style={{ fontWeight: 900, fontSize: 20, color: "#b91c1c" }}>-{consume.minutesUsed} min</div>
                </article>
              ))}
            </div>
          ) : (
            <div style={{ color: "#64748b" }}>Todavia no hay consumos registrados.</div>
          )}
        </section>
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
