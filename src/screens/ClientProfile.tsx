import { Link, useParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { api, useApiData } from "../services/api";
import { formatDate } from "../lib/formatDate";
import { formatMoney } from "../lib/formatMoney";

export default function ClientProfile() {
  const { id } = useParams();
  const { data, error } = useApiData(() => api.getClient(id ?? ""), [id]);
  if (!data) return <div className="screen-panel">{error ?? "Loading client"}</div>;
  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">{data.client.full_name}</h1>
          <p className="screen-muted">{data.client.phone} · {data.client.national_id || "No national ID"}</p>
        </div>
      </div>
      <section className="screen-panel">
        <h2>Client profile</h2>
        <div className="screen-grid">
          <div><strong>Phone</strong><p>{data.client.phone}</p></div>
          <div><strong>Address</strong><p>{data.client.address || "-"}</p></div>
          <div><strong>National ID / passport</strong><p>{data.client.national_id || "-"}</p></div>
          <div><strong>Emergency contact</strong><p>{[data.client.emergency_contact_name, data.client.emergency_contact_phone].filter(Boolean).join(" · ") || "-"}</p></div>
        </div>
      </section>
      <section className="screen-panel">
        <h2>Contracts</h2>
        <DataTable
          rows={data.contracts}
          rowKey={(row) => row.id}
          exportCSV={`${data.client.id}-contracts.csv`}
          columns={[
            { key: "id", header: "Contract", render: (row) => <Link to={`/contracts/${row.id}`}>{row.id}</Link> },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "monthly_total", header: "Monthly", render: (row) => formatMoney(row.monthly_total) },
            { key: "start_date", header: "Start", render: (row) => formatDate(row.start_date) }
          ]}
        />
      </section>
      <section className="screen-panel">
        <h2>Payment history</h2>
        <DataTable
          rows={data.payments}
          rowKey={(row) => row.id}
          exportCSV={`${data.client.id}-payments.csv`}
          columns={[
            { key: "id", header: "Payment" },
            { key: "contract_id", header: "Contract" },
            { key: "amount", header: "Amount", render: (row) => formatMoney(row.amount) },
            { key: "method", header: "Method" },
            { key: "reference", header: "Reference" },
            { key: "recorded_at", header: "Recorded", render: (row) => formatDate(row.recorded_at) }
          ]}
        />
      </section>
      <section className="screen-panel">
        <h2>Collections cases</h2>
        <DataTable
          rows={data.cases}
          rowKey={(row) => row.id}
          columns={[
            { key: "id", header: "Case", render: (row) => <Link to={`/collections/${row.id}`}>{row.id}</Link> },
            { key: "contract_id", header: "Contract" },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "opened_at", header: "Opened", render: (row) => formatDate(row.opened_at) }
          ]}
        />
      </section>
      <section className="screen-panel">
        <h2>Audit entries</h2>
        <DataTable
          rows={data.audit}
          rowKey={(row) => row.id}
          exportCSV={`${data.client.id}-audit.csv`}
          columns={[
            { key: "ts", header: "Timestamp", render: (row) => formatDate(row.ts) },
            { key: "actor_id", header: "Actor" },
            { key: "actor_role", header: "Role" },
            { key: "entity_type", header: "Entity" },
            { key: "entity_id", header: "Entity ID" },
            { key: "action", header: "Action" }
          ]}
        />
      </section>
    </div>
  );
}
