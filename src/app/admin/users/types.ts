export type RoleName = "ADMIN" | "STORE" | "PLATFORM" | "BOOTH" | "BAR" | "MECHANIC" | "HR";

export type EmployeeLite = {
  id: string;
  code: string | null;
  fullName: string;
  kind: string;
  isActive: boolean;
};

export type UserRow = {
  id: string;
  employeeId: string | null;
  fullName: string;
  username: string;
  email: string | null;
  passportCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  employee?: EmployeeLite | null;
  roles: Array<{ userId: string; roleId: string; role: { id: string; name: RoleName } }>;
};

export const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: "Administrador",
  STORE: "Tienda",
  PLATFORM: "Plataforma",
  BOOTH: "Carpa",
  BAR: "Bar",
  MECHANIC: "Mecánica",
  HR: "RR. HH.",
};
