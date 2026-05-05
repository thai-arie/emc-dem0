import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get("caseId");
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
  const maxDpd = Math.max(0, ...data.cases.map((item) => Number((item as { dpd?: number }).dpd ?? 0)));
  const overdueAmount = data.financials.overdue_amount;
  const isCriticalRisk = overdueAmount > 0 && (maxDpd >= 10 || overdueAmount >= data.contract.monthly_total);
  const isWarningRisk = overdueAmount > 0 && !isCriticalRisk;
  const riskLabel = isCriticalRisk ? "CRITICAL" : isWarningRisk ? "WARNING" : "HEALTHY";
  const riskColor = isCriticalRisk ? "#fb7185" : isWarningRisk ? "#facc15" : "#2dd4bf";
  const riskBackground = isCriticalRisk ? "rgba(251, 113, 133, 0.12)" : isWarningRisk ? "rgba(250, 204, 21, 0.12)" : "rgba(45, 212, 191, 0.10)";
  const riskBorder = isCriticalRisk ? "rgba(251, 113, 133, 0.55)" : isWarningRisk ? "rgba(250, 204, 21, 0.55)" : "rgba(45, 212, 191, 0.45)";
  return (
    <div className="screen">

      <div style={{
        display: "flex",
        gap: "10px",
        marginBottom: "16px",
        flexWrap: "wrap"
      }}>
        <a
          href={`tel:${data.client.phone}`}
          className="primary-button"
          style={{ textDecoration: "none" }}
        >
          Call
        </a>
</div>

      {caseId && (
        <div style={{ marginBottom: "16px" }}>
          <button
            className="secondary-button"
            onClick={() => {
              window.location.href = `/collections/${caseId}`;
            }}
          >
            ← Back to Case
          </button>
        </div>
      )}
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
        <div style={{ display: "grid", gap: "18px" }}>
          <section
            className="screen-panel"
            style={{
              display: "grid",
              gridTemplateColumns: "1.15fr 0.85fr",
              gap: "18px",
              alignItems: "stretch"
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>Client Profile</h2>
                <StatusBadge status={data.contract.status} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
                <div style={{ padding: "14px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", background: "rgba(255,255,255,0.025)" }}>
                  <div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Full name</div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#f8fafc", lineHeight: 1.2 }}>{data.client.full_name}</div>
                </div>
                <div style={{ padding: "14px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", background: "rgba(255,255,255,0.025)" }}>
                  <div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Phone</div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#f8fafc", lineHeight: 1.2 }}>{data.client.phone}</div>
                </div>
                <div style={{ padding: "14px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", background: "rgba(255,255,255,0.025)" }}>
                  <div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Address</div>
                  <div style={{ fontSize: "21px", fontWeight: 750, color: "#e5e7eb", lineHeight: 1.25 }}>{data.client.address || "-"}</div>
                </div>
                <div style={{ padding: "14px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", background: "rgba(255,255,255,0.025)" }}>
                  <div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>National ID / passport</div>
                  <div style={{ fontSize: "21px", fontWeight: 750, color: "#e5e7eb", lineHeight: 1.25 }}>{data.client.national_id || "-"}</div>
                </div>
                <div style={{ gridColumn: "1 / -1", padding: "14px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", background: "rgba(255,255,255,0.025)" }}>
                  <div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Emergency contact</div>
                  <div style={{ fontSize: "21px", fontWeight: 750, color: "#e5e7eb", lineHeight: 1.25 }}>
                    {[data.client.emergency_contact_name, data.client.emergency_contact_phone].filter(Boolean).join(" · ") || "-"}
                  </div>
                </div>
              </div>
            </div>

            <aside
              style={{
                border: "1px solid rgba(45, 212, 191, 0.45)",
                borderRadius: "16px",
                padding: "18px",
                background: "rgba(8, 47, 73, 0.22)"
              }}
            >
              <p style={{ margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "12px", fontWeight: 800, color: "#9ca3af" }}>
                Financial exposure
              </p>
              <div style={{ fontSize: "42px", fontWeight: 900, color: "#2dd4bf", marginBottom: "10px" }}>
                {formatMoney(data.financials.credit_balance)}
              </div>

              <div style={{
                border: `1px solid ${riskBorder}`,
                background: riskBackground,
                borderRadius: "14px",
                padding: "14px",
                marginBottom: "16px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "12px", fontWeight: 900, color: "#9ca3af" }}>
                    Overdue exposure
                  </span>
                  <span style={{ color: riskColor, border: `1px solid ${riskBorder}`, borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 900 }}>
                    {riskLabel}
                  </span>
                </div>
                <div style={{ fontSize: "34px", fontWeight: 950, color: riskColor }}>
                  {formatMoney(overdueAmount)}
                </div>
                <div style={{ marginTop: "6px", color: "#9ca3af", fontSize: "13px" }}>
                  {maxDpd > 0 ? `${maxDpd} days past due` : "No active delinquency"}
                </div>
              </div>

              <div style={{ display: "grid", gap: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px" }}>
                  <span>Monthly payment</span><strong>{formatMoney(data.contract.monthly_total)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px" }}>
                  <span>Paid to date</span><strong>{formatMoney(data.financials.paid_to_date)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px" }}>
                  <span>Overdue amount</span><strong style={{ color: riskColor }}>{formatMoney(overdueAmount)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px" }}>
                  <span>Term</span><strong>{data.contract.term_months} months</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>GPS status</span><StatusBadge status={data.gps.status} />
                </div>
              </div>
            </aside>
          </section>

          <section className="screen-panel">
            <h2>Vehicle & GPS</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" }}>
              <div><div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Brand</div><div style={{ fontSize: "20px", fontWeight: 750, color: "#f8fafc" }}>{data.vehicle.brand}</div></div>
              <div><div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Model</div><div style={{ fontSize: "20px", fontWeight: 750, color: "#f8fafc" }}>{data.vehicle.model}</div></div>
              <div><div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Plate</div><div style={{ fontSize: "20px", fontWeight: 800, color: "#f8fafc", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{data.vehicle.plate}</div></div>
              <div><div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>VIN</div><div style={{ fontSize: "20px", fontWeight: 800, color: "#f8fafc", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{data.vehicle.vin || "-"}</div></div>
            </div>
          </section>

          <section className="screen-panel">
            <h2>Deal Terms</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "14px" }}>
              <div><div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Vehicle price</div><div style={{ fontSize: "22px", fontWeight: 850, color: "#f8fafc" }}>{formatMoney(data.contract.vehicle_price)}</div></div>
              <div><div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Down payment</div><div style={{ fontSize: "22px", fontWeight: 850, color: "#f8fafc" }}>{formatMoney(data.contract.down_payment)}</div></div>
              <div><div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Financed amount</div><div style={{ fontSize: "22px", fontWeight: 850, color: "#f8fafc" }}>{formatMoney(data.contract.financed_amount)}</div></div>
              <div><div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Monthly payment</div><div style={{ fontSize: "22px", fontWeight: 850, color: "#f8fafc" }}>{formatMoney(data.contract.monthly_total)}</div></div>
              <div><div style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 900, color: "#94a3b8", marginBottom: "10px" }}>Outstanding balance</div><div style={{ fontSize: "24px", fontWeight: 900, color: "#2dd4bf" }}>{formatMoney(data.financials.credit_balance)}</div></div>
            </div>
          </section>
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
