import { Link, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../store/auth";
import { api, useApiData } from "../services/api";
import EmptyState from "../components/EmptyState";

export default function CollectionsWorkspace() {
  const navigate = useNavigate();
  const role = useAuth((state) => state.user?.role);
  const { data } = useApiData(api.getCollections);
  const rows = data?.cases ?? [];
  if (role === "OPS") return <EmptyState title="Collections hidden" hint="This screen is not available for Ops." />;
  return (
    <div className="screen">
      <h1 className="screen-title">Collections</h1>
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/collections/${row.id}`)}
        searchKey={(row) => `${row.id} ${row.contract_id} ${row.client} ${row.status}`}
        filters={[{ label: "OPEN", predicate: (row) => row.status === "OPEN" }, { label: "IMMOBILIZER_ARMED", predicate: (row) => row.status === "IMMOBILIZER_ARMED" }]}
        exportCSV="collections.csv"
        columns={[
          { key: "id", header: "ID" },
          { key: "contract_id", header: "Contract" },
          { key: "client", header: "Client", render: (row) => <Link onClick={(event) => event.stopPropagation()} to={`/clients/${row.client_id}`}>{row.client}</Link> },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> }
        ]}
      />
    </div>
  );
}
