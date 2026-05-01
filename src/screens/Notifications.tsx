import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { actorFromUser, api, useApiData } from "../services/api";
import { useAuth } from "../store/auth";
import { useUi } from "../store/ui";
import { formatDate } from "../lib/formatDate";

export default function Notifications() {
  const { data, reload } = useApiData(api.getAlerts);
  const alerts = data ?? [];
  const user = useAuth((state) => state.user);
  const toast = useUi((state) => state.addToast);
  return (
    <div className="screen">
      <h1 className="screen-title">Notifications</h1>
      <DataTable
        rows={alerts}
        rowKey={(row) => row.id}
        searchKey={(row) => `${row.title} ${row.message} ${row.severity}`}
        filters={[{ label: "Unresolved", predicate: (row) => !row.resolved_at }, { label: "CRITICAL", predicate: (row) => row.severity === "CRITICAL" }]}
        columns={[
          { key: "severity", header: "Severity", render: (row) => <StatusBadge status={row.severity} /> },
          { key: "title", header: "Title" },
          { key: "message", header: "Message" },
          { key: "created_at", header: "Created", render: (row) => formatDate(row.created_at) },
          { key: "resolved_at", header: "Resolved", render: (row) => formatDate(row.resolved_at) },
          { key: "action", header: "Action", render: (row) => !row.acknowledged_at ? <button className="secondary-button" onClick={() => { api.acknowledgeAlert(row.id, actorFromUser(user)).then(() => { toast("Alert acknowledged"); reload(); }); }}>Acknowledge</button> : "Acknowledged" }
        ]}
      />
    </div>
  );
}
