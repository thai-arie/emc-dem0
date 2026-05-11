import type { CollectionAction } from "../../entities/types";
import type { CollectionsCaseRow } from "../../services/api";
import { elapsedLabel, isRestorePendingApprovalForCase, latestAction, minutesSince } from "../../lib/operationsState";

interface ControllerOpsPanelProps {
  rows: CollectionsCaseRow[];
  pendingRows: CollectionsCaseRow[];
  actions: CollectionAction[];
}

function pendingAge(row: CollectionsCaseRow, actions: CollectionAction[]) {
  const request = latestAction(actions, row.id, ["REQUEST_RESTORE", "REQUEST_IMMOBILIZER"]);
  const approval = latestAction(actions, row.id, ["APPROVE_IMMOBILIZER"]);
  return minutesSince(request?.performed_at ?? approval?.performed_at ?? row.next_action_date ?? row.opened_at);
}

export default function ControllerOpsPanel({ rows, pendingRows, actions }: ControllerOpsPanelProps) {
  const oldestPending = pendingRows.reduce((max, row) => Math.max(max, pendingAge(row, actions)), 0);
  const overSla = pendingRows.filter((row) => pendingAge(row, actions) >= 30).length;
  const warningSla = pendingRows.filter((row) => {
    const age = pendingAge(row, actions);
    return age >= 15 && age < 30;
  }).length;
  const awaitingRestore = rows.filter((row) => isRestorePendingApprovalForCase(row, actions)).length;
  const awaitingAck = rows.filter((row) => row.restore_command_status === "SENT").length;
  const failedExecutions = rows.filter((row) => row.restore_command_status === "FAILED").length;

  return (
    <section className="controller-ops-panel">
      <div className="controller-ops-header">
        <span>Controller operations</span>
        <strong>{overSla + failedExecutions > 0 ? "Pressure elevated" : pendingRows.length ? "Approval queue active" : "Normal tolerance"}</strong>
      </div>
      <div className="controller-ops-grid">
        <div className={overSla ? "controller-ops-cell critical" : "controller-ops-cell"}>
          <span>Over SLA</span>
          <strong>{overSla}</strong>
        </div>
        <div className={warningSla ? "controller-ops-cell warning" : "controller-ops-cell"}>
          <span>SLA warning</span>
          <strong>{warningSla}</strong>
        </div>
        <div className={oldestPending >= 30 ? "controller-ops-cell critical" : oldestPending >= 15 ? "controller-ops-cell warning" : "controller-ops-cell"}>
          <span>Oldest pending</span>
          <strong>{elapsedLabel(oldestPending)}</strong>
        </div>
        <div className={awaitingRestore ? "controller-ops-cell critical" : "controller-ops-cell"}>
          <span>Awaiting restore</span>
          <strong>{awaitingRestore}</strong>
        </div>
        <div className={awaitingAck ? "controller-ops-cell warning" : "controller-ops-cell"}>
          <span>Awaiting ACK</span>
          <strong>{awaitingAck}</strong>
        </div>
        <div className={failedExecutions ? "controller-ops-cell critical" : "controller-ops-cell"}>
          <span>Failed execution</span>
          <strong>{failedExecutions}</strong>
        </div>
      </div>
    </section>
  );
}
