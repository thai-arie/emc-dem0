import DataTable from "../../components/DataTable";
import { FinanceGate, FinancePill, FinanceSummaryStrip, FinanceTraffic, financeStyles } from "./FinanceReferenceShared";
import { insurancePartners } from "./financeReferenceData";

export default function InsurancePartners() {
  const active = insurancePartners.filter((partner) => partner.active);
  const averagePremium = active.length ? active.reduce((sum, partner) => sum + partner.premiumPct, 0) / active.length : 0;
  const averageCommission = active.length ? active.reduce((sum, partner) => sum + partner.commissionPct, 0) / active.length : 0;
  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Insurance Partners</h1>
            <p className={financeStyles.intro}>Readonly insurer reference for premium and commission assumptions. Current collections and GPS flows do not depend on this layer.</p>
          </div>
        </header>
        <FinanceSummaryStrip
          metrics={[
            { label: "Insurers", value: insurancePartners.length },
            { label: "Active insurers", value: active.length, tone: "green" },
            { label: "Avg premium", value: `${averagePremium.toFixed(1)}%` },
            { label: "Avg commission", value: `${averageCommission.toFixed(1)}%`, tone: "blue" },
            { label: "Watch insurers", value: insurancePartners.filter((partner) => partner.traffic === "amber").length, tone: "amber" }
          ]}
        />
        <section className="screen-panel">
          <h2>Insurance reference</h2>
          <DataTable
            rows={insurancePartners}
            rowKey={(row) => row.id}
            searchKey={(row) => `${row.insurer} ${row.settlementTiming} ${row.notes}`}
            filters={[
              { label: "Active", predicate: (row) => row.active },
              { label: "Watch", predicate: (row) => row.traffic === "amber" },
              { label: "Inactive", predicate: (row) => !row.active }
            ]}
            columns={[
              { key: "traffic", header: "Signal", render: (row) => <FinanceTraffic tone={row.traffic} label={row.traffic === "amber" ? "WATCH" : row.active ? "READY" : "HOLD"} /> },
              { key: "insurer", header: "Insurer" },
              { key: "premiumPct", header: "Premium %", render: (row) => <span className={financeStyles.number}>{row.premiumPct.toFixed(1)}%</span>, sortValue: (row) => row.premiumPct },
              { key: "commissionPct", header: "Commission %", render: (row) => <span className={financeStyles.number}>{row.commissionPct.toFixed(1)}%</span>, sortValue: (row) => row.commissionPct },
              { key: "settlementTiming", header: "Settlement timing" },
              { key: "active", header: "Status", render: (row) => <FinancePill active={row.active} /> },
              { key: "notes", header: "Notes", render: (row) => <span className={financeStyles.tableText}>{row.notes}</span> }
            ]}
          />
        </section>
      </div>
    </FinanceGate>
  );
}

