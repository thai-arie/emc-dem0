import type { CollectionAction } from "../../entities/types";
import type { CollectionsCaseRow } from "../../services/api";
import { formatDate } from "../../lib/formatDate";
import { formatMoney } from "../../lib/formatMoney";
import { elapsedLabel, getCommandState, getPendingApprovalRows, getQueueType, getUrgency, latestAction, minutesSince } from "../../lib/operationsState";
import StatusBadge from "../StatusBadge";
import CommandLifecycle from "./CommandLifecycle";
import QueueUrgencyBadge from "./QueueUrgencyBadge";

export function pendingApprovalRows(rows: CollectionsCaseRow[], actions: CollectionAction[] = []) {
  return getPendingApprovalRows(rows, actions);
}

interface ApprovalQueueProps {
  rows: CollectionsCaseRow[];
  actions: CollectionAction[];
  onOpen: (row: CollectionsCaseRow) => void;
}

export default function ApprovalQueue({ rows, actions, onOpen }: ApprovalQueueProps) {
  const orderedRows = [...rows].sort((a, b) => {
    const aAction = latestAction(actions, a.id, ["REQUEST_RESTORE", "REQUEST_IMMOBILIZER", "APPROVE_IMMOBILIZER", "ARM_IMMOBILIZER"]);
    const bAction = latestAction(actions, b.id, ["REQUEST_RESTORE", "REQUEST_IMMOBILIZER", "APPROVE_IMMOBILIZER", "ARM_IMMOBILIZER"]);
    const aWait = minutesSince(aAction?.performed_at ?? a.next_action_date ?? a.opened_at);
    const bWait = minutesSince(bAction?.performed_at ?? b.next_action_date ?? b.opened_at);
    const aUrgency = getUrgency(a, aWait, actions);
    const bUrgency = getUrgency(b, bWait, actions);
    const score = { Critical: 3, Warning: 2, Pending: 1, Normal: 0 };
    return score[bUrgency] - score[aUrgency] || b.dpd - a.dpd || b.overdue_amount - a.overdue_amount;
  });

  return (
    <section className="screen-panel approval-queue">
      <div className="panel-title-row">
        <div>
          <h2>Pending approvals</h2>
          <p>Controller work queue with SLA pressure and command readiness.</p>
        </div>
        <StatusBadge status={orderedRows.length > 0 ? "WARNING" : "ONLINE"} />
      </div>
      {orderedRows.length === 0 ? (
        <div className="empty compact-empty">
          <h2>No data available</h2>
          <p>No controller approvals are waiting.</p>
        </div>
      ) : (
        <div className="approval-list dense">
          {orderedRows.map((row) => {
            const request = latestAction(actions, row.id, ["REQUEST_RESTORE", "REQUEST_IMMOBILIZER"]);
            const approval = latestAction(actions, row.id, ["APPROVE_IMMOBILIZER"]);
            const referenceTime = request?.performed_at ?? approval?.performed_at ?? row.next_action_date ?? row.opened_at;
            const waitingMinutes = minutesSince(referenceTime);
            const urgency = getUrgency(row, waitingMinutes, actions);
            const state = getCommandState(row);
            return (
              <button className={`approval-row dense ${urgency.toLowerCase()}`} key={row.id} onClick={() => onOpen(row)}>
                <span className="approval-primary">
                  <QueueUrgencyBadge level={urgency} label={urgency === "Critical" ? "Escalated" : urgency} />
                  <strong>{row.contract_id}</strong>
                  <small>{row.client}</small>
                </span>
                <span>
                  <strong>{getQueueType(row, actions)}</strong>
                  <small>Requested by {request?.performed_by ?? row.assigned_agent_id ?? "System"}</small>
                  <small>{referenceTime ? formatDate(referenceTime) : "Request time unavailable"}</small>
                </span>
                <span>
                  <strong>Waiting {elapsedLabel(waitingMinutes)}</strong>
                  <small>SLA {waitingMinutes >= 30 ? "breached" : waitingMinutes >= 15 ? "warning" : "active"}</small>
                  <small>Elapsed {elapsedLabel(waitingMinutes)}</small>
                </span>
                <span>
                  <strong>{row.dpd} DPD</strong>
                  <small>Severity {row.dpd >= 7 ? "high" : row.dpd >= 3 ? "medium" : "watch"}</small>
                  <small>{formatMoney(row.overdue_amount)}</small>
                </span>
                <span>
                  <strong>{row.plate || "Vehicle"}</strong>
                  <small>GPS {row.gps_status || "UNKNOWN"}</small>
                  <small>Case {row.status}</small>
                </span>
                <span className="approval-lifecycle">
                  <CommandLifecycle status={state} commandType={state === "FAILED" ? "Failed command" : "Command state"} compact />
                </span>
                <span className="approval-link">Open case</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
