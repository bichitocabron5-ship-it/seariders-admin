"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { HrRatesFiltersSection } from "./_components/HrRatesFiltersSection";
import { HrRatesListSection } from "./_components/HrRatesListSection";
import { RateModal } from "./_components/RateModal";
import type { EmployeeLite, EmployeeRateType, RateRow } from "./types";

const RATE_TYPES: EmployeeRateType[] = ["HOURLY", "DAILY", "MONTHLY", "PER_SHIFT"];

function eur(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-ES");
  } catch {
    return iso;
  }
}

function fmtDateInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function rateTypeLabel(rateType: EmployeeRateType) {
  if (rateType === "HOURLY") return "Por hora";
  if (rateType === "DAILY") return "Por día";
  if (rateType === "MONTHLY") return "Mensual";
  return "Por turno";
}

export default function HrRatesPage() {
  const [rows, setRows] = useState<RateRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [rateType, setRateType] = useState<"" | EmployeeRateType>("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RateRow | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (employeeId) params.set("employeeId", employeeId);
    if (rateType) params.set("rateType", rateType);
    return params.toString();
  }, [employeeId, rateType]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [ratesResponse, employeesResponse] = await Promise.all([
        fetch(`/api/hr/rates?${query}`, { cache: "no-store" }),
        fetch("/api/hr/employees?isActive=true", { cache: "no-store" }),
      ]);

      if (!ratesResponse.ok) throw new Error(await ratesResponse.text());
      if (!employeesResponse.ok) throw new Error(await employeesResponse.text());

      const ratesJson = await ratesResponse.json();
      const employeesJson = await employeesResponse.json();

      setRows(ratesJson.rows ?? []);
      setEmployees(employeesJson.rows ?? []);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Error cargando tarifas");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const billableEmployees = useMemo(() => employees.filter((employee) => employee.kind !== "INTERN"), [employees]);

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 30 }}>Tarifas</div>
          <div style={{ opacity: 0.72, fontSize: 13 }}>Tarifas por trabajador y vigencia</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/hr" style={linkBtn}>
            ← RR. HH.
          </a>

          <button type="button" onClick={() => void load()} style={ghostBtn}>
            Refrescar
          </button>

          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            style={primaryBtn}
          >
            Nueva tarifa
          </button>
        </div>
      </div>

      <HrRatesFiltersSection
        employeeId={employeeId}
        rateType={rateType}
        billableEmployees={billableEmployees}
        rateTypes={RATE_TYPES}
        rateTypeLabel={rateTypeLabel}
        onEmployeeChange={setEmployeeId}
        onRateTypeChange={setRateType}
        onApply={() => void load()}
        inputStyle={inputStyle}
        primaryBtn={primaryBtn}
      />

      {loading ? <div>Cargando...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      {!loading && !error ? (
        <HrRatesListSection
          rows={rows}
          onEdit={(row) => {
            setEditing(row);
            setOpen(true);
          }}
          eur={eur}
          fmtDate={fmtDate}
          rateTypeLabel={rateTypeLabel}
          emptyBox={emptyBox}
        />
      ) : null}

      {open ? (
        <RateModal
          initial={editing}
          employees={employees}
          rateTypes={RATE_TYPES}
          rateTypeLabel={rateTypeLabel}
          fmtDateInput={fmtDateInput}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await load();
          }}
          inputStyle={inputStyle}
          ghostBtn={ghostBtn}
          primaryBtn={primaryBtn}
          errorBox={errorBox}
        />
      ) : null}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 950,
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

const emptyBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 16,
  padding: 18,
};
