import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../store/auth";
import { api, useApiData } from "../services/api";
import EmptyState from "../components/EmptyState";
import { formatMoney } from "../lib/formatMoney";
import { formatDate } from "../lib/formatDate";

export default function CollectionsWorkspace() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const role = user?.role;
  const { data } = useApiData(api.getCollections);
  const rows = data?.cases ?? [];
  if (role === "OPS" || role === "ADMIN") return <EmptyState title="Collections hidden" hint="This screen is not available for this role." />;
  return (
    <div className="screen">
      <h1 className="screen-title">Collections</h1>
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
