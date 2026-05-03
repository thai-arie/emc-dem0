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
  const [method, setMethod] = useState<"cash" | "transfer" | "aba" | "wing">("cash");
  const [allocationType, setAllocationType] = useState<"" | "PAY_AHEAD" | "PRINCIPAL_PREPAYMENT">("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const user = useAuth((state) => state.user);
  const toast = useUi((state) => state.addToast);
  const { data, reload } = useApiData(() => api.getInstallments());
  const overdue = (data?.installments ?? []).filter((item) => item.status === "OVERDUE");
  const selected = overdue.find((item) => item.id === installmentId);
  const paymentAmount = selected ? Math.round(Number(amount || selected.amount_due / 100) * 100) : 0;
  const needsAllocation = selected ? paymentAmount > selected.amount_due : false;
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
            { key: "action", header: "Action", render: (row) => <RoleGate roles={["COLLECTIONS", "FINANCIAL_CONTROLLER"]}><button className="secondary-button" onClick={(event) => { event.stopPropagation(); setInstallmentId(row.id); setAmount(String(row.amount_due / 100)); setAllocationType(""); setIdempotencyKey(crypto.randomUUID()); }}>Record payment</button></RoleGate> }
          ]}
        />
      </section>
      <section className="screen-panel">
        <h2>Recent payments</h2>
        <DataTable
          rows={data?.payments ?? []}
          rowKey={(row) => row.id}
          exportCSV="payments.csv"
          columns={[
            { key: "id", header: "ID" },
            { key: "contract_id", header: "Contract" },
            { key: "amount", header: "Amount", render: (row) => formatMoney(row.amount), sortValue: (row) => row.amount },
            { key: "applied_amount", header: "Applied", render: (row) => formatMoney(row.applied_amount ?? row.amount), sortValue: (row) => row.applied_amount ?? row.amount },
            { key: "unapplied_amount", header: "Unapplied", render: (row) => formatMoney(row.unapplied_amount ?? 0), sortValue: (row) => row.unapplied_amount ?? 0 },
            { key: "credit_balance_after", header: "Credit after", render: (row) => formatMoney(row.credit_balance_after ?? 0), sortValue: (row) => row.credit_balance_after ?? 0 },
            { key: "method", header: "Method" },
            { key: "reference", header: "Reference" },
            { key: "recorded_by", header: "Recorded by" },
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
              <input placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
              {needsAllocation ? (
                <select value={allocationType} onChange={(event) => setAllocationType(event.target.value as "PAY_AHEAD" | "PRINCIPAL_PREPAYMENT")}>
                  <option value="">Select allocation type</option>
                  <option value="PAY_AHEAD">PAY_AHEAD</option>
                  <option value="PRINCIPAL_PREPAYMENT">PRINCIPAL_PREPAYMENT</option>
                </select>
              ) : null}
              <select value={method} onChange={(event) => setMethod(event.target.value as "cash" | "transfer" | "aba" | "wing")}>
                <option value="cash">cash</option>
                <option value="transfer">bank transfer</option>
                <option value="aba">ABA</option>
                <option value="wing">Wing</option>
              </select>
              <input placeholder="Reference number" value={reference} onChange={(event) => setReference(event.target.value)} />
              <input placeholder="Note" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          }
          confirmLabel="Record payment"
          onCancel={() => {
            setInstallmentId(null);
            setAllocationType("");
            setIdempotencyKey("");
          }}
          onConfirm={() => {
            if (needsAllocation && !allocationType) {
              toast("Select allocation type");
              return;
            }
            api.recordPayment({ installment_id: selected.id, amount: paymentAmount, method, reference, note, allocation_type: needsAllocation ? allocationType as "PAY_AHEAD" | "PRINCIPAL_PREPAYMENT" : undefined, idempotency_key: idempotencyKey, ...actorFromUser(user) }).then(() => {
              toast("Payment recorded");
              setInstallmentId(null);
              setAllocationType("");
              setIdempotencyKey("");
              setReference("");
              setNote("");
              reload();
            });
          }}
        />
      ) : null}
    </div>
  );
}
