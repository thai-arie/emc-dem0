import type { Role } from "../entities/types";

export type Action =
  | "payment.record"
  | "collections.send_sms"
  | "collections.arm_immobilizer"
  | "alert.acknowledge";

const grants: Record<Action, Role[]> = {
  "payment.record": ["ADMIN", "COLLECTIONS_AGENT", "FINANCE"],
  "collections.send_sms": ["COLLECTIONS_AGENT"],
  "collections.arm_immobilizer": ["OPS"],
  "alert.acknowledge": ["ADMIN", "FINANCE", "COLLECTIONS_AGENT", "OPS", "CONTROLLER"]
};

export function can(action: Action, role: Role) {
  return role === "ADMIN" || grants[action].includes(role);
}
