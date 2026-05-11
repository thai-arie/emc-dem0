import DataTable from "../../components/DataTable";
import { FinanceGate, FinancePill, FinanceSummaryStrip, FinanceTraffic, financeStyles } from "./FinanceReferenceShared";
import { bankAccounts } from "./financeReferenceData";

export default function BankAccounts() {
  const active = bankAccounts.filter((account) => account.active);
  const currencies = new Set(bankAccounts.map((account) => account.currency));
  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Bank Accounts</h1>
            <p className={financeStyles.intro}>Readonly receiving and settlement account reference. No money movement or bank settlement behavior is introduced in this phase.</p>
          </div>
        </header>
        <FinanceSummaryStrip
          metrics={[
            { label: "Accounts", value: bankAccounts.length },
            { label: "Active accounts", value: active.length, tone: "green" },
            { label: "Currencies", value: currencies.size },
            { label: "Settlement accounts", value: bankAccounts.filter((account) => account.settlementRole.includes("Bank")).length, tone: "blue" },
            { label: "Watch accounts", value: bankAccounts.filter((account) => account.traffic === "amber").length, tone: "amber" }
          ]}
        />
        <section className="screen-panel">
          <h2>Account reference</h2>
          <DataTable
            rows={bankAccounts}
            rowKey={(row) => row.id}
            searchKey={(row) => `${row.accountName} ${row.partnerLink} ${row.currency} ${row.settlementRole} ${row.notes}`}
            filters={[
              { label: "Active", predicate: (row) => row.active },
              { label: "Settlement", predicate: (row) => row.settlementRole !== "Archived" },
              { label: "Inactive", predicate: (row) => !row.active }
            ]}
            columns={[
              { key: "traffic", header: "Signal", render: (row) => <FinanceTraffic tone={row.traffic} label={row.traffic === "amber" ? "BUFFER" : row.active ? "READY" : "HOLD"} /> },
              { key: "accountName", header: "Account name" },
              { key: "partnerLink", header: "Partner link" },
              { key: "currency", header: "Currency" },
              { key: "settlementRole", header: "Settlement role" },
              { key: "active", header: "Status", render: (row) => <FinancePill active={row.active} /> },
              { key: "notes", header: "Notes", render: (row) => <span className={financeStyles.tableText}>{row.notes}</span> }
            ]}
          />
        </section>
      </div>
    </FinanceGate>
  );
}
