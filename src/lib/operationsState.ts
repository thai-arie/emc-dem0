import type { CollectionAction } from "../entities/types";
import type { CollectionsCaseRow } from "../services/api";

export type QueueUrgency = "Normal" | "Pending" | "Warning" | "Critical";
export type CommandState = "REQUESTED" | "APPROVED" | "SENT" | "ACKNOWLEDGED" | "FAILED" | "";
export const RESTORE_REQUEST_NOTE = "RESTORE_ACCESS_REQUESTED";

export function getWorkflowNextAction(row: Pick<CollectionsCaseRow, "workflow_next_action_type" | "next_action_type"> | null | undefined) {
  return row?.workflow_next_action_type ?? row?.next_action_type ?? "";
}

export function isImmobilizerPendingApproval(row: CollectionsCaseRow | null | undefined) {
  return getWorkflowNextAction(row) === "APPROVE_IMMOBILIZER";
}

export function isApprovedForImmobilize(row: CollectionsCaseRow | null | undefined) {
  return !isImmobilizerPendingApproval(row) && row?.status === "APPROVED";
}

export function isRestoreApproved(row: CollectionsCaseRow | null | undefined) {
  return row?.restore_command_status === "APPROVED";
}

export function hasRestoreApprovalSignal(row: CollectionsCaseRow | null | undefined) {
  const nextAction = getWorkflowNextAction(row);
  return (
    row?.restore_decision_reason === "REQUIRE_RESTORE_APPROVAL" ||
    nextAction === "APPROVE_RESTORE" ||
    nextAction === "APPROVE_RESTORE_ACCESS" ||
    nextAction === "RESTORE_APPROVAL"
  );
}

export function isRestorePendingApproval(row: CollectionsCaseRow | null | undefined) {
  return hasRestoreApprovalSignal(row) && !row?.restore_command_status;
}

export function isRestoreRequestAction(action: CollectionAction | null | undefined) {
  return action?.type === "REQUEST_RESTORE" || (action?.type === "NOTE" && String(action.note || "").includes(RESTORE_REQUEST_NOTE));
}

export function hasRestoreRequest(actions: CollectionAction[], caseId: string | null | undefined) {
  if (!caseId) return false;
  return actions.some((action) => action.case_id === caseId && isRestoreRequestAction(action));
}

export function isRestorePendingApprovalForCase(row: CollectionsCaseRow | null | undefined, actions: CollectionAction[]) {
  if (!row) return false;
  return (isRestorePendingApproval(row) || hasRestoreRequest(actions, row.id)) && !row.restore_command_status;
}

export function getQueueType(row: CollectionsCaseRow, actions: CollectionAction[] = []) {
  if (row.restore_command_status === "FAILED") return "Restore command failed";
  if (isRestorePendingApprovalForCase(row, actions)) return "Restore approval";
  if (isImmobilizerPendingApproval(row)) return "Immobilizer approval";
  return "Controller review";
}

export function getCommandState(row: CollectionsCaseRow): CommandState {
  if (row.restore_command_status === "FAILED") return "FAILED";
  if (row.restore_command_status === "SENT") return "SENT";
  if (row.restore_command_status === "APPROVED") return "APPROVED";
  if (isApprovedForImmobilize(row)) return "APPROVED";
  if (isImmobilizerPendingApproval(row)) return "REQUESTED";
  return "";
}

export function getUrgency(row: CollectionsCaseRow, waitingMinutes: number, actions: CollectionAction[] = []): QueueUrgency {
  if (row.restore_command_status === "FAILED") return "Critical";
  if (waitingMinutes >= 30) return "Critical";
  if (isRestorePendingApprovalForCase(row, actions)) return "Critical";
  if (waitingMinutes >= 15) return "Warning";
  if (row.dpd >= 7) return "Warning";
  return "Pending";
}

export function getPendingApprovalRows(rows: CollectionsCaseRow[], actions: CollectionAction[] = []) {
  return rows.filter((row) => isImmobilizerPendingApproval(row) || isRestorePendingApprovalForCase(row, actions));
}

export function latestAction(actions: CollectionAction[], caseId: string, types: string[]) {
  return actions
    .filter((action) => action.case_id === caseId && types.includes(action.type))
    .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())[0];
}

export function minutesSince(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 60000));
}

export function elapsedLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
