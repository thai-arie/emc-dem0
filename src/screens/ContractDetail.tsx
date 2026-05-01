import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { api, useApiData } from "../services/api";
import { formatMoney } from "../lib/formatMoney";
import { formatDate } from "../lib/formatDate";

export default function ContractDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState<"Overview" | "Schedule">("Overview");
  const detail = useApiData(() => api.getContract(id ?? ""), [id]);
  const schedule = useApiData(() => api.getInstallments(id), [id]);
  const data = detail.data;
  const installments = schedule.data?.installments ?? [];
  if (!data) return <div className="screen-panel">{detail.error ?? "Loading contract"}</div>;
  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">{data.contract.id}</h1>
          <p className="screen-muted">
            {data.client.full_name} · {data.vehicle.plate}
          </p>
        </div>
        <StatusBadge status={data.contract.status} />
      </div>
      <div className="tabs">
        {(["Overview", "Schedule"] as const).map((item) => (
          <button key={item} className={`tab ${tab === item ? "tab-active" : ""}`} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      {tab === "Overview" ? (
        <div className="screen-panel">
          <p>Client: {data.client.full_name}</p>
          <p>Monthly total: {formatMoney(data.contract.monthly_total)}</p>
          <p>Vehicle: <Link to={`/gps?vehicle=${data.vehicle.id}`}>{data.vehicle.brand} {data.vehicle.model} {data.vehicle.plate}</Link></p>
          <p>GPS status: <StatusBadge status={data.gps.status} /></p>
        </div>
      ) : (
        <DataTable
          rows={installments}
          rowKey={(row) => row.id}
          searchKey={(row) => `${row.id} ${row.status}`}
          filters={[{ label: "OVERDUE", predicate: (row) => row.status === "OVERDUE" }, { label: "PAID", predicate: (row) => row.status === "PAID" }]}
          columns={[
            { key: "seq_no", header: "Seq", sortValue: (row) => row.seq_no },
            { key: "due_date", header: "Due date", render: (row) => formatDate(row.due_date) },
            { key: "amount_due", header: "Amount", render: (row) => formatMoney(row.amount_due), sortValue: (row) => row.amount_due },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> }
          ]}
        />
      )}
    </div>
  );
}
