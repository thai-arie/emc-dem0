import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../store/auth";
import { api, useApiData } from "../services/api";
import EmptyState from "../components/EmptyState";
import { formatMoney } from "../lib/formatMoney";
import { formatDate } from "../lib/formatDate";
import ApprovalQueue, { pendingApprovalRows } from "../components/operations/ApprovalQueue";
import OperationalKpiStrip from "../components/operations/OperationalKpiStrip";
import IncidentPanel from "../components/operations/IncidentPanel";
import ControllerOpsPanel from "../components/operations/ControllerOpsPanel";
import QueuePressureStrip from "../components/operations/QueuePressureStrip";
import type { CollectionAction } from "../entities/types";
import { isImmobilizerPendingApproval, isRestorePendingApprovalForCase, latestAction, minutesSince } from "../lib/operationsState";

export default function CollectionsWorkspace() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const role = user?.role;
  const { data } = useApiData(api.getCollections);
  const rawRows = data?.cases ?? [];
  const actions = data?.actions ?? [];
  const rows = [...rawRows].sort((a, b) => {
    const aAction = a.gps_status === "IMMOBILIZER_ARMED" || isImmobilizerPendingApproval(a) ? 1 : 0;
    const bAction = b.gps_status === "IMMOBILIZER_ARMED" || isImmobilizerPendingApproval(b) ? 1 : 0;
    return bAction - aAction || b.dpd - a.dpd || b.overdue_amount - a.overdue_amount;
  });
  const operationalCases = rows.filter((row) =>
    (row.status !== "CLOSED" && row.status !== "CURED") ||
    row.gps_status === "IMMOBILIZER_ARMED" ||
    isRestorePendingApprovalForCase(row, actions)
  );
  const pendingApprovals = pendingApprovalRows(operationalCases, actions);
  const immobilizedCount = operationalCases.filter((row) => row.gps_status === "IMMOBILIZER_ARMED").length;
  const onlineCount = rows.filter((row) => row.gps_status === "ONLINE").length;
  const totalOverdue = rows.reduce((sum, row) => sum + row.overdue_amount, 0);
  const pendingAge = (row: typeof rows[number]) => {
    const request = latestAction(actions, row.id, ["REQUEST_RESTORE", "REQUEST_IMMOBILIZER"]);
    const approval = latestAction(actions, row.id, ["APPROVE_IMMOBILIZER"]);
    return minutesSince(request?.performed_at ?? approval?.performed_at ?? row.next_action_date ?? row.opened_at);
  };
  const pressureWarning = pendingApprovals.filter((row) => {
    const age = pendingAge(row);
    return age >= 15 && age < 30;
  }).length;
  const pressureCritical = pendingApprovals.filter((row) => pendingAge(row) >= 30 || isRestorePendingApprovalForCase(row, actions)).length;
  const pressureFailed = rows.filter((row) => row.restore_command_status === "FAILED").length;

  if (role === "OPS" || role === "ADMIN") return <EmptyState title="Collections hidden" hint="This screen is not available for this role." />;
  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Collections</h1>
          <p className="screen-muted">Daily enforcement queue, approvals, and case risk.</p>
        </div>
      </div>

      <OperationalKpiStrip
        items={[
          { label: "Active cases", value: operationalCases.length },
          { label: "Pending approvals", value: pendingApprovals.length, tone: "pending" },
          { label: "Immobilized vehicles", value: immobilizedCount, tone: "critical" },
          { label: "Vehicles online", value: onlineCount },
          { label: "Overdue amount", value: formatMoney(totalOverdue) }
        ]}
      />

      <QueuePressureStrip pending={pendingApprovals.length} warning={pressureWarning} critical={pressureCritical} failed={pressureFailed} />

      <ControllerOpsPanel rows={operationalCases} pendingRows={pendingApprovals} actions={actions} />

      <IncidentPanel rows={operationalCases} actions={actions} onOpen={(row) => navigate(`/collections/${row.id}`)} />

      <ApprovalQueue rows={pendingApprovals} actions={actions} onOpen={(row) => navigate(`/collections/${row.id}`)} />

      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/collections/${row.id}`)}
        searchKey={(row) => `${row.id} ${row.contract_id} ${row.client} ${row.status} ${row.assigned_agent_id}`}
        filters={[
          { label: "Overdue only", predicate: (row) => row.overdue_amount > 0 },
          { label: "Critical only", predicate: (row) => row.gps_status === "IMMOBILIZER_ARMED" },
          { label: "1-7 DPD", predicate: (row) => row.dpd >= 1 && row.dpd <= 7 },
          { label: "8-30 DPD", predicate: (row) => row.dpd >= 8 && row.dpd <= 30 },
          { label: "31+ DPD", predicate: (row) => row.dpd >= 31 },
          { label: "Assigned", predicate: (row) => row.assigned_agent_id === user?.id }
        ]}
        exportCSV="collections.csv"
        columns={[
          { key: "contract_id", header: "Contract" },
          { key: "client", header: "Client", render: (row) => <Link onClick={(event) => event.stopPropagation()} to={`/clients/${row.client_id}`}>{row.client}</Link> },
          { key: "dpd", header: "DPD", sortValue: (row) => row.dpd },
          { key: "overdue_amount", header: "Overdue amount", render: (row) => formatMoney(row.overdue_amount), sortValue: (row) => row.overdue_amount },
          { key: "status", header: "Case status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "next_action_type", header: "Next action", render: (row) => `${row.next_action_type}${row.next_action_date ? ` · ${formatDate(row.next_action_date)}` : ""}` },
          { key: "decision_reason", header: "DECISION" },
          { key: "last_action", header: "Last action" },
          { key: "gps_status", header: "GPS status", render: (row) => <StatusBadge status={row.gps_status} /> },
          { key: "assigned_agent_id", header: "Assigned agent" }
        ]}
      />
    </div>
  );
}
