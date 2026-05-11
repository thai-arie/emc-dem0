import DataTable from "../../components/DataTable";
import { formatMoney } from "../../lib/formatMoney";
import { FinanceGate, FinancePill, FinanceSummaryStrip, FinanceTraffic, financeStyles } from "./FinanceReferenceShared";
import { pricingTiers } from "./financeReferenceData";

export default function PricingTiers() {
  const active = pricingTiers.filter((tier) => tier.active);
  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Pricing Tiers</h1>
            <p className={financeStyles.intro}>Readonly lending terms inspired by the legacy Premium / Basic / Risky pricing model. These do not mutate active contracts.</p>
          </div>
        </header>
        <FinanceSummaryStrip
          metrics={[
            { label: "Configured tiers", value: pricingTiers.length },
            { label: "Active tiers", value: active.length, tone: "green" },
            { label: "Standard GPS fee", value: formatMoney(3300), tone: "blue" },
            { label: "Default insurance", value: "2.9%" },
            { label: "Risk watch tiers", value: pricingTiers.filter((tier) => tier.traffic === "amber").length, tone: "amber" }
          ]}
        />
        <section className="screen-panel">
          <h2>Tier reference</h2>
          <DataTable
            rows={pricingTiers}
            rowKey={(row) => row.id}
            searchKey={(row) => `${row.tierName} ${row.aprRange} ${row.fundingMode} ${row.notes}`}
            filters={[
              { label: "Active", predicate: (row) => row.active },
              { label: "Watch", predicate: (row) => row.traffic === "amber" },
              { label: "Inactive", predicate: (row) => !row.active }
            ]}
            columns={[
              { key: "traffic", header: "Signal", render: (row) => <FinanceTraffic tone={row.traffic} label={row.traffic === "amber" ? "WATCH" : row.active ? "READY" : "HOLD"} /> },
              { key: "tierName", header: "Tier name" },
              { key: "aprRange", header: "APR range" },
              { key: "riskFeePct", header: "Risk fee", render: (row) => `${row.riskFeePct}%`, sortValue: (row) => row.riskFeePct },
              { key: "gpsFee", header: "GPS fee", render: (row) => formatMoney(row.gpsFee), csvValue: (row) => row.gpsFee, sortValue: (row) => row.gpsFee },
              { key: "insuranceDefaultPct", header: "Insurance default", render: (row) => `${row.insuranceDefaultPct}%`, sortValue: (row) => row.insuranceDefaultPct },
              { key: "fundingMode", header: "Funding mode" },
              { key: "active", header: "Active", render: (row) => <FinancePill active={row.active} /> },
              { key: "notes", header: "Notes", render: (row) => <span className={financeStyles.tableText}>{row.notes}</span> }
            ]}
          />
        </section>
      </div>
    </FinanceGate>
  );
}

