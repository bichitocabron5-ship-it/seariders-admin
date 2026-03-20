// src/lib/auth-redirect.ts
import { RoleName } from "@prisma/client";

export function redirectPathFromRole(role: RoleName | string): string {
  switch (role) {
    case "STORE":
      return "/store";
    case "BOOTH":
      return "/booth";
    case "PLATFORM":
      return "/platform";
    case "BAR":
      return "/bar";
    case "MECHANIC":
      return "/mechanics";
    case "HR":
      return "/hr";
    case "ADMIN":
    default:
      return "/admin";
  }
}