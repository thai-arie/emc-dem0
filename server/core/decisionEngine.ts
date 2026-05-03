export type CollectionsNextAction =
  | "NONE"
  | "COLLECT_PAYMENT"
  | "SEND_REMINDER"
  | "CALL_ATTEMPT"
  | "IMMOBILIZE_REQUEST";

export interface DecisionInput {
  overdueAmount: number;
  dpd: number;
  gpsStatus: string;
}

export interface DecisionResult {
  nextAction: CollectionsNextAction;
  reason: string;
}

export type RestoreDecisionReason = "AUTO_RESTORE" | "REQUIRE_RESTORE_APPROVAL";

export interface RestoreDecisionInput {
  dpd: number;
  overdueAmount: number;
  otherActiveOverdueContracts: number;
}

export interface RestoreDecisionResult {
  shouldAutoRestore: boolean;
  decisionReason: RestoreDecisionReason;
}

export function decideNextAction(input: DecisionInput): DecisionResult {
  const overdueAmount = Number(input.overdueAmount || 0);
  const dpd = Number(input.dpd || 0);

  if (overdueAmount <= 0) {
    return { nextAction: "NONE", reason: "No overdue balance" };
  }

  if (dpd >= 7 && input.gpsStatus === "IMMOBILIZER_ARMED") {
    return { nextAction: "COLLECT_PAYMENT", reason: "7+ DPD and immobilizer is armed" };
  }

  if (dpd >= 7) {
    return { nextAction: "IMMOBILIZE_REQUEST", reason: "7+ DPD and GPS is not armed" };
  }

  if (dpd >= 5) {
    return { nextAction: "CALL_ATTEMPT", reason: "5-6 DPD requires call attempt" };
  }

  if (dpd >= 3) {
    return { nextAction: "SEND_REMINDER", reason: "3-4 DPD requires reminder" };
  }

  if (dpd >= 1) {
    return { nextAction: "COLLECT_PAYMENT", reason: "1-2 DPD payment collection" };
  }

  return { nextAction: "NONE", reason: "No overdue days" };
}

export function decideRestoreAccess(input: RestoreDecisionInput): RestoreDecisionResult {
  const dpd = Number(input.dpd || 0);
  const overdueAmount = Number(input.overdueAmount || 0);
  const otherActiveOverdueContracts = Number(input.otherActiveOverdueContracts || 0);

  if (dpd === 0 && overdueAmount === 0 && otherActiveOverdueContracts === 0) {
    return { shouldAutoRestore: true, decisionReason: "AUTO_RESTORE" };
  }

  return { shouldAutoRestore: false, decisionReason: "REQUIRE_RESTORE_APPROVAL" };
}
