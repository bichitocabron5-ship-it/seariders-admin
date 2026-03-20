// src/app/admin/types.ts
export type AssetType =
  | "BOAT"
  | "TOWBOAT"
  | "JETCAR"
  | "PARASAILING"
  | "FLYBOARD"
  | "TOWABLE"
  | "OTHER";

export type AssetStatus = "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE";

export type AssetRow = {
  id: string;
  type: AssetType;
  status: AssetStatus;

  name: string;
  code: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  chassisNumber: string | null;
  maxPax: number | null;
  note: string | null;
  isMotorized: boolean;

  // mecánica
  currentHours: number | null;
  lastServiceHours: number | null;
  serviceIntervalHours: number;
  serviceWarnHours: number;

  createdAt: string;
  updatedAt: string;
};

// Si ya tienes estos, perfecto:
export type JetskiStatus = "OPERATIONAL" | "OUT_OF_SERVICE" | "RETIRED";

export type JetskiRow = {
  id: string;
  number: number;
  plate: string | null;
  chassisNumber: string | null;
  model: string | null;
  year: number | null;
  owner: string | null;
  maxPax: number | null;
  status: JetskiStatus;

  currentHours: number | null;
  lastServiceHours: number | null;
  serviceIntervalHours: number;
  serviceWarnHours: number;

  createdAt: string;
  updatedAt: string;
};
