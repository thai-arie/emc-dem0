import type { AuditEntry, Role } from "../entities/types";
import { nextId } from "./id";

export function auditEntry(
  actor_id: string,
  actor_role: Role,
  entity_type: AuditEntry["entity_type"],
  entity_id: string,
  action: string,
  before: unknown | null,
  after: unknown | null
): AuditEntry {
  return {
    id: nextId("AUD"),
    ts: new Date().toISOString(),
    actor_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after
  };
}
