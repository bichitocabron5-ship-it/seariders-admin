"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { PublicBrandHeader } from "@/components/brand";
import { ActionButton, AlertBanner, SectionCard, StatusBadge } from "@/components/seariders-ui";
import { brand } from "@/lib/brand";
import { getPublicCopy, type PublicLanguage } from "@/lib/public-links/i18n";

type ContractView = {
  id: string;
  unitIndex: number;
  status: string;
  driverName: string;
  signatureSignedBy: string;
  signedAt: string | null;
  reservationId: string;
  customerName: string;
  serviceName: string;
  durationMinutes: number | null;
  activityDate: string;
  renderedHtml: string;
};

export function SignContractPageClient({
  token,
  language,
  contract,
}: {
  token: string;
  language: PublicLanguage;
  contract: ContractView;
}) {
  const copy = getPublicCopy(language);
  const sigRef = useRef<SignatureCanvas | null>(null);
  const sigContainerRef = useRef<HTMLDivElement | null>(null);
  const [signerName, setSignerName] = useState(contract.driverName || contract.customerName || "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(contract.status === "SIGNED");
  const [confirmedRead, setConfirmedRead] = useState(contract.status === "SIGNED");
  const [imageConsentAccepted, setImageConsentAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resizeSignaturePad = useCallback(() => {
    const pad = sigRef.current;
    const container = sigContainerRef.current;
    if (!pad || !container) return;

    const canvas = pad.getCanvas();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = Math.max(Math.floor(container.getBoundingClientRect().width), 280);
    const height = 280;
    const data = !pad.isEmpty() ? pad.toDataURL("image/png") : null;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);

    pad.clear();

    if (data) {
      pad.fromDataURL(data, {
        ratio,
        width,
        height,
      });
    }
  }, []);

  useEffect(() => {
    resizeSignaturePad();
    window.addEventListener("resize", resizeSignaturePad);
    return () => window.removeEventListener("resize", resizeSignaturePad);
  }, [resizeSignaturePad]);

  async function handleSave() {
    try {
      setError(null);
      if (!confirmedRead) throw new Error(copy.signPage.errors.mustRead);
      if (!signerName.trim()) throw new Error(copy.signPage.errors.signerRequired);
      if (!sigRef.current || sigRef.current.isEmpty()) throw new Error(copy.signPage.errors.signatureEmpty);

      setBusy(true);
      const imageDataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
      const res = await fetch(`/api/sign/contracts/${encodeURIComponent(token)}/signature?lang=${encodeURIComponent(language)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          imageDataUrl,
          imageConsentAccepted,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy.signPage.errors.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: brand.gradients.publicHero,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <section
        style={{
          width: "min(980px, 100%)",
          display: "grid",
          gap: 16,
        }}
      >
        <PublicBrandHeader
          eyebrow={copy.signPage.eyebrow}
          title={copy.signPage.title(contract.unitIndex)}
          subtitle="Firma remota de contrato con identidad visual alineada a SeaRiders."
        />

        <SectionCard
          eyebrow="Firma digital"
          title={copy.signPage.title(contract.unitIndex)}
          action={<StatusBadge tone={done ? "success" : "info"}>{done ? copy.signPage.done : copy.signPage.eyebrow}</StatusBadge>}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 14, color: "#475569" }}>
              {contract.serviceName}
              {contract.durationMinutes ? ` | ${contract.durationMinutes} min` : ""}
              {contract.customerName ? ` | ${contract.customerName}` : ""}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge tone="neutral">{contract.serviceName}</StatusBadge>
              {contract.durationMinutes ? <StatusBadge tone="neutral">{contract.durationMinutes} min</StatusBadge> : null}
              {contract.customerName ? <StatusBadge tone="neutral">{contract.customerName}</StatusBadge> : null}
            </div>
          </div>

          {done ? (
            <AlertBanner tone="success">{copy.signPage.done}</AlertBanner>
          ) : (
            <AlertBanner tone="info">{copy.signPage.intro}</AlertBanner>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ActionButton
              href={`/api/sign/contracts/${encodeURIComponent(token)}/pdf?lang=${encodeURIComponent(language)}`}
              target="_blank"
              rel="noreferrer"
            >
              {copy.signPage.download}
            </ActionButton>
          </div>

          <div style={{ fontSize: 12, color: "#64748b" }}>
            {copy.signPage.pdfHint}
          </div>

        <div style={{ border: "1px solid #cbd5e1", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <iframe
            title={`Contract ${contract.unitIndex}`}
            srcDoc={contract.renderedHtml}
            style={{
              width: "100%",
              height: "min(70vh, 980px)",
              border: 0,
              display: "block",
              background: "#fff",
            }}
          />
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
          <input
            type="checkbox"
            checked={confirmedRead}
            onChange={(e) => setConfirmedRead(e.target.checked)}
            disabled={done}
            style={{ marginTop: 2 }}
          />
          <span>{copy.signPage.readConfirm}</span>
        </label>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
          <input
            type="checkbox"
            checked={imageConsentAccepted}
            onChange={(e) => setImageConsentAccepted(e.target.checked)}
            disabled={done}
            style={{ marginTop: 2 }}
          />
          <span>{copy.signPage.imageConsent}</span>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
          {copy.signPage.signerName}
          <input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            disabled={done}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 16 }}
          />
        </label>

        <div ref={sigContainerRef} style={{ border: "1px solid #cbd5e1", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <SignatureCanvas
            ref={sigRef}
            penColor="black"
            canvasProps={{
              style: {
                width: "100%",
                height: 280,
                display: "block",
                background: "#fff",
                touchAction: "none",
              },
            }}
          />
        </div>

        {error ? (
          <AlertBanner tone="danger">{error}</AlertBanner>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <ActionButton
            onClick={() => sigRef.current?.clear()}
            disabled={busy || done}
            variant="secondary"
          >
            {copy.signPage.clear}
          </ActionButton>
          <ActionButton
            onClick={() => void handleSave()}
            disabled={busy || done || !confirmedRead}
            style={busy || done || !confirmedRead ? { opacity: 0.7 } : undefined}
          >
            {busy ? copy.signPage.saving : done ? copy.signPage.signed : copy.signPage.sign}
          </ActionButton>
        </div>
        </SectionCard>
      </section>
    </main>
  );
}
