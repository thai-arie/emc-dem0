import { Navigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import KpiCard from "../components/KpiCard";
import { api, useApiData } from "../services/api";
import { useAuth } from "../store/auth";
import { formatMoney } from "../lib/formatMoney";

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function Reporting() {
  const role = useAuth((state) => state.user?.role);
  const allowed = role === "ADMIN" || role === "CEO" || role === "FINANCIAL_CONTROLLER";
  const summary = useApiData(api.getReportingSummary);
  const aging = useApiData(api.getReportingAging);
  const cashflow = useApiData(api.getReportingCashflow);
  if (!allowed) return <Navigate to="/" replace />;

  const portfolio = summary.data?.portfolio;
  const payments = summary.data?.payments;
  const collections = summary.data?.collections;
  const portfolioSnapshot = portfolio
    ? [
        { metric: "Total contracts", value: portfolio.total_contracts },
        { metric: "Active contracts", value: portfolio.active_contracts },
        { metric: "Overdue contracts", value: portfolio.overdue_contracts },
        { metric: "Overdue %", value: percent(portfolio.overdue_percent) },
        { metric: "Total outstanding", value: formatMoney(portfolio.total_outstanding) },
        { metric: "Total overdue amount", value: formatMoney(portfolio.total_overdue_amount) }
      ]
    : [];

  return (
    <div className="screen">
      <h1 className="screen-title">Reporting</h1>
      <section className="screen-panel">
        <h2>Portfolio</h2>
        <div className="screen-grid">
          <KpiCard label="Total contracts" value={portfolio?.total_contracts ?? 0} />
          <KpiCard label="Active contracts" value={portfolio?.active_contracts ?? 0} />
          <KpiCard label="Overdue contracts" value={portfolio?.overdue_contracts ?? 0} accent="var(--color-warn)" />
          <KpiCard label="Overdue %" value={percent(portfolio?.overdue_percent ?? 0)} accent="var(--color-warn)" />
          <KpiCard label="Total outstanding" value={formatMoney(portfolio?.total_outstanding ?? 0)} />
          <KpiCard label="Total overdue amount" value={formatMoney(portfolio?.total_overdue_amount ?? 0)} accent="var(--color-warn)" />
        </div>
        <DataTable
          rows={portfolioSnapshot}
          rowKey={(row) => row.metric}
          exportCSV="portfolio-snapshot.csv"
          columns={[
            { key: "metric", header: "Metric" },
            { key: "value", header: "Value" }
          ]}
        />
      </section>
      <section className="screen-panel">
        <h2>Payments</h2>
        <div className="screen-grid">
          <KpiCard label="Collected today" value={formatMoney(payments?.collected_today ?? 0)} />
          <KpiCard label="Collected last 7 days" value={formatMoney(payments?.collected_last_7_days ?? 0)} />
          <KpiCard label="Collected last 30 days" value={formatMoney(payments?.collected_last_30_days ?? 0)} />
          <KpiCard label="Total collected all time" value={formatMoney(payments?.total_collected_all_time ?? 0)} />
        </div>
      </section>
      <section className="screen-panel">
        <h2>Collections</h2>
        <div className="screen-grid">
          <KpiCard label="Open cases" value={collections?.open_cases ?? 0} />
          <KpiCard label="Cases cured this month" value={collections?.cases_cured_this_month ?? 0} />
          <KpiCard label="Immobilizer armed count" value={collections?.immobilizer_armed_count ?? 0} accent="var(--color-danger)" />
          <KpiCard label="Critical alerts count" value={collections?.critical_alerts_count ?? 0} accent="var(--color-danger)" />
        </div>
      </section>
      <section className="screen-panel">
        <h2>Aging report</h2>
        <DataTable
          rows={aging.data ?? []}
          rowKey={(row) => row.bucket}
          exportCSV="aging-report.csv"
          columns={[
            { key: "bucket", header: "Bucket" },
            { key: "contract_count", header: "Contract count", sortValue: (row) => row.contract_count },
            { key: "amount_overdue", header: "Amount overdue", render: (row) => formatMoney(row.amount_overdue), csvValue: (row) => row.amount_overdue, sortValue: (row) => row.amount_overdue }
          ]}
        />
      </section>
      <section className="screen-panel">
        <h2>Cashflow last 30 days</h2>
        <DataTable
          rows={cashflow.data ?? []}
          rowKey={(row) => row.date}
          exportCSV="payments-last-30-days.csv"
          columns={[
            { key: "date", header: "Date" },
            { key: "amount_collected", header: "Amount collected", render: (row) => formatMoney(row.amount_collected), csvValue: (row) => row.amount_collected, sortValue: (row) => row.amount_collected },
            { key: "payment_count", header: "Payment count", sortValue: (row) => row.payment_count }
          ]}
        />
      </section>
    </div>
  );
}
