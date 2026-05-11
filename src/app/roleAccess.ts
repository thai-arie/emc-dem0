import type { Role } from "../entities/types";

export const defaultRouteByRole: Record<Role, string> = {
  ADMIN: "/overview",
  SALES: "/finance/applications",
  FINANCE: "/finance/portfolio",
  COLLECTIONS_AGENT: "/collections",
  OPS: "/gps",
  CONTROLLER: "/collections",
  VIEWER: "/overview"
};

export function routeForRole(role: Role | undefined | null) {
  return role ? defaultRouteByRole[role] : "/login";
}

export function canAccessRoute(role: Role, pathname: string) {
  if (role === "ADMIN") return true;
  if (role === "VIEWER") return true;

  if (pathname === "/" || pathname === "/overview") {
    return role !== "SALES";
  }

  if (pathname.startsWith("/admin")) return false;

  if (pathname.startsWith("/finance/applications")) return role === "SALES" || role === "FINANCE";
  if (pathname.startsWith("/finance/portfolio")) return role === "FINANCE";
  if (pathname.startsWith("/finance/vehicle-catalog")) return role === "SALES" || role === "FINANCE";
  if (pathname.startsWith("/finance/pricing-tiers")) return role === "SALES" || role === "FINANCE";
  if (pathname.startsWith("/finance/financial-partners")) return role === "FINANCE";
  if (pathname.startsWith("/finance/insurance-partners")) return role === "FINANCE";
  if (pathname.startsWith("/finance/bank-accounts")) return role === "FINANCE";

  if (pathname === "/collections") return role === "COLLECTIONS_AGENT" || role === "CONTROLLER";
  if (pathname.startsWith("/collections/")) return role === "COLLECTIONS_AGENT" || role === "CONTROLLER" || role === "OPS";
  if (pathname.startsWith("/gps")) return role === "COLLECTIONS_AGENT" || role === "CONTROLLER" || role === "OPS";
  if (pathname.startsWith("/devices")) return role === "COLLECTIONS_AGENT" || role === "CONTROLLER" || role === "OPS";
  if (pathname.startsWith("/payments")) return role === "COLLECTIONS_AGENT" || role === "FINANCE";
  if (pathname.startsWith("/contracts/void")) return false;
  if (pathname.startsWith("/contracts/")) return role === "FINANCE" || role === "COLLECTIONS_AGENT" || role === "OPS" || role === "CONTROLLER";
  if (pathname.startsWith("/contracts")) return role === "FINANCE" || role === "OPS" || role === "CONTROLLER";
  if (pathname.startsWith("/clients")) return role === "FINANCE" || role === "COLLECTIONS_AGENT" || role === "OPS" || role === "CONTROLLER";
  if (pathname.startsWith("/reporting")) return role === "FINANCE" || role === "CONTROLLER";
  if (pathname.startsWith("/notifications")) return role === "COLLECTIONS_AGENT" || role === "OPS" || role === "CONTROLLER";
  if (pathname.startsWith("/audit")) return role === "FINANCE" || role === "CONTROLLER";

  return false;
}
