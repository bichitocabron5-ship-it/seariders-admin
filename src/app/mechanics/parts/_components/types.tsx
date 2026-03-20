// src/app/mechanics/parts/_components/types.tsx
export type PartRow = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  unit: string | null;
  stockQty: number;
  minStockQty: number;
  costPerUnitCents: number | null;
  supplierName: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaymentMethod =
  | ""
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "BIZUM"
  | "DIRECT_DEBIT"
  | "OTHER";