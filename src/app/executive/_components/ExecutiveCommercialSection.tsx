"use client";

import {
  ExecutiveDataTable,
  ExecutiveSection,
  executiveStyles,
} from "@/components/executive-ui";

type TableRow = {
  nombre: string;
  reservas: string;
  ventas: string;
  ticket: string;
};

export default function ExecutiveCommercialSection({
  marketingRows,
  channelRows,
  serviceRows,
}: {
  marketingRows: TableRow[];
  channelRows: TableRow[];
  serviceRows: TableRow[];
}) {
  return (
    <div style={executiveStyles.twoCol}>
      <ExecutiveSection title="Captación" subtitle="Origen declarado por el cliente en reservas del mes.">
        <ExecutiveDataTable
          columns={[
            { key: "nombre", label: "Cómo nos conoció" },
            { key: "reservas", label: "Reservas", align: "right" },
            { key: "ventas", label: "Ventas", align: "right" },
            { key: "ticket", label: "Ticket", align: "right" },
          ]}
          rows={marketingRows}
        />
      </ExecutiveSection>

      <ExecutiveSection title="Rendimiento comercial" subtitle="Top de canales y servicios por ventas.">
        <div style={{ display: "grid", gap: 16 }}>
          <ExecutiveDataTable
            columns={[
              { key: "nombre", label: "Canal" },
              { key: "reservas", label: "Reservas", align: "right" },
              { key: "ventas", label: "Ventas", align: "right" },
              { key: "ticket", label: "Ticket", align: "right" },
            ]}
            rows={channelRows}
          />

          <ExecutiveDataTable
            columns={[
              { key: "nombre", label: "Servicio" },
              { key: "reservas", label: "Reservas", align: "right" },
              { key: "ventas", label: "Ventas", align: "right" },
              { key: "ticket", label: "Ticket", align: "right" },
            ]}
            rows={serviceRows}
          />
        </div>
      </ExecutiveSection>
    </div>
  );
}
