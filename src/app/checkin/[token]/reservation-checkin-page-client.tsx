"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import {
  formatPublicDate,
  formatPublicTime,
  getPublicCopy,
  type PublicLanguage,
} from "@/lib/public-links/i18n";

type ReservationView = {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  marketing: string | null;
  customerCountry: string | null;
  customerAddress: string | null;
  customerPostalCode: string | null;
  customerBirthDate: string | null;
  customerDocType: string | null;
  customerDocNumber: string | null;
  isLicense: boolean;
  activityDate: string;
  scheduledTime: string | null;
  serviceName: string;
  serviceCategory: string | null;
  durationMinutes: number | null;
  requiredUnits: number;
  readyCount: number;
  signedCount: number;
};

type ContractView = {
  id: string;
  unitIndex: number;
  status: string;
  driverName: string | null;
  driverPhone: string | null;
  driverEmail: string | null;
  driverCountry: string | null;
  driverAddress: string | null;
  driverPostalCode: string | null;
  driverDocType: string | null;
  driverDocNumber: string | null;
  driverBirthDate: string | null;
  minorNeedsAuthorization: boolean;
  minorAuthorizationProvided: boolean;
  minorAuthorizationFileName: string | null;
  licenseSchool: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
  imageConsentAccepted: boolean;
  signedAt: string | null;
  signatureSignedBy: string | null;
  preparedResourceLabel: string;
  renderedHtml: string;
};

type Snapshot = {
  reservation: ReservationView;
  contracts: ContractView[];
};

type DraftContract = {
  id: string;
  driverName: string;
  driverPhone: string;
  driverEmail: string;
  driverCountry: string;
  driverAddress: string;
  driverPostalCode: string;
  driverDocType: string;
  driverDocNumber: string;
  driverBirthDate: string;
  minorAuthorizationProvided: boolean;
  imageConsentAccepted: boolean;
  licenseSchool: string;
  licenseType: string;
  licenseNumber: string;
};

function autosaveTone(state: "idle" | "saving" | "saved" | "error", copy: ReturnType<typeof getPublicCopy>) {
  if (state === "saving") return { label: copy.checkinPage.autosaveSaving, color: "#1d4ed8" };
  if (state === "saved") return { label: copy.checkinPage.autosaveSaved, color: "#166534" };
  if (state === "error") return { label: copy.checkinPage.autosaveError, color: "#991b1b" };
  return { label: copy.checkinPage.autosaveIdle, color: "#475569" };
}

