import { useState } from "react";
import DataTable from "../components/DataTable";
import ConfirmDialog from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import RoleGate from "../app/layout/RoleGate";
import { actorFromUser, api, useApiData } from "../services/api";
import { useAuth } from "../store/auth";
import { useUi } from "../store/ui";
import { formatDate } from "../lib/formatDate";
import { formatMoney } from "../lib/formatMoney";

export default function Payments() {
  const [installmentId, setInstallmentId] = useState<string | null>(null);
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const user = useAuth((state) => state.user);
  const toast = useUi((state) => state.addToast);
  const { data, reload } = useApiData(() => api.getInstallments());
  const overdue = (data?.installments ?? []).filter((item) => item.status === "OVERDUE");
  const selected = overdue.find((item) => item.id === installmentId);
  return (
    <div className="screen">
      <h1 className="screen-title">Payments</h1>
      <section className="screen-panel">
        <h2>Overdue installments</h2>
        <DataTable
          rows={overdue}
          rowKey={(row) => row.id}
          searchKey={(row) => `${row.contract_id} ${row.client}`}
          columns={[
            { key: "contract_id", header: "Contract" },
            { key: "client", header: "Client" },
            { key: "due_date", header: "Due date", render: (row) => formatDate(row.due_date) },
            { key: "amount_due", header: "Amount", render: (row) => formatMoney(row.amount_due), sortValue: (row) => row.amount_due },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "action", header: "Action", render: (row) => <RoleGate roles={["COLLECTIONS"]}><button className="secondary-button" onClick={(event) => { event.stopPropagation(); setInstallmentId(row.id); }}>Record payment</button></RoleGate> }
          ]}
        />
      </section>
      <section className="screen-panel">
        <h2>Recent payments</h2>
        <DataTable
          rows={data?.payments ?? []}
          rowKey={(row) => row.id}
          columns={[
            { key: "id", header: "ID" },
            { key: "contract_id", header: "Contract" },
            { key: "amount", header: "Amount", render: (row) => formatMoney(row.amount) },
            { key: "recorded_at", header: "Recorded at", render: (row) => formatDate(row.recorded_at) }
          ]}
        />
      </section>
      {selected ? (
        <ConfirmDialog
          title="Record payment"
          message={
            <div className="form-grid">
              <p>Record {formatMoney(selected.amount_due)} for {selected.contract_id}?</p>
              <select value={method} onChange={(event) => setMethod(event.target.value as "cash" | "transfer")}>
                <option value="cash">cash</option>
                <option value="transfer">transfer</option>
              </select>
            </div>
          }
          confirmLabel="Record payment"
          onCancel={() => setInstallmentId(null)}
          onConfirm={() => {
            api.recordPayment({ installment_id: selected.id, method, ...actorFromUser(user) }).then(() => {
              toast("Payment recorded");
              setInstallmentId(null);
              reload();
            });
          }}
        />
      ) : null}
    </div>
  );
}
