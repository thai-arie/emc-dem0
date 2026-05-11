import type { CollectionAction } from "../../entities/types";
import type { CollectionsCaseRow } from "../../services/api";
import { formatMoney } from "../../lib/formatMoney";
import { elapsedLabel, isApprovedForImmobilize, isImmobilizerPendingApproval, isRestorePendingApprovalForCase, latestAction, minutesSince, type QueueUrgency } from "../../lib/operationsState";
import QueueUrgencyBadge from "./QueueUrgencyBadge";

interface IncidentPanelProps {
  rows: CollectionsCaseRow[];
  actions: CollectionAction[];
  onOpen: (row: CollectionsCaseRow) => void;
}

interface Incident {
  id: string;
  row: CollectionsCaseRow;
  level: QueueUrgency;
  title: string;
  detail: string;
  signal: string;
}

function incidentsForRow(row: CollectionsCaseRow, actions: CollectionAction[]) {
  const request = latestAction(actions, row.id, ["REQUEST_RESTORE", "REQUEST_IMMOBILIZER"]);
  const approval = latestAction(actions, row.id, ["APPROVE_IMMOBILIZER"]);
  const referenceTime = request?.performed_at ?? approval?.performed_at ?? row.next_action_date ?? row.opened_at;
  const waitingMinutes = minutesSince(referenceTime);
  const incidents: Incident[] = [];

  if (row.restore_command_status === "FAILED") {
    incidents.push({
      id: `${row.id}:restore-failed`,
      row,
      level: "Critical",
      title: "GPS command failure",
      detail: `${row.contract_id} restore execution failed. Provider command needs operator review.`,
      signal: "FAILED EXECUTION"
    });
  }

  if (row.restore_command_status === "SENT" && waitingMinutes >= 15) {
    incidents.push({
      id: `${row.id}:ack-timeout`,
      row,
      level: waitingMinutes >= 30 ? "Critical" : "Warning",
      title: "Provider ACK timeout",
      detail: `${row.contract_id} has a command awaiting provider acknowledgement for ${elapsedLabel(waitingMinutes)}.`,
      signal: "ACK PENDING"
    });
  }

  if (isImmobilizerPendingApproval(row) && waitingMinutes >= 15) {
    incidents.push({
      id: `${row.id}:approval-sla`,
      row,
      level: waitingMinutes >= 30 ? "Critical" : "Warning",
      title: waitingMinutes >= 30 ? "Controller SLA breached" : "Controller SLA warning",
      detail: `${row.contract_id} approval has been waiting ${elapsedLabel(waitingMinutes)} with ${row.dpd} DPD exposure.`,
      signal: "APPROVAL AGING"
    });
  }

  if (isApprovedForImmobilize(row) && waitingMinutes >= 15) {
    incidents.push({
      id: `${row.id}:execution-stalled`,
      row,
      level: waitingMinutes >= 30 ? "Critical" : "Warning",
      title: "Execution stalled",
      detail: `${row.contract_id} is approved but not executed after ${elapsedLabel(waitingMinutes)}.`,
      signal: "APPROVED / NOT SENT"
    });
  }

  if (isRestorePendingApprovalForCase(row, actions)) {
    incidents.push({
      id: `${row.id}:restore-blocked`,
      row,
      level: "Critical",
      title: "Restore blocked",
      detail: `${row.contract_id} is immobilized after payment clearance. Access requires controller approval.`,
      signal: "ACCESS HELD"
    });
  }

  return incidents;
}

export default function IncidentPanel({ rows, actions, onOpen }: IncidentPanelProps) {
  const incidents = rows
    .flatMap((row) => incidentsForRow(row, actions))
    .sort((a, b) => {
      const score = { Critical: 3, Warning: 2, Pending: 1, Normal: 0 };
      return score[b.level] - score[a.level] || b.row.dpd - a.row.dpd || b.row.overdue_amount - a.row.overdue_amount;
    })
    .slice(0, 8);

  return (
    <section className="screen-panel incident-panel">
      <div className="panel-title-row">
        <div>
          <h2>Operational incidents</h2>
          <p>Escalations that can delay enforcement, release, or provider confirmation.</p>
        </div>
        <QueueUrgencyBadge level={incidents.some((item) => item.level === "Critical") ? "Critical" : incidents.length ? "Warning" : "Normal"} label={`${incidents.length} open`} />
      </div>
      {incidents.length === 0 ? (
        <div className="incident-empty">
          <strong>No active operational incidents</strong>
          <span>Approval, command, and restore queues are inside normal operating tolerance.</span>
        </div>
      ) : (
        <div className="incident-list">
          {incidents.map((incident) => (
            <button className={`incident-row ${incident.level.toLowerCase()}`} key={incident.id} onClick={() => onOpen(incident.row)}>
              <span className="incident-signal">
                <QueueUrgencyBadge level={incident.level} label={incident.signal} />
              </span>
              <span>
                <strong>{incident.title}</strong>
                <small>{incident.detail}</small>
              </span>
              <span>
                <strong>{incident.row.dpd} DPD</strong>
                <small>{formatMoney(incident.row.overdue_amount)}</small>
              </span>
              <span>
                <strong>{incident.row.gps_status || "UNKNOWN"}</strong>
                <small>{incident.row.plate || incident.row.contract_id}</small>
              </span>
              <span className="approval-link">Open case</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
