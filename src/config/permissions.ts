import type { Role } from "../entities/types";

export type Action =
  | "payment.record"
  | "collections.send_sms"
  | "collections.arm_immobilizer"
  | "alert.acknowledge";

const grants: Record<Action, Role[]> = {
  "payment.record": ["ADMIN", "COLLECTIONS", "FINANCIAL_CONTROLLER"],
  "collections.send_sms": ["COLLECTIONS"],
  "collections.arm_immobilizer": ["COLLECTIONS"],
  "alert.acknowledge": ["ADMIN", "CEO", "FINANCIAL_CONTROLLER", "COLLECTIONS", "OPS"]
};

export function can(action: Action, role: Role) {
  return role === "ADMIN" || grants[action].includes(role);
}
