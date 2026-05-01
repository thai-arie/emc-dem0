import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { api, useApiData } from "../services/api";
import { formatMoney } from "../lib/formatMoney";
import { formatDate } from "../lib/formatDate";

export default function ContractDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState<"Overview" | "Schedule" | "Payments" | "Collections" | "Audit">("Overview");
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
            <Link to={`/clients/${data.client.id}`}>{data.client.full_name}</Link> · {data.vehicle.plate}
          </p>
        </div>
        <StatusBadge status={data.contract.status} />
      </div>
      <div className="tabs">
        {(["Overview", "Schedule", "Payments", "Collections", "Audit"] as const).map((item) => (
          <button key={item} className={`tab ${tab === item ? "tab-active" : ""}`} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      {tab === "Overview" ? (
        <div className="screen-panel">
          <h2>Contract summary</h2>
          <p>Client: <Link to={`/clients/${data.client.id}`}>{data.client.full_name}</Link></p>
          <p>Monthly total: {formatMoney(data.contract.monthly_total)}</p>
          <p>Vehicle: <Link to={`/gps?vehicle=${data.vehicle.id}`}>{data.vehicle.brand} {data.vehicle.model} {data.vehicle.plate}</Link></p>
          <p>GPS status: <StatusBadge status={data.gps.status} /></p>
          <div className="screen-grid">
            <div><strong>Vehicle price</strong><p>{formatMoney(data.contract.vehicle_price)}</p></div>
            <div><strong>Down payment</strong><p>{formatMoney(data.contract.down_payment)}</p></div>
            <div><strong>Financed amount</strong><p>{formatMoney(data.contract.financed_amount)}</p></div>
            <div><strong>Monthly payment</strong><p>{formatMoney(data.contract.monthly_total)}</p></div>
            <div><strong>Term</strong><p>{data.contract.term_months} months</p></div>
            <div><strong>Outstanding balance</strong><p>{formatMoney(data.financials.outstanding_balance)}</p></div>
            <div><strong>Paid to date</strong><p>{formatMoney(data.financials.paid_to_date)}</p></div>
            <div><strong>Overdue amount</strong><p>{formatMoney(data.financials.overdue_amount)}</p></div>
          </div>
        </div>
      ) : tab === "Schedule" ? (
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
      ) : tab === "Payments" ? (
        <DataTable
          rows={data.payments}
          rowKey={(row) => row.id}
          exportCSV={`${data.contract.id}-payments.csv`}
          columns={[
            { key: "id", header: "ID" },
            { key: "amount", header: "Amount", render: (row) => formatMoney(row.amount) },
            { key: "method", header: "Method" },
            { key: "reference", header: "Reference" },
            { key: "note", header: "Note" },
            { key: "recorded_at", header: "Recorded", render: (row) => formatDate(row.recorded_at) }
          ]}
        />
      ) : tab === "Collections" ? (
        <DataTable
          rows={data.cases}
          rowKey={(row) => row.id}
          columns={[
            { key: "id", header: "Case" },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "opened_at", header: "Opened", render: (row) => formatDate(row.opened_at) },
            { key: "cured_at", header: "Cured", render: (row) => formatDate(row.cured_at) }
          ]}
        />
      ) : (
        <DataTable
          rows={data.audit}
          rowKey={(row) => row.id}
          exportCSV={`${data.contract.id}-audit.csv`}
          columns={[
            { key: "ts", header: "Timestamp", render: (row) => formatDate(row.ts) },
            { key: "actor_id", header: "Actor" },
            { key: "actor_role", header: "Role" },
            { key: "entity_type", header: "Entity" },
            { key: "entity_id", header: "Entity ID" },
            { key: "action", header: "Action" }
          ]}
        />
      )}
    </div>
  );
}
