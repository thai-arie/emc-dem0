import DataTable from "../components/DataTable";
import KpiCard from "../components/KpiCard";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../store/auth";
import { api, useApiData } from "../services/api";
import { formatMoney } from "../lib/formatMoney";

type AttentionRow = { id: string; detail: string; status: string };

export default function Overview() {
  const role = useAuth((state) => state.user?.role);
  const contracts = useApiData(api.getContracts);
  const collections = useApiData(api.getCollections);
  const alerts = useApiData(api.getAlerts);
  const installments = useApiData(() => api.getInstallments());
  const contractRows = contracts.data?.contracts ?? [];
  const caseRows = collections.data?.cases ?? [];
  const alertRows = alerts.data ?? [];
  const overdueRows = (installments.data?.installments ?? []).filter((item) => item.status === "OVERDUE");
  const attention: AttentionRow[] =
    role === "OPS"
      ? alertRows.filter((alert) => !alert.resolved_at).map((alert) => ({ id: alert.id, detail: alert.message, status: alert.severity }))
      : caseRows.filter((item) => item.status !== "CLOSED").map((item) => ({ id: item.id, status: item.status, detail: item.contract_id }));
  return (
    <div className="screen">
      <h1 className="screen-title">Overview</h1>
      <div className="screen-grid">
        <KpiCard label="Contracts" value={contractRows.length} />
        <KpiCard label="Overdue installments" value={overdueRows.length} accent="var(--color-danger)" />
        <KpiCard label="Open cases" value={caseRows.filter((item) => item.status !== "CLOSED").length} />
        <KpiCard label="Unresolved alerts" value={alertRows.filter((item) => !item.resolved_at).length} accent="var(--color-warn)" />
        <KpiCard label="Total disbursed" value={formatMoney(contracts.data?.cash.total_disbursed ?? 0)} />
        <KpiCard label="Total collected" value={formatMoney(contracts.data?.cash.total_collected ?? 0)} />
        <KpiCard label="Outstanding" value={formatMoney(contracts.data?.cash.outstanding ?? 0)} accent="var(--color-warn)" />
      </div>
      <section className="screen-panel">
        <h2>Needs attention</h2>
        <DataTable
          rows={attention}
          rowKey={(row) => row.id}
          columns={[
            { key: "id", header: "ID" },
            { key: "detail", header: "Detail" },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> }
          ]}
        />
      </section>
    </div>
  );
}
