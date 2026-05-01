import { useNavigate } from "react-router-dom";
import { useState } from "react";
import DataTable from "../components/DataTable";
import ConfirmDialog from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import { api, useApiData } from "../services/api";
import { formatMoney } from "../lib/formatMoney";

export default function ContractsList() {
  const navigate = useNavigate();
  const { data, reload } = useApiData(api.getContracts);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ client_name: "", phone: "", monthly_total: "325.00", term_months: "36" });
  const rows = data?.contracts ?? [];
  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">Contracts</h1>
        <button className="primary-button" onClick={() => setCreating(true)}>+ New Contract</button>
      </div>
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/contracts/${row.id}`)}
        searchKey={(row) => `${row.id} ${row.client} ${row.status}`}
        filters={[{ label: "OVERDUE", predicate: (row) => row.status === "OVERDUE" }, { label: "ACTIVE", predicate: (row) => row.status === "ACTIVE" }]}
        exportCSV="contracts.csv"
        columns={[
          { key: "id", header: "ID" },
          { key: "client", header: "Client" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "monthly_total", header: "Monthly total", render: (row) => formatMoney(row.monthly_total), sortValue: (row) => row.monthly_total }
        ]}
      />
      {creating ? (
        <ConfirmDialog
          title="New Contract"
          message={
            <div className="form-grid">
              <input placeholder="Client name" value={form.client_name} onChange={(event) => setForm({ ...form, client_name: event.target.value })} />
              <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <input placeholder="Monthly payment" value={form.monthly_total} onChange={(event) => setForm({ ...form, monthly_total: event.target.value })} />
              <input placeholder="Term" value={form.term_months} onChange={(event) => setForm({ ...form, term_months: event.target.value })} />
            </div>
          }
          confirmLabel="Create"
          onCancel={() => setCreating(false)}
          onConfirm={() => {
            api.createContract({
              client_name: form.client_name,
              phone: form.phone,
              monthly_total: Math.round(Number(form.monthly_total) * 100),
              term_months: Number(form.term_months)
            }).then(() => {
              setCreating(false);
              reload();
            });
          }}
        />
      ) : null}
    </div>
  );
}
