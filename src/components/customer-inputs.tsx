"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CountryOption } from "@/lib/countries";
import { getDialCodeForCountry } from "@/lib/countries";

function digitsOnly(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatBirthDateTextFromDigits(digits: string) {
  const trimmed = digits.slice(0, 8);
  if (trimmed.length <= 2) return trimmed;
  if (trimmed.length <= 4) return `${trimmed.slice(0, 2)}/${trimmed.slice(2)}`;
  return `${trimmed.slice(0, 2)}/${trimmed.slice(2, 4)}/${trimmed.slice(4)}`;
}

function formatBirthDateTextFromYmd(ymd: string) {
  const parts = String(ymd ?? "").split("-");
  if (parts.length !== 3) return "";
  const [year, month, day] = parts;
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

function parseBirthDateToYmd(text: string) {
  const digits = digitsOnly(text);
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4));
  if (!day || !month || !year) return null;

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function BirthDateField({
  label,
  value,
  onChange,
  style,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  style: React.CSSProperties;
  disabled?: boolean;
  required?: boolean;
}) {
  const [text, setText] = useState(formatBirthDateTextFromYmd(value));
  const nativeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(formatBirthDateTextFromYmd(value));
  }, [value]);

  const helperText = useMemo(() => "Formato rapido: dd/mm/aaaa", []);

  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
      <span>{label}</span>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => {
            const nextDigits = digitsOnly(e.target.value);
            const formatted = formatBirthDateTextFromDigits(nextDigits);
            setText(formatted);

            const parsed = parseBirthDateToYmd(formatted);
            if (parsed) onChange(parsed);
            if (!formatted) onChange("");
          }}
          onBlur={() => {
            if (!text.trim()) {
              onChange("");
              return;
            }
            const parsed = parseBirthDateToYmd(text);
            if (parsed) {
              setText(formatBirthDateTextFromYmd(parsed));
              onChange(parsed);
            }
          }}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          autoComplete="bday"
          disabled={disabled}
          required={required}
          style={style}
        />
        <button
          type="button"
          onClick={() => nativeInputRef.current?.showPicker?.()}
          disabled={disabled}
          style={{
            ...style,
            width: 52,
            padding: 0,
            display: "grid",
            placeItems: "center",
            cursor: disabled ? "default" : "pointer",
          }}
          aria-label="Abrir selector de fecha"
        >
          Fecha
        </button>
        <input
          ref={nativeInputRef}
          type="date"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setText(formatBirthDateTextFromYmd(e.target.value));
            onChange(e.target.value);
          }}
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
        />
      </div>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{helperText}</div>
    </label>
  );
}

export function PhoneWithCountryField({
  label,
  country,
  phone,
  onCountryChange,
  onPhoneChange,
  countryOptions,
  inputStyle,
  disabled,
  required,
  phonePlaceholder,
  containerStyle,
}: {
  label: string;
  country: string;
  phone: string;
  onCountryChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  countryOptions: CountryOption[];
  inputStyle: React.CSSProperties;
  disabled?: boolean;
  required?: boolean;
  phonePlaceholder?: string;
  containerStyle?: React.CSSProperties;
}) {
  const normalizedCountry = String(country ?? "").trim().toUpperCase();
  const selectedDialCode = getDialCodeForCountry(normalizedCountry);
  const shellStyle: React.CSSProperties = {
    border: String(inputStyle.border ?? "1px solid #d0d9e4"),
    borderRadius: inputStyle.borderRadius ?? 14,
    background: String(inputStyle.background ?? "#fff"),
    minHeight: inputStyle.minHeight ?? 48,
    display: "grid",
    gridTemplateColumns: "84px 88px minmax(0, 1fr)",
    alignItems: "stretch",
    overflow: "hidden",
  };
  const innerControlStyle: React.CSSProperties = {
    border: 0,
    outline: "none",
    background: "transparent",
    padding: "0 12px",
    minWidth: 0,
    fontSize: 14,
  };

  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, ...containerStyle }}>
      <span>{label}</span>
      <div style={shellStyle}>
        <select
          value={normalizedCountry}
          onChange={(e) => onCountryChange(e.target.value)}
          disabled={disabled}
          style={{
            ...innerControlStyle,
            borderRight: "1px solid #e2e8f0",
            fontWeight: 800,
          }}
        >
          {countryOptions.map((option) => {
            const dialCode = getDialCodeForCountry(option.value);
            const suffix = dialCode ? ` (+${dialCode})` : "";
            return (
              <option key={option.value} value={option.value}>
                {option.value}{suffix} {option.label}
              </option>
            );
          })}
        </select>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRight: "1px solid #e2e8f0",
            color: "#475569",
            fontSize: 14,
            fontWeight: 800,
            background: "#f8fafc",
            padding: "0 10px",
            whiteSpace: "nowrap",
          }}
        >
          {selectedDialCode ? `+${selectedDialCode}` : "--"}
        </div>
        <input
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          disabled={disabled}
          required={required}
          autoComplete="tel"
          placeholder={phonePlaceholder ?? "Ej: 612345678"}
          style={innerControlStyle}
        />
      </div>
    </label>
  );
}
