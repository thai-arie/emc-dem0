import type { Role } from "../entities/types";

export type Action =
  | "payment.record"
  | "collections.send_sms"
  | "collections.arm_immobilizer"
  | "alert.acknowledge";

const grants: Record<Action, Role[]> = {
  "payment.record": ["COLLECTIONS"],
  "collections.send_sms": ["COLLECTIONS"],
  "collections.arm_immobilizer": ["COLLECTIONS"],
  "alert.acknowledge": ["CEO", "COLLECTIONS", "OPS"]
};

export function can(action: Action, role: Role) {
  return grants[action].includes(role);
}
