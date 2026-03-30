"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

type RadarItem = {
  id: string;
  title: string;
  subtitle: string | null;
  titleHint: string;
  stateLabel: string;
  stateStyle: CSSProperties;
  availabilityLabel: string;
  availabilityActive: boolean;
  detailHref?: string | null;
  eventHref?: string | null;
};

export default function PlatformResourceRadar({
  title,
  count,
  emptyLabel,
  loading,
  items,
}: {
  title: string;
  count: number;
  emptyLabel: string;
  loading: boolean;
  items: RadarItem[];
}) {
  return (
    <div style={radarShellStyle}>
      <div style={radarHeaderStyle}>
        <div style={{ fontWeight: 950 }}>{title}</div>
        <div style={countTextStyle}>{count} en radar</div>
      </div>

      <div style={radarBodyStyle}>
        {items.length === 0 && !loading ? <div style={emptyTextStyle}>{emptyLabel}</div> : null}

        {items.map((item) => (
          <div key={item.id} style={{ ...itemCardStyle, opacity: item.availabilityActive ? 1 : 0.92 }} title={item.titleHint}>
            <div style={itemMainStyle}>
              <div style={{ fontWeight: 950 }}>{item.title}</div>
              {item.subtitle ? <div style={subtitleStyle}>{item.subtitle}</div> : null}
            </div>

            {!item.availabilityActive && (item.detailHref || item.eventHref) ? (
              <div style={linksRowStyle}>
                {item.detailHref ? (
                  <Link href={item.detailHref} style={inlineLinkStyle}>
                    Ver ficha
                  </Link>
                ) : null}

                {item.eventHref ? (
                  <Link href={item.eventHref} style={inlineLinkStyle}>
                    Ver evento
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div style={badgesRowStyle}>
              <div style={item.stateStyle}>{item.stateLabel}</div>

              <div
                style={{
                  ...availabilityBadgeStyle,
                  background: item.availabilityActive ? "#f0fdf4" : "#f8fafc",
                  color: item.availabilityActive ? "#166534" : "#64748b",
                }}
              >
                {item.availabilityLabel}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const radarShellStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 22,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const radarHeaderStyle: CSSProperties = {
  padding: 16,
  borderBottom: "1px solid #e2e8f0",
  display: "flex",
  justifyContent: "space-between",
  background: "#f8fafc",
};

const countTextStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
};

const radarBodyStyle: CSSProperties = {
  padding: 16,
  display: "grid",
  gap: 10,
};

const emptyTextStyle: CSSProperties = {
  opacity: 0.7,
};

const itemCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 12,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  alignItems: "center",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
};

const itemMainStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  color: "#92400e",
  fontWeight: 700,
};

const linksRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const inlineLinkStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};

const badgesRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const availabilityBadgeStyle: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #e5e7eb",
};
