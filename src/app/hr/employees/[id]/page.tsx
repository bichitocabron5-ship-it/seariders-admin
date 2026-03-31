// src/app/hr/employees/[id]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import EmployeeDetailOverviewSection from "./_components/EmployeeDetailOverviewSection";
import EmployeeDetailRecordsSection from "./_components/EmployeeDetailRecordsSection";

type DetailResponse = {
  ok: true;
  row: {
    id: string;
    code: string | null;
    fullName: string;
    phone: string | null;
    email: string | null;
    kind: string;
    jobTitle: string | null;
    isActive: boolean;
    note: string | null;
    hireDate: string | null;
    terminationDate: string | null;
    internshipHoursTotal: number | null;
    internshipHoursUsed: number | null;
    internshipStartDate: string | null;
    internshipEndDate: string | null;
    userId: string | null;
    user: {
      id: string;
      username: string;
      fullName: string | null;
      isActive: boolean;
    } | null;
    workLogs: Array<{
      id: string;
      workDate: string;
      checkInAt: string | null;
      checkOutAt: string | null;
      breakMinutes: number;
      workedMinutes: number | null;
      area: string;
      status: string;
      note: string | null;
      approvedByUserId: string | null;
      approvedByUser: {
        id: string;
        username: string | null;
        fullName: string | null;
      } | null;
      createdAt: string;
      updatedAt: string;
    }>;
    rates: Array<{
      id: string;
      rateType: string;
      amountCents: number;
      effectiveFrom: string;
      effectiveTo: string | null;
      note: string | null;
      createdAt: string;
      createdByUserId: string | null;
      createdByUser: {
        id: string;
        username: string | null;
        fullName: string | null;
      } | null;
    }>;
    payrollEntries: Array<{
      id: string;
      periodStart: string;
      periodEnd: string;
      status: string;
      amountCents: number;
      concept: string | null;
      note: string | null;
      paidAt: string | null;
      createdAt: string;
      createdByUserId: string | null;
      createdByUser: {
        id: string;
        username: string | null;
        fullName: string | null;
      } | null;
    }>;
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    workedMinutesTotal: number;
    payrollTotalCents: number;
    internshipRemaining: number | null;
  };
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-ES");
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function fmtMinutes(total: number | null) {
  if (total === null || total === undefined) return "—";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${minutes}m`;
}

function eur(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
}

function employeeKindLabel(kind: string) {
  switch (kind) {
    case "MONITOR":
      return "Monitor";
    case "SKIPPER":
      return "Patrón";
    case "SELLER":
      return "Vendedor";
    case "INTERN":
      return "Prácticas";
    case "MECHANIC":
      return "Mecánico";
    case "HR":
      return "RR. HH.";
    case "SECURITY":
      return "Seguridad";
    case "ASSISTANT_MECHANIC":
      return "Ayudante mecánico";
    case "EXTRA":
      return "Extra";
    case "MANAGER":
      return "Responsable";
    default:
      return kind;
  }
}

function rateTypeLabel(type: string) {
  if (type === "HOURLY") return "Por hora";
  if (type === "DAILY") return "Por día";
  if (type === "MONTHLY") return "Mensual";
  if (type === "PER_SHIFT") return "Por turno";
  return type;
}

function statusBadge(text: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (text === "ACTIVE" || text === "PAID" || text === "APPROVED") {
    return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
  }
  if (text === "OPEN" || text === "PENDING") {
    return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  }
  if (text === "CANCELED") {
    return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  }
  if (text === "CLOSED" || text === "DRAFT") {
    return { ...base, borderColor: "#dbeafe", background: "#eff6ff", color: "#1d4ed8" };
  }
  return base;
}

export default function HrEmployeeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/hr/employees/${id}/detail`, { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const json = (await response.json()) as DetailResponse;
      setData(json);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Error cargando ficha");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = useMemo(() => data?.row.fullName ?? "Trabajador", [data]);

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <button type="button" onClick={() => router.push("/hr")} style={ghostBtn}>
            ← RR. HH.
          </button>

          <div style={{ marginTop: 10, fontWeight: 950, fontSize: 30 }}>{title}</div>
          <div style={{ opacity: 0.72, fontSize: 13 }}>Ficha individual del trabajador</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => void load()} style={ghostBtn}>
            Refrescar
          </button>
          <a href="/hr/worklogs" style={linkBtn}>
            Fichajes
          </a>
          <a href="/hr/rates" style={linkBtn}>
            Tarifas
          </a>
          <a href="/hr/payroll" style={linkBtn}>
            Pagos
          </a>
        </div>
      </div>

      {loading ? <div>Cargando...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      {!loading && data ? (
        <>
          <EmployeeDetailOverviewSection
            row={data.row}
            summary={data.summary}
            employeeKindLabel={employeeKindLabel}
            fmtDate={fmtDate}
            fmtMinutes={fmtMinutes}
            eur={eur}
            statusBadge={statusBadge}
          />

          <EmployeeDetailRecordsSection
            row={data.row}
            summary={data.summary}
            fmtDate={fmtDate}
            fmtDateTime={fmtDateTime}
            fmtMinutes={fmtMinutes}
            eur={eur}
            rateTypeLabel={rateTypeLabel}
            statusBadge={statusBadge}
            cardStyle={cardStyle}
            itemStyle={itemStyle}
            sectionTitle={sectionTitle}
            subLineStyle={subLineStyle}
          />
        </>
      ) : null}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
};

const linkBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  color: "#111",
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 12,
};

const itemStyle: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 950,
  fontSize: 20,
};

const subLineStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  opacity: 0.85,
};
