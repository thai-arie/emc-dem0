import DataTable from "../../components/DataTable";
import { FinanceGate, FinancePill, FinanceSummaryStrip, FinanceTraffic, financeStyles } from "./FinanceReferenceShared";
import { financialPartners } from "./financeReferenceData";

export default function FinancialPartners() {
  const active = financialPartners.filter((partner) => partner.active);
  const averageCost = active.length ? active.reduce((sum, partner) => sum + partner.costRatePct, 0) / active.length : 0;
  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Financial Partners</h1>
            <p className={financeStyles.intro}>Readonly funding partner reference. Cost rates are finance reference data only and do not drive the operational demo.</p>
          </div>
        </header>
        <FinanceSummaryStrip
          metrics={[
            { label: "Partners", value: financialPartners.length },
            { label: "Active partners", value: active.length, tone: "green" },
            { label: "Avg active cost", value: `${averageCost.toFixed(1)}%` },
            { label: "Active contracts", value: active.reduce((sum, partner) => sum + partner.activeContractsCount, 0), tone: "blue" },
            { label: "Watch partners", value: financialPartners.filter((partner) => partner.traffic === "amber").length, tone: "amber" }
          ]}
        />
        <section className="screen-panel">
          <h2>Funding reference</h2>
          <DataTable
            rows={financialPartners}
            rowKey={(row) => row.id}
            searchKey={(row) => `${row.partnerName} ${row.fundingType} ${row.notes}`}
            filters={[
              { label: "Active", predicate: (row) => row.active },
              { label: "Bank/MFI", predicate: (row) => row.fundingType !== "Self-funded" },
              { label: "Self-funded", predicate: (row) => row.fundingType === "Self-funded" }
            ]}
            columns={[
              { key: "traffic", header: "Signal", render: (row) => <FinanceTraffic tone={row.traffic} label={row.traffic === "amber" ? "WATCH" : row.traffic === "blue" ? "OWN CAPITAL" : row.active ? "READY" : "HOLD"} /> },
              { key: "partnerName", header: "Partner name" },
              { key: "fundingType", header: "Funding type" },
              { key: "costRatePct", header: "Cost rate", render: (row) => <span className={financeStyles.number}>{row.costRatePct.toFixed(1)}%</span>, sortValue: (row) => row.costRatePct },
              { key: "activeContractsCount", header: "Active contracts", sortValue: (row) => row.activeContractsCount },
              { key: "active", header: "Status", render: (row) => <FinancePill active={row.active} /> },
              { key: "notes", header: "Notes", render: (row) => <span className={financeStyles.tableText}>{row.notes}</span> }
            ]}
          />
        </section>
      </div>
    </FinanceGate>
  );
}

