import DataTable from "../components/DataTable";
import KpiCard from "../components/KpiCard";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../store/auth";
import { api, useApiData } from "../services/api";
import { formatMoney } from "../lib/formatMoney";
import type { Alert, Vehicle } from "../entities/types";

type AttentionRow = { id: string; type: string; detail: string; status: string };

const severityRank: Record<string, number> = { CRITICAL: 0, WARNING: 1 };

function vehicleForAlert(alert: Alert, vehicles: Vehicle[]) {
  return alert.entity_type === "vehicle" ? vehicles.find((vehicle) => vehicle.id === alert.entity_id) : undefined;
}

function contractForAlert(alert: Alert, vehicles: Vehicle[], contracts: Array<{ id: string; client?: string; vehicle_id: string }>) {
  if (alert.entity_type === "contract") return contracts.find((contract) => contract.id === alert.entity_id);
  const vehicle = vehicleForAlert(alert, vehicles);
  return vehicle ? contracts.find((contract) => contract.id === vehicle.contract_id) : undefined;
}

function toAttentionRow(alert: Alert, vehicles: Vehicle[], contracts: Array<{ id: string; client?: string; vehicle_id: string }>): AttentionRow | null {
  const contract = contractForAlert(alert, vehicles, contracts);
  if (alert.severity === "CRITICAL") {
    const vehicle = vehicleForAlert(alert, vehicles);
    const deviceId = vehicle?.gps_device_id ?? alert.entity_id;
    return {
      id: deviceId,
      type: "IMMOBILIZER_ALERT",
      status: "CRITICAL",
      detail: `${contract?.client ?? contract?.id ?? "Client"} - vehicle immobilized`
    };
  }
  if (alert.severity === "WARN") {
    return {
      id: contract?.id ?? alert.entity_id,
      type: "OVERDUE_CONTRACT",
      status: "WARNING",
      detail: `${contract?.client ?? contract?.id ?? "Client"} - overdue installment`
    };
  }
  return null;
}

export default function Overview() {
  const role = useAuth((state) => state.user?.role);
  const contracts = useApiData(api.getContracts);
  const collections = useApiData(api.getCollections);
  const alerts = useApiData(api.getAlerts);
  const installments = useApiData(() => api.getInstallments());
  const gps = useApiData(api.getGps);
  const contractRows = contracts.data?.contracts ?? [];
  const caseRows = collections.data?.cases ?? [];
  const alertRows = alerts.data ?? [];
  const vehicles = gps.data?.vehicles ?? [];
  const overdueRows = (installments.data?.installments ?? []).filter((item) => item.status === "OVERDUE");
  const unresolvedAlerts = alertRows.filter((item) => !item.resolved_at);
  const armedDevices = (gps.data?.gpsDevices ?? []).filter((item) => item.status === "IMMOBILIZER_ARMED");
  const overdueContracts = contractRows.filter((item) => item.status === "OVERDUE");
  const attentionByContract = new Map<string, AttentionRow>();
  for (const alert of unresolvedAlerts) {
    const contract = contractForAlert(alert, vehicles, contractRows);
    const key = contract?.id ?? alert.entity_id;
    const row = toAttentionRow(alert, vehicles, contractRows);
    if (!row) continue;
    const current = attentionByContract.get(key);
    if (!current || severityRank[row.status] < severityRank[current.status]) attentionByContract.set(key, row);
  }
  for (const kase of caseRows.filter((item) => item.status !== "CLOSED" && item.status !== "CURED")) {
    if (attentionByContract.has(kase.contract_id)) continue;
    attentionByContract.set(kase.contract_id, {
      id: kase.contract_id,
      type: "COLLECTIONS_CASE",
      status: "WARNING",
      detail: `${kase.client} - collections case open`
    });
  }
  const attention: AttentionRow[] = [...attentionByContract.values()].sort((a, b) => severityRank[a.status] - severityRank[b.status]);
  return (
    <div className="screen">
      <h1 className="screen-title">Overview</h1>
      <div className="screen-grid">
        <KpiCard label="Contracts" value={contractRows.length} />
        <KpiCard label="Overdue installments" value={overdueRows.length} accent="var(--color-warn)" />
        <KpiCard label="Open cases" value={caseRows.filter((item) => item.status !== "CLOSED").length} />
        <KpiCard label="Unresolved alerts" value={unresolvedAlerts.length} accent="var(--color-warn)" />
        <KpiCard label="Armed GPS devices" value={armedDevices.length} accent="var(--color-danger)" />
        <KpiCard label="Total financed" value={formatMoney(contracts.data?.cash.total_disbursed ?? 0)} />
        <KpiCard label="Payments collected" value={formatMoney(contracts.data?.cash.total_collected ?? 0)} />
        <KpiCard label="Outstanding principal" value={formatMoney(contracts.data?.cash.outstanding ?? 0)} accent="var(--color-warn)" />
        <KpiCard label="Overdue amount" value={formatMoney(contracts.data?.cash.overdue_amount ?? 0)} accent="var(--color-warn)" />
        <KpiCard label="Active contracts" value={contracts.data?.cash.active_contracts ?? 0} />
        <KpiCard label="Overdue contracts" value={contracts.data?.cash.overdue_contracts ?? 0} accent="var(--color-warn)" />
      </div>
      <section className="screen-panel">
        <h2>Needs attention</h2>
        <DataTable
          rows={attention}
          rowKey={(row) => row.id}
          columns={[
            { key: "id", header: "ID" },
            { key: "type", header: "Type" },
            { key: "detail", header: "Detail" },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> }
          ]}
        />
      </section>
    </div>
  );
}
