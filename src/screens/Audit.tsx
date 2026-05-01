import DataTable from "../components/DataTable";
import { api, useApiData } from "../services/api";
import { formatDate } from "../lib/formatDate";

export default function Audit() {
  const { data } = useApiData(api.getAudit);
  const audit = [...(data ?? [])].sort((a, b) => a.ts.localeCompare(b.ts));
  return (
    <div className="screen">
      <h1 className="screen-title">Audit Log</h1>
      <DataTable
        rows={audit}
        rowKey={(row) => row.id}
        searchKey={(row) => `${row.actor_id} ${row.actor_role} ${row.action} ${row.entity_type} ${row.entity_id}`}
        filters={[
          { label: "COLLECTIONS", predicate: (row) => row.actor_role === "COLLECTIONS" },
          { label: "case", predicate: (row) => row.entity_type === "case" },
          { label: "alert", predicate: (row) => row.entity_type === "alert" }
        ]}
        exportCSV="audit.csv"
        columns={[
          { key: "ts", header: "Timestamp", render: (row) => formatDate(row.ts) },
          { key: "actor_id", header: "Actor" },
          { key: "actor_role", header: "Role" },
          { key: "entity_type", header: "Entity" },
          { key: "entity_id", header: "Entity ID" },
          { key: "action", header: "Action" }
        ]}
      />
    </div>
  );
}
