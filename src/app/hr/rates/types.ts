export type EmployeeRateType = "HOURLY" | "DAILY" | "MONTHLY" | "PER_SHIFT";

export type EmployeeLite = {
  id: string;
  code: string | null;
  fullName: string;
  kind: string;
  jobTitle: string | null;
  isActive: boolean;
};

export type RateRow = {
  id: string;
  employeeId: string;
  rateType: EmployeeRateType;
  amountCents: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  createdAt: string;
  employee: {
    id: string;
    code: string | null;
    fullName: string;
    kind: string;
    jobTitle: string | null;
  };
  createdByUserId: string | null;
  createdByUser: {
    id: string;
    username: string | null;
    fullName: string | null;
  } | null;
};
