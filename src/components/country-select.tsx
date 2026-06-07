"use client";

import React, { useMemo } from "react";
import Select, { type GroupBase, type StylesConfig } from "react-select";
import {
  getCountryOptionLabel,
  getCountryFlagEmoji,
  normalizeCountrySearchText,
  type CountryOption,
} from "@/lib/countries";

type CountrySelectOption = CountryOption & {
  flag: string;
  searchText: string;
};

type CountrySelectProps = {
  value: string;
  onChange: (value: string) => void;
  countryOptions: CountryOption[];
  inputStyle: React.CSSProperties;
  disabled?: boolean;
  placeholder?: string;
  noOptionsMessage?: string;
  instanceId?: string;
  ariaLabel?: string;
  language?: string | null;
};

const selectStyles: StylesConfig<CountrySelectOption, false, GroupBase<CountrySelectOption>> = {
  control: (base, state) => ({
    ...base,
    border: "1px solid #d0d9e4",
    borderRadius: 12,
    boxShadow: "none",
    cursor: state.isDisabled ? "default" : "pointer",
    minHeight: 48,
    background: "#fff",
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 12px",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#0f172a",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#64748b",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 30,
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

function toCountrySelectOption(option: CountryOption, language: string | null | undefined): CountrySelectOption {
  const label = getCountryOptionLabel(option, language);
  const searchLabels = [
    label,
    option.label,
    option.labelEn,
    option.labelEs,
    ...(option.searchLabels ?? []),
    option.value,
  ];

  return {
    ...option,
    label,
    flag: getCountryFlagEmoji(option.value),
    searchText: searchLabels.map(normalizeCountrySearchText).join(" "),
  };
}

function matchesCountryOption(option: CountrySelectOption, rawInput: string) {
  const normalizedInput = normalizeCountrySearchText(rawInput);
  if (!normalizedInput) return true;
  return option.searchText.includes(normalizedInput);
}

function formatCountryOption(option: CountrySelectOption, context: "menu" | "value") {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span aria-hidden="true">{option.flag}</span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {option.label}
      </span>
      {context === "menu" ? (
        <span style={{ marginLeft: "auto", color: "#64748b", fontWeight: 900 }}>{option.value}</span>
      ) : null}
    </span>
  );
}

export function CountrySelect({
  value,
  onChange,
  countryOptions,
  inputStyle,
  disabled,
  placeholder = "Selecciona pais...",
  noOptionsMessage = "Sin resultados",
  instanceId = "country-select",
  ariaLabel = "Pais",
  language = "es",
}: CountrySelectProps) {
  const options = useMemo(
    () => countryOptions.map((option) => toCountrySelectOption(option, language)),
    [countryOptions, language]
  );
  const normalizedValue = String(value ?? "").trim().toUpperCase();
  const selectedOption = options.find((option) => option.value === normalizedValue) ?? null;
  const portalTarget = typeof document === "undefined" ? undefined : document.body;

  return (
    <Select<CountrySelectOption, false>
      aria-label={ariaLabel}
      instanceId={instanceId}
      inputId={instanceId}
      options={options}
      value={selectedOption}
      onChange={(option) => onChange(option?.value ?? "")}
      isDisabled={disabled}
      isClearable
      menuPortalTarget={portalTarget}
      menuPosition="fixed"
      placeholder={placeholder}
      noOptionsMessage={() => noOptionsMessage}
      filterOption={(candidate, inputValue) => matchesCountryOption(candidate.data, inputValue)}
      formatOptionLabel={(option, meta) => formatCountryOption(option, meta.context)}
      styles={{
        ...selectStyles,
        control: (base, state) => ({
          ...selectStyles.control?.(base, state),
          border: String(inputStyle.border ?? "1px solid #d0d9e4"),
          borderRadius: inputStyle.borderRadius ?? 12,
          minHeight: inputStyle.minHeight ?? 48,
          background: String(inputStyle.background ?? "#fff"),
          fontSize: inputStyle.fontSize ?? 14,
        }),
      }}
    />
  );
}
