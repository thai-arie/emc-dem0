import type { PropsWithChildren } from "react";
import type { Role } from "../../entities/types";
import { useAuth } from "../../store/auth";

export default function RoleGate({ roles, children }: PropsWithChildren<{ roles: Role[] }>) {
  const role = useAuth((state) => state.user?.role);
  if (!role || (role !== "ADMIN" && !roles.includes(role))) return null;
  return <>{children}</>;
}
