"use client";

import React, { useMemo } from "react";
import Select, { type GroupBase, type StylesConfig } from "react-select";
import {
  getCountryDialCodeOptions,
  normalizeCountrySearchText,
  type CountryDialCodeOption,
  type CountryOption,
} from "@/lib/countries";

type CountryDialCodeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  countryOptions: CountryOption[];
  disabled?: boolean;
  inputStyle: React.CSSProperties;
  instanceId?: string;
  ariaLabel?: string;
};

const selectStyles: StylesConfig<CountryDialCodeOption, false, GroupBase<CountryDialCodeOption>> = {
  control: (base, state) => ({
    ...base,
    minHeight: 0,
    height: "100%",
    border: 0,
    borderRadius: 0,
    background: "transparent",
    boxShadow: "none",
    cursor: state.isDisabled ? "default" : "pointer",
  }),
  valueContainer: (base) => ({
    ...base,
    height: "100%",
    padding: "0 8px 0 10px",
    flexWrap: "nowrap",
    overflow: "hidden",
  }),
  singleValue: (base) => ({
    ...base,
    margin: 0,
    maxWidth: "100%",
    overflow: "hidden",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "100%",
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: "0 6px 0 2px",
    color: "#64748b",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 30,
    width: 280,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
  option: (base, state) => ({
    ...base,
    cursor: "pointer",
    background: state.isSelected ? "#e0f2fe" : state.isFocused ? "#f1f5f9" : "#fff",
    color: "#0f172a",
  }),
};

function matchesDialCodeOption(option: CountryDialCodeOption, rawInput: string) {
  const raw = String(rawInput ?? "").trim();
  if (!raw) return true;

  const normalizedInput = normalizeCountrySearchText(raw);
  const numericInput = raw.replace(/\D/g, "");

  return (
    option.searchText.includes(normalizedInput) ||
    Boolean(numericInput && option.dialCode.includes(numericInput))
  );
}

function formatDialCodeOption(option: CountryDialCodeOption, context: "menu" | "value") {
  if (context === "value") {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span aria-hidden="true">{option.flag}</span>
        <span style={{ fontWeight: 900 }}>+{option.dialCode}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {option.label}
        </span>
      </span>
    );
  }

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span aria-hidden="true">{option.flag}</span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {option.label}
      </span>
      <span style={{ marginLeft: "auto", fontWeight: 900 }}>+{option.dialCode}</span>
    </span>
  );
}

export function CountryDialCodeSelect({
  value,
  onChange,
  countryOptions,
  disabled,
  inputStyle,
  instanceId = "country-dial-code-select",
  ariaLabel = "Prefijo telefonico",
}: CountryDialCodeSelectProps) {
  const options = useMemo(() => getCountryDialCodeOptions(countryOptions), [countryOptions]);
  const normalizedValue = String(value ?? "").trim().toUpperCase();
  const selectedOption = options.find((option) => option.value === normalizedValue) ?? null;
  const portalTarget = typeof document === "undefined" ? undefined : document.body;

  return (
    <Select<CountryDialCodeOption, false>
      aria-label={ariaLabel}
      instanceId={instanceId}
      inputId={instanceId}
      options={options}
      value={selectedOption}
      onChange={(option) => {
        if (option) onChange(option.value);
      }}
      isDisabled={disabled}
      isClearable={false}
      menuPortalTarget={portalTarget}
      menuPosition="fixed"
      placeholder="Prefijo..."
      noOptionsMessage={() => "Sin resultados"}
      filterOption={(candidate, inputValue) => matchesDialCodeOption(candidate.data, inputValue)}
      formatOptionLabel={(option, meta) => formatDialCodeOption(option, meta.context)}
      styles={{
        ...selectStyles,
        control: (base, state) => ({
          ...selectStyles.control?.(base, state),
          minHeight: inputStyle.minHeight ?? 48,
          fontSize: inputStyle.fontSize ?? 14,
        }),
      }}
    />
  );
}
