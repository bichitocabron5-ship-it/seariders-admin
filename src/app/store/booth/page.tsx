"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StoreHero, StoreMetricCard, StoreMetricGrid, storeStyles } from "@/components/store-ui";
import BoothReceptionValidatorSection from "@/app/store/booth/_components/BoothReceptionValidatorSection";
import BoothTravelStatusSection from "@/app/store/booth/_components/BoothTravelStatusSection";

type BoothRow = {
  id: string;
  boothCode: string | null;
  arrivedStoreAt: string | null;
  createdAt: string;
  customerName: string;
  customerCountry: string;
  quantity: number;
  pax: number;
  totalPriceCents: number;
  service: { name: string };
  option: { durationMinutes: number };
  taxiboatDepartedAt?: string | null;
  taxiboatTripId?: string | null;
  taxiboatBoat?: string | null;
  taxiboatTripNo?: number | null;
};

type EnCaminoGroup = {
  key: string;
  tripId: string | null | undefined;
  boat: string;
  tripNo: number | null;
  departedAt: string | null | undefined;
  items: BoothRow[];
  paxTotal: number;
};

function euros(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function todayMadridYMD() {
  const tz = "Europe/Madrid";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export default function StoreBoothPage() {
  const [rows, setRows] = useState<BoothRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [marking, setMarking] = useState(false);
  const [lastMarkedId, setLastMarkedId] = useState<string | null>(null);
  const router = useRouter();

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/store/booth/today", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setRows(data.rows ?? []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Error cargando carpa"));
    } finally {
      setLoading(false);
    }
  }

function hhmm(d?: string | null) {
  if (!d) return "--:--";
  return new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function boatLabel(boat?: string | null) {
  if (!boat) return "Taxiboat";
  if (boat === "TAXIBOAT_1") return "Nazca";
  if (boat === "TAXIBOAT_2") return "Nico";
  return boat;
}

  async function markReceived() {
    const boothCode = code.trim().toUpperCase();
    if (!boothCode) return;

    setError(null);
    setMarking(true);

    try {
      const r = await fetch("/api/store/booth/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boothCode }),
      });

      if (!r.ok) throw new Error(await r.text());

      const data = await r.json();
      const reservationId = data.reservationId ?? null;

      setLastMarkedId(reservationId);
      setCode("");
      await load();

      if (!reservationId) return;

      if (data.alreadyFormalized) {
        router.push(`/store?reservationId=${reservationId}&boothCode=${encodeURIComponent(boothCode)}`);
        return;
      }

      const day = todayMadridYMD();
      router.push(`/store/create?migrateFrom=${reservationId}&date=${day}&mode=today&boothCode=${encodeURIComponent(boothCode)}`);
    } catch (e: unknown) {
      setError(errorMessage(e, "Error marcando recibido"));
    } finally {
      setMarking(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, []);

  const enCamino = useMemo(
    () => rows.filter((r) => r.taxiboatDepartedAt && !r.arrivedStoreAt),
    [rows]
  );
  const recibidas = useMemo(() => rows.filter((r) => !!r.arrivedStoreAt), [rows]);
  const paxEnCamino = useMemo(
    () => enCamino.reduce((total, row) => total + Number(row.pax ?? 0), 0),
    [enCamino]
  );
  const importeEnCamino = useMemo(
    () => enCamino.reduce((total, row) => total + Number(row.totalPriceCents ?? 0), 0),
    [enCamino]
  );

  const groups = useMemo(
    () =>
      Object.values(
        enCamino.reduce<Record<string, EnCaminoGroup>>((acc, r) => {
          const k = r.taxiboatTripId ?? "NO_TRIP";
          if (!acc[k]) {
            acc[k] = {
              key: k,
              tripId: r.taxiboatTripId,
              boat: boatLabel(r.taxiboatBoat),
              tripNo: r.taxiboatTripNo ?? null,
              departedAt: r.taxiboatDepartedAt,
              items: [],
              paxTotal: 0,
            };
          }
          acc[k].items.push(r);
          acc[k].paxTotal += Number(r.pax ?? 0);
          return acc;
        }, {})
      ),
    [enCamino]
  );

  return (
    <div style={pageStyle}>
      <StoreHero
        eyebrow="Recepción de carpa"
        title="Store / Booth"
        description="Validación de códigos, seguimiento de viajes en curso y traspaso ordenado a tienda."
        background="linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eff6ff 100%)"
        actions={
          <>
            <button type="button" onClick={() => void load()} disabled={loading} style={ghostBtn}>
              {loading ? "Cargando..." : "Refrescar"}
            </button>
            <Link href="/store" style={ghostLinkBtn}>
              Volver a Store
            </Link>
          </>
        }
      >
        <div style={heroMetaRow}>
          <HeroBadge label="En camino" value={String(enCamino.length)} />
          <HeroBadge label="PAX en ruta" value={String(paxEnCamino)} />
          <HeroBadge label="Recibidas" value={String(recibidas.length)} />
        </div>
      </StoreHero>

      {error ? <div style={errorBox}>{error}</div> : null}

      <StoreMetricGrid>
        <StoreMetricCard
          label="Clientes en camino"
          value={String(enCamino.length)}
          description={`${groups.length} viajes activos`}
        />
        <StoreMetricCard
          label="PAX en ruta"
          value={String(paxEnCamino)}
          description={euros(importeEnCamino)}
        />
        <StoreMetricCard
          label="Recepciones cerradas"
          value={String(recibidas.length)}
          description={lastMarkedId ? "Última recepción registrada" : "Sin recepciones recientes"}
        />
      </StoreMetricGrid>

      <BoothReceptionValidatorSection
        code={code}
        marking={marking}
        onCodeChange={setCode}
        onSubmit={() => void markReceived()}
      />


      <BoothTravelStatusSection
        groups={groups}
        enCamino={enCamino}
        recibidas={recibidas}
        lastMarkedId={lastMarkedId}
        euros={euros}
        hhmm={hhmm}
        boatLabel={boatLabel}
      />
    </div>
  );
}

function HeroBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroBadgeStyle}>
      <div style={heroBadgeLabel}>{label}</div>
      <div style={heroBadgeValue}>{value}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  ...storeStyles.shell,
  maxWidth: 1380,
  background:
    "radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 24%), radial-gradient(circle at top right, rgba(251, 191, 36, 0.12), transparent 24%)",
};

const heroMetaRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const heroBadgeStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "rgba(255,255,255,0.78)",
  padding: "10px 12px",
  display: "grid",
  gap: 4,
  minWidth: 120,
};

const heroBadgeLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#64748b",
};

const heroBadgeValue: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const ghostBtn: React.CSSProperties = {
  ...storeStyles.secondaryButton,
  borderRadius: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const ghostLinkBtn: React.CSSProperties = {
  ...ghostBtn,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const errorBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};
