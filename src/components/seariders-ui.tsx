import type React from "react";
import { brand, type BrandToneName } from "@/lib/brand";

type ActionButtonProps = (
  | ({ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>)
) & {
  variant?: "primary" | "secondary";
};

type SectionCardProps = {
  eyebrow?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
};

type StatusBadgeProps = {
  tone?: BrandToneName;
  children: React.ReactNode;
};

type AlertBannerProps = {
  tone?: Exclude<BrandToneName, "neutral">;
  title?: string;
  children: React.ReactNode;
};

const buttonBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 42,
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 900,
  fontSize: 14,
  textDecoration: "none",
  cursor: "pointer",
  transition: "transform 120ms ease, border-color 120ms ease, background-color 120ms ease, color 120ms ease",
};

export function ActionButton(props: ActionButtonProps) {
  const { variant = "primary", style, href, ...rest } = props as ActionButtonProps & {
    style?: React.CSSProperties;
  };

  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? {
          border: `1px solid ${brand.colors.primary}`,
          background: brand.colors.primary,
          color: "#fff",
          boxShadow: "0 12px 24px rgba(15, 23, 42, 0.12)",
        }
      : {
          border: `1px solid ${brand.colors.border}`,
          background: brand.colors.surface,
          color: brand.colors.primary,
        };

  if (href) {
    return (
      <a
        href={href}
        style={{ ...buttonBase, ...variantStyle, ...style }}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      />
    );
  }

  return (
    <button
      type={(rest as React.ButtonHTMLAttributes<HTMLButtonElement>).type ?? "button"}
      style={{ ...buttonBase, ...variantStyle, ...style }}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    />
  );
}

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  const palette = brand.tones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "7px 11px",
        borderRadius: brand.radius.pill,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.text,
        fontSize: 12,
        fontWeight: 900,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function AlertBanner({
  tone = "info",
  title,
  children,
}: AlertBannerProps) {
  const palette = brand.tones[tone];
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        padding: 14,
        borderRadius: brand.radius.md,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.text,
      }}
    >
      {title ? <div style={{ fontWeight: 900 }}>{title}</div> : null}
      <div style={{ lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export function SectionCard({
  eyebrow,
  title,
  action,
  children,
}: SectionCardProps) {
  return (
    <section
      style={{
        border: `1px solid ${brand.colors.border}`,
        borderRadius: brand.radius.lg,
        background: brand.colors.surfaceRaised,
        boxShadow: brand.shadow.sm,
        overflow: "hidden",
      }}
    >
      {(eyebrow || title || action) ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
            padding: "18px 18px 14px",
            borderBottom: `1px solid ${brand.colors.border}`,
            background: "linear-gradient(180deg, #fbfdff 0%, #f4f8fb 100%)",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            {eyebrow ? (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: brand.colors.secondary,
                }}
              >
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <div style={{ fontSize: 18, fontWeight: 950, color: brand.colors.primary }}>
                {title}
              </div>
            ) : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      <div style={{ padding: 18 }}>{children}</div>
    </section>
  );
}