export function ReservationCheckinPageClient({
  token,
  language,
}: {
  token: string;
  language: PublicLanguage;
}) {
  const copy = getPublicCopy(language);
  const sigRefs = useRef<Record<string, SignatureCanvas | null>>({});
  const lastSavedPayloadRef = useRef<string>("");
  const autosaveTimerRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reservationDraft, setReservationDraft] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    marketing: "",
    customerCountry: "",
    customerAddress: "",
    customerPostalCode: "",
    customerBirthDate: "",
    customerDocType: "",
    customerDocNumber: "",
  });
  const [contractDrafts, setContractDrafts] = useState<Record<string, DraftContract>>({});

  const serializePayload = useCallback((reservation: typeof reservationDraft, drafts: Record<string, DraftContract>) => {
    return JSON.stringify({
      reservation,
      contracts: Object.values(drafts)
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id)),
    });
  }, []);

  const hydrate = useCallback((data: Snapshot) => {
    setSnapshot(data);
    const nextReservationDraft = {
      customerName: data.reservation.customerName ?? "",
      customerPhone: data.reservation.customerPhone ?? "",
      customerEmail: data.reservation.customerEmail ?? "",
      marketing: data.reservation.marketing ?? "",
      customerCountry: data.reservation.customerCountry ?? "ES",
      customerAddress: data.reservation.customerAddress ?? "",
      customerPostalCode: data.reservation.customerPostalCode ?? "",
      customerBirthDate: data.reservation.customerBirthDate ? data.reservation.customerBirthDate.slice(0, 10) : "",
      customerDocType: data.reservation.customerDocType ?? "",
      customerDocNumber: data.reservation.customerDocNumber ?? "",
    };
    setReservationDraft(nextReservationDraft);

    const nextDrafts: Record<string, DraftContract> = {};
    for (const contract of data.contracts) {
      nextDrafts[contract.id] = {
        id: contract.id,
        driverName: contract.driverName ?? "",
        driverPhone: contract.driverPhone ?? "",
        driverEmail: contract.driverEmail ?? "",
        driverCountry: contract.driverCountry ?? data.reservation.customerCountry ?? "ES",
        driverAddress: contract.driverAddress ?? "",
        driverPostalCode: contract.driverPostalCode ?? "",
        driverDocType: contract.driverDocType ?? "",
        driverDocNumber: contract.driverDocNumber ?? "",
        driverBirthDate: contract.driverBirthDate ? contract.driverBirthDate.slice(0, 10) : "",
        minorAuthorizationProvided: Boolean(contract.minorAuthorizationProvided),
        imageConsentAccepted: Boolean(contract.imageConsentAccepted),
        licenseSchool: contract.licenseSchool ?? "",
        licenseType: contract.licenseType ?? "",
        licenseNumber: contract.licenseNumber ?? "",
      };
    }
    setContractDrafts(nextDrafts);
    lastSavedPayloadRef.current = serializePayload(nextReservationDraft, nextDrafts);
    setAutosaveState("idle");
  }, [serializePayload]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/public/checkin/${encodeURIComponent(token)}?lang=${encodeURIComponent(language)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { reservation: ReservationView; contracts: ContractView[] };
        hydrate(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : copy.checkinPage.loadFailed);
      } finally {
        setLoading(false);
      }
    })();
  }, [copy.checkinPage.loadFailed, hydrate, language, token]);

  const persistAll = useCallback(async (mode: "manual" | "autosave") => {
    try {
      if (mode === "manual") {
        setSaving(true);
        setError(null);
        setSuccess(null);
      } else {
        setAutosaveState("saving");
      }

      const serialized = serializePayload(reservationDraft, contractDrafts);
      const res = await fetch(`/api/public/checkin/${encodeURIComponent(token)}?lang=${encodeURIComponent(language)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation: {
            ...reservationDraft,
            customerBirthDate: reservationDraft.customerBirthDate ? new Date(`${reservationDraft.customerBirthDate}T00:00:00.000Z`).toISOString() : null,
          },
          contracts: Object.values(contractDrafts).map((draft) => ({
            ...draft,
            driverBirthDate: draft.driverBirthDate ? new Date(`${draft.driverBirthDate}T00:00:00.000Z`).toISOString() : null,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Snapshot;
      hydrate(data);
      lastSavedPayloadRef.current = serialized;
      if (mode === "manual") {
        setSuccess(copy.checkinPage.saved);
      } else {
        setAutosaveState("saved");
      }
      return true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : copy.checkinPage.loadFailed;
      setError(message);
      if (mode === "autosave") setAutosaveState("error");
      return false;
    } finally {
      if (mode === "manual") setSaving(false);
    }
  }, [contractDrafts, copy.checkinPage.loadFailed, copy.checkinPage.saved, hydrate, language, reservationDraft, serializePayload, token]);

  const saveAll = useCallback(async () => await persistAll("manual"), [persistAll]);

  async function signContract(contractId: string) {
    const signature = sigRefs.current[contractId];
    const draft = contractDrafts[contractId];
    if (!draft) return;

    try {
      setSigningId(contractId);
      setError(null);
      setSuccess(null);

      const saved = await persistAll("manual");
      if (!saved) return;
      if (!signature || signature.isEmpty()) throw new Error(copy.signPage.errors.signatureEmpty);
      if (!draft.driverName.trim() && !reservationDraft.customerName.trim()) throw new Error(copy.signPage.errors.signerRequired);

      const signerName = draft.driverName.trim() || reservationDraft.customerName.trim();
      const res = await fetch(`/api/public/checkin/${encodeURIComponent(token)}/contracts/${contractId}/signature?lang=${encodeURIComponent(language)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName,
          imageDataUrl: signature.getTrimmedCanvas().toDataURL("image/png"),
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      const refresh = await fetch(`/api/public/checkin/${encodeURIComponent(token)}?lang=${encodeURIComponent(language)}`, {
        cache: "no-store",
      });
      if (!refresh.ok) throw new Error(await refresh.text());
      const data = (await refresh.json()) as Snapshot;
      hydrate(data);
      signature.clear();
      setSuccess(copy.checkinPage.signedBanner(signerName, formatPublicDate(new Date().toISOString(), language)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy.checkinPage.loadFailed);
    } finally {
      setSigningId(null);
    }
  }

  function copyHolderToContract(contractId: string) {
    setContractDrafts((current) => {
      const draft = current[contractId];
      if (!draft) return current;

      return {
        ...current,
        [contractId]: {
          ...draft,
          driverName: reservationDraft.customerName,
          driverPhone: reservationDraft.customerPhone,
          driverEmail: reservationDraft.customerEmail,
          driverCountry: reservationDraft.customerCountry,
          driverAddress: reservationDraft.customerAddress,
          driverPostalCode: reservationDraft.customerPostalCode,
          driverDocType: reservationDraft.customerDocType,
          driverDocNumber: reservationDraft.customerDocNumber,
          driverBirthDate: reservationDraft.customerBirthDate,
        },
      };
    });
  }

  useEffect(() => {
    if (!snapshot || loading) return;
    if (saving || signingId) return;

    const serialized = serializePayload(reservationDraft, contractDrafts);
    if (serialized === lastSavedPayloadRef.current) return;

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistAll("autosave");
    }, 1200);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [snapshot, loading, saving, signingId, reservationDraft, contractDrafts, persistAll, serializePayload]);

  if (loading) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#475569" }}>{copy.checkinPage.loading}</main>;
  }

  if (!snapshot) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#991b1b", padding: 24 }}>{error ?? copy.checkinPage.loadFailed}</main>;
  }

  const autosave = autosaveTone(autosaveState, copy);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
        padding: "24px 16px 40px",
      }}
    >
      <section
        style={{
          width: "min(1120px, 100%)",
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            border: "1px solid #e2e8f0",
            padding: 20,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f766e" }}>
              {copy.checkinPage.eyebrow}
            </div>
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>{copy.checkinPage.title}</h1>
            <div style={{ color: "#475569", fontSize: 14 }}>
              {snapshot.reservation.serviceName}
              {snapshot.reservation.durationMinutes ? ` | ${snapshot.reservation.durationMinutes} min` : ""}
              {` | ${formatPublicDate(snapshot.reservation.activityDate, language)} | ${formatPublicTime(snapshot.reservation.scheduledTime, language)}`}
            </div>
            <div style={{ fontSize: 12, color: autosave.color, fontWeight: 800 }}>
              {autosave.label}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <MetricCard label={copy.checkinPage.metrics.contracts} value={`${snapshot.reservation.signedCount}/${snapshot.reservation.requiredUnits}`} description={copy.checkinPage.metrics.signed} />
            <MetricCard label={copy.checkinPage.metrics.ready} value={`${snapshot.reservation.readyCount}/${snapshot.reservation.requiredUnits}`} description={copy.checkinPage.metrics.prepared} />
            <MetricCard label={copy.checkinPage.metrics.holder} value={reservationDraft.customerName || copy.checkinPage.metrics.pending} description={copy.checkinPage.metrics.holder} />
          </div>

          <div style={{ padding: 14, borderRadius: 16, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontSize: 14 }}>
            {copy.checkinPage.intro}
          </div>

          {error ? <Banner tone="error" text={error} /> : null}
          {success ? <Banner tone="success" text={success} /> : null}

          <section style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{copy.checkinPage.holderTitle}</h2>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>
              {copy.common.requiredFields}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Field label={copy.checkinPage.holderName} value={reservationDraft.customerName} onChange={(value) => setReservationDraft((current) => ({ ...current, customerName: value }))} />
              <Field label={copy.checkinPage.holderPhone} value={reservationDraft.customerPhone} onChange={(value) => setReservationDraft((current) => ({ ...current, customerPhone: value }))} />
              <Field label={copy.checkinPage.holderEmail} value={reservationDraft.customerEmail} onChange={(value) => setReservationDraft((current) => ({ ...current, customerEmail: value }))} />
              <SelectField label={copy.common.documentTypeLabel} value={reservationDraft.customerDocType} options={copy.common.documentTypeOptions} onChange={(value) => setReservationDraft((current) => ({ ...current, customerDocType: value }))} />
              <Field label={copy.common.documentNumberLabel} value={reservationDraft.customerDocNumber} onChange={(value) => setReservationDraft((current) => ({ ...current, customerDocNumber: value }))} />
              <SelectField label={copy.common.marketingLabel} value={reservationDraft.marketing} options={copy.common.marketingOptions} onChange={(value) => setReservationDraft((current) => ({ ...current, marketing: value }))} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void saveAll()} disabled={saving} style={primaryButtonStyle}>
                {saving ? copy.checkinPage.saving : copy.checkinPage.save}
              </button>
            </div>
          </section>
        </div>

        {snapshot.contracts.map((contract) => {
          const draft = contractDrafts[contract.id];
          const disabled = contract.status === "SIGNED";
          return (
            <details
              key={contract.id}
              open={snapshot.contracts.length === 1 || contract.status !== "SIGNED"}
              style={{
                background: "#fff",
                borderRadius: 22,
                border: "1px solid #e2e8f0",
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
                overflow: "hidden",
              }}
            >
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  padding: 18,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>{copy.checkinPage.unitTitle(contract.unitIndex)}</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    {draft?.driverName || copy.checkinPage.pendingDriver}
                    {contract.signedAt ? ` | ${copy.checkinPage.signedOn(formatPublicDate(contract.signedAt, language))}` : ""}
                  </div>
                </div>
                <StatusBadge status={contract.status} language={language} />
              </summary>

              <div style={{ display: "grid", gap: 16, padding: "0 18px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => copyHolderToContract(contract.id)} disabled={disabled} style={secondaryButtonStyle}>
                    {copy.checkinPage.useHolder}
                  </button>
                  <a
                    href={`/api/public/checkin/${encodeURIComponent(token)}/contracts/${contract.id}/pdf?lang=${encodeURIComponent(language)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={secondaryLinkStyle}
                  >
                    {copy.checkinPage.printable}
                  </a>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  <ReadOnlyField label={copy.checkinPage.scheduledTime} value={formatPublicTime(snapshot.reservation.scheduledTime, language)} />
                  <ReadOnlyField label={copy.checkinPage.duration} value={snapshot.reservation.durationMinutes ? `${snapshot.reservation.durationMinutes} min` : copy.checkinPage.accordingToReservation} />
                  <ReadOnlyField label={copy.checkinPage.assignedResource} value={contract.preparedResourceLabel} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <Field label={copy.checkinPage.driverName} value={draft?.driverName ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], driverName: value } }))} />
                  <Field label={copy.checkinPage.driverPhone} value={draft?.driverPhone ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], driverPhone: value } }))} />
                  <Field label={copy.checkinPage.driverEmail} value={draft?.driverEmail ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], driverEmail: value } }))} />
                  <Field label={copy.checkinPage.driverCountry} value={draft?.driverCountry ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], driverCountry: value } }))} />
                  <Field label={copy.checkinPage.driverAddress} value={draft?.driverAddress ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], driverAddress: value } }))} />
                  <Field label={copy.checkinPage.driverPostalCode} value={draft?.driverPostalCode ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], driverPostalCode: value } }))} />
                  <DateField label={copy.checkinPage.driverBirthDate} value={draft?.driverBirthDate ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], driverBirthDate: value } }))} />
                  <SelectField label={`${copy.common.documentTypeLabel} *`} value={draft?.driverDocType ?? ""} disabled={disabled} options={copy.common.documentTypeOptions} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], driverDocType: value } }))} />
                  <Field label={`${copy.common.documentNumberLabel} *`} value={draft?.driverDocNumber ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], driverDocNumber: value } }))} />
                  {snapshot.reservation.isLicense ? (
                    <>
                      <Field label={copy.checkinPage.licenseSchool} value={draft?.licenseSchool ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], licenseSchool: value } }))} />
                      <Field label={copy.checkinPage.licenseType} value={draft?.licenseType ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], licenseType: value } }))} />
                      <Field label={copy.checkinPage.licenseNumber} value={draft?.licenseNumber ?? ""} disabled={disabled} onChange={(value) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], licenseNumber: value } }))} />
                    </>
                  ) : null}
                </div>

                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={Boolean(draft?.imageConsentAccepted)}
                    disabled={disabled}
                    onChange={(e) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], imageConsentAccepted: e.target.checked } }))}
                  />
                  <span>{copy.checkinPage.imageConsent}</span>
                </label>

                {contract.minorNeedsAuthorization || draft?.minorAuthorizationProvided ? (
                  <label style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={Boolean(draft?.minorAuthorizationProvided)}
                      disabled={disabled}
                      onChange={(e) => setContractDrafts((current) => ({ ...current, [contract.id]: { ...current[contract.id], minorAuthorizationProvided: e.target.checked } }))}
                    />
                    <span>{copy.checkinPage.tutorAuthorization(contract.minorAuthorizationFileName)}</span>
                  </label>
                ) : null}

                <div style={{ border: "1px solid #cbd5e1", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
                  <iframe
                    title={`Contract ${contract.unitIndex}`}
                    srcDoc={contract.renderedHtml}
                    style={{
                      width: "100%",
                      height: "min(72vh, 980px)",
                      border: 0,
                      display: "block",
                      background: "#fff",
                    }}
                  />
                </div>

                {!disabled ? (
                  <>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 900 }}>{copy.checkinPage.signatureTitle}</div>
                      <div style={{ fontSize: 13, color: "#475569" }}>
                        {copy.checkinPage.signatureHelp}
                      </div>
                    </div>

                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
                      <SignatureCanvas
                        ref={(instance) => {
                          sigRefs.current[contract.id] = instance;
                        }}
                        penColor="black"
                        canvasProps={{
                          width: 900,
                          height: 260,
                          style: {
                            width: "100%",
                            height: 260,
                            display: "block",
                            background: "#fff",
                            touchAction: "none",
                          },
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => sigRefs.current[contract.id]?.clear()}
                        style={secondaryButtonStyle}
                      >
                        {copy.checkinPage.clearSignature}
                      </button>
                      <button
                        type="button"
                        onClick={() => void signContract(contract.id)}
                        disabled={signingId === contract.id}
                        style={primaryButtonStyle}
                      >
                        {signingId === contract.id ? copy.checkinPage.signing : copy.checkinPage.signContract}
                      </button>
                    </div>
                  </>
                ) : (
                  <Banner tone="success" text={copy.checkinPage.signedBanner(contract.signatureSignedBy || contract.driverName || "customer", formatPublicDate(contract.signedAt, language))} />
                )}
              </div>
            </details>
          );
        })}
      </section>
    </main>
  );
}

function MetricCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 16, border: "1px solid #e2e8f0", background: "#f8fafc", display: "grid", gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#475569" }}>{description}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
      <span>{label}</span>
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
      <span>{label}</span>
      <input type="date" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
      <span>{label}</span>
      <div
        style={{
          ...inputStyle,
          color: "#475569",
          background: "#f8fafc",
          minHeight: 48,
          display: "flex",
          alignItems: "center",
        }}
      >
        {value}
      </div>
    </label>
  );
}

function StatusBadge({ status, language }: { status: string; language: PublicLanguage }) {
  const labels =
    language === "en"
      ? { signed: "Signed", ready: "Ready", pending: "Pending" }
      : { signed: "Firmado", ready: "Listo", pending: "Pendiente" };

  const tone =
    status === "SIGNED"
      ? { bg: "#dcfce7", color: "#166534", border: "#86efac", label: labels.signed }
      : status === "READY"
        ? { bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd", label: labels.ready }
        : { bg: "#fff7ed", color: "#9a3412", border: "#fdba74", label: labels.pending };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 12px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 900,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        whiteSpace: "nowrap",
      }}
    >
      {tone.label}
    </span>
  );
}

function Banner({ tone, text }: { tone: "success" | "error"; text: string }) {
  const styles =
    tone === "success"
      ? { border: "#bbf7d0", background: "#f0fdf4", color: "#166534" }
      : { border: "#fecaca", background: "#fff1f2", color: "#991b1b" };

  return (
    <div style={{ padding: 14, borderRadius: 16, border: `1px solid ${styles.border}`, background: styles.background, color: styles.color, fontWeight: 700 }}>
      {text}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  fontSize: 15,
  background: "#fff",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #0f172a",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 900,
  textDecoration: "none",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 14,
  color: "#0f172a",
};
