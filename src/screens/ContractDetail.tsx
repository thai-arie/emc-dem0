import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import DataTable from "../components/DataTable";
import ConfirmDialog from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import RoleGate from "../app/layout/RoleGate";
import { actorFromUser, api, useApiData } from "../services/api";
import { useAuth } from "../store/auth";
import { useUi } from "../store/ui";
import { formatMoney } from "../lib/formatMoney";
import { formatDate } from "../lib/formatDate";
import type { Installment, Payment } from "../entities/types";

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const toast = useUi((state) => state.addToast);
  const [tab, setTab] = useState<"Overview" | "Schedule" | "Payments" | "Collections" | "Audit">("Overview");
  const [installmentId, setInstallmentId] = useState<string | null>(null);
  const [method, setMethod] = useState<Payment["method"]>("cash");
  const [allocationType, setAllocationType] = useState<"" | "PAY_AHEAD" | "PRINCIPAL_PREPAYMENT">("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const detail = useApiData(() => api.getContract(id ?? ""), [id]);
  const schedule = useApiData(() => api.getInstallments(id), [id]);
  const data = detail.data;
  const installments = schedule.data?.installments ?? [];
  const selected = installments.find((item) => item.id === installmentId);
  const openPayment = (installment: Installment) => {
    setInstallmentId(installment.id);
    setAmount(String(installment.amount_due / 100));
    setMethod("cash");
    setAllocationType("");
    setReference("");
    setNote("");
    setIdempotencyKey(crypto.randomUUID());
  };
  const paymentActionLabel = (status: Installment["status"]) => {
    if (status === "SCHEDULED") return "Pay early";
    if (status === "DUE") return "Pay";
    if (status === "OVERDUE") return "Pay now";
    return null;
  };
  if (!data) return <div className="screen-panel">{detail.error ?? "Loading contract"}</div>;
  const payments = [...data.payments].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const auditRows = [...data.audit].sort((a, b) => b.ts.localeCompare(a.ts));
  const paymentAmount = selected ? Math.round(Number(amount || selected.amount_due / 100) * 100) : 0;
  const needsAllocation = selected ? paymentAmount > selected.amount_due : false;
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
            <div><strong>Customer credit balance</strong><p>{formatMoney(data.financials.credit_balance)}</p></div>
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
            {
              key: "status",
              header: "Status",
              render: (row) => {
                const actionLabel = paymentActionLabel(row.status);
                return (
                  <div className="button-row">
                    <StatusBadge status={row.status} />
                    {actionLabel ? (
                      <RoleGate roles={["COLLECTIONS", "FINANCIAL_CONTROLLER"]}>
                        <button
                          className="secondary-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openPayment(row);
                          }}
                        >
                          {actionLabel}
                        </button>
                      </RoleGate>
                    ) : null}
                  </div>
                );
              }
            }
          ]}
        />
      ) : tab === "Payments" ? (
        <DataTable
          rows={payments}
          rowKey={(row) => row.id}
          exportCSV={`${data.contract.id}-payments.csv`}
          columns={[
            { key: "recorded_at", header: "Recorded at", render: (row) => formatDate(row.recorded_at), sortValue: (row) => row.recorded_at },
            { key: "amount", header: "Amount", render: (row) => formatMoney(row.amount), sortValue: (row) => row.amount },
            { key: "applied_amount", header: "Applied", render: (row) => formatMoney(row.applied_amount ?? row.amount), sortValue: (row) => row.applied_amount ?? row.amount },
            { key: "unapplied_amount", header: "Unapplied", render: (row) => formatMoney(row.unapplied_amount ?? 0), sortValue: (row) => row.unapplied_amount ?? 0 },
            { key: "credit_balance_after", header: "Credit after", render: (row) => formatMoney(row.credit_balance_after ?? 0), sortValue: (row) => row.credit_balance_after ?? 0 },
            { key: "method", header: "Method" },
            { key: "reference", header: "Reference" },
            { key: "note", header: "Note" },
            { key: "recorded_by", header: "Recorded by" }
          ]}
        />
      ) : tab === "Collections" ? (
        <DataTable
          rows={data.cases}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/collections/${row.id}`)}
          columns={[
            { key: "id", header: "Case" },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "opened_at", header: "Opened", render: (row) => formatDate(row.opened_at) },
            { key: "cured_at", header: "Cured", render: (row) => formatDate(row.cured_at) },
            { key: "overdue_amount", header: "Overdue", render: (row) => formatMoney(row.overdue_amount ?? 0), sortValue: (row) => row.overdue_amount ?? 0 },
            { key: "last_action", header: "Last action", render: (row) => row.last_action ?? "" }
          ]}
        />
      ) : (
        <DataTable
          rows={auditRows}
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
      {selected ? (
        <ConfirmDialog
          title="Record payment"
          message={
            <div className="form-grid">
              <p>Record {formatMoney(selected.amount_due)} for {data.contract.id} installment {selected.seq_no}?</p>
              <input placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
              {needsAllocation ? (
                <select value={allocationType} onChange={(event) => setAllocationType(event.target.value as "PAY_AHEAD" | "PRINCIPAL_PREPAYMENT")}>
                  <option value="">Select allocation type</option>
                  <option value="PAY_AHEAD">PAY_AHEAD</option>
                  <option value="PRINCIPAL_PREPAYMENT">PRINCIPAL_PREPAYMENT</option>
                </select>
              ) : null}
              <select value={method} onChange={(event) => setMethod(event.target.value as Payment["method"])}>
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
            api.recordPayment({ installment_id: selected.id, amount: paymentAmount, method, reference, note, allocation_type: needsAllocation ? allocationType as Payment["allocation_type"] : undefined, idempotency_key: idempotencyKey, ...actorFromUser(user) }).then(() => {
              toast("Payment recorded");
              setInstallmentId(null);
              setAllocationType("");
              setIdempotencyKey("");
              setReference("");
              setNote("");
              detail.reload();
              schedule.reload();
            });
          }}
        />
      ) : null}
    </div>
  );
}
