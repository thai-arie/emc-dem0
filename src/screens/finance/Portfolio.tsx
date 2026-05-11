import { useMemo } from "react";
import DataTable from "../../components/DataTable";
import { formatMoney } from "../../lib/formatMoney";
import { calculateDealPreview } from "./applicationDealMath";
import { applicationPipeline, applicationStageLabels, type FinanceApplication } from "./applicationReferenceData";
import { financialPartners, insurancePartners, pricingTiers } from "./financeReferenceData";
import { FinanceGate, FinanceSummaryStrip, FinanceTraffic, financeStyles } from "./FinanceReferenceShared";

type ActiveFinanceContract = {
  id: string;
  client: string;
  brand: string;
  model: string;
  pricingTierId: string;
  financialPartnerId: string;
  insurancePartnerId: string;
  vehiclePrice: number;
  vehicleCost: number;
  downPaymentPct: number;
  termMonths: number;
  aprPct: number;
  bankFundingSharePct: number;
  active: boolean;
};

type CompositionRow = {
  label: string;
  count: number;
  amount: number;
  share: number;
};

const activeFinanceContracts: ActiveFinanceContract[] = [
  { id: "KT-1104", client: "Sokha Trading", brand: "PAIDI", model: "KT11EV", pricingTierId: "basic", financialPartnerId: "fp_icare", insurancePartnerId: "ip_cb", vehiclePrice: 860000, vehicleCost: 645000, downPaymentPct: 20, termMonths: 36, aprPct: 18, bankFundingSharePct: 85, active: true },
  { id: "KT-1129", client: "Vannak Logistics", brand: "Gecko", model: "EV Truck 1T", pricingTierId: "risky", financialPartnerId: "fp_wemoney", insurancePartnerId: "ip_forte", vehiclePrice: 1650000, vehicleCost: 1250000, downPaymentPct: 35, termMonths: 30, aprPct: 23, bankFundingSharePct: 70, active: true },
  { id: "KT-1168", client: "Nita Phan", brand: "BYD", model: "Atto 3", pricingTierId: "premium", financialPartnerId: "fp_acleda", insurancePartnerId: "ip_asia", vehiclePrice: 3250000, vehicleCost: 2700000, downPaymentPct: 30, termMonths: 48, aprPct: 15, bankFundingSharePct: 95, active: true },
  { id: "KT-1210", client: "Chan Monika", brand: "Chery", model: "Arrizo 5", pricingTierId: "basic", financialPartnerId: "fp_acleda", insurancePartnerId: "ip_asia", vehiclePrice: 1456000, vehicleCost: 1100000, downPaymentPct: 25, termMonths: 42, aprPct: 17.5, bankFundingSharePct: 90, active: true },
  { id: "KT-1274", client: "Rithy Sok", brand: "PAIDI", model: "KT11EV Cargo", pricingTierId: "basic", financialPartnerId: "fp_icare", insurancePartnerId: "ip_cb", vehiclePrice: 920000, vehicleCost: 690000, downPaymentPct: 22, termMonths: 36, aprPct: 18.5, bankFundingSharePct: 82, active: true },
  { id: "KT-1328", client: "Malis Theng", brand: "Leapmotor", model: "T03", pricingTierId: "basic", financialPartnerId: "fp_icare", insurancePartnerId: "ip_cb", vehiclePrice: 1240000, vehicleCost: 930000, downPaymentPct: 18, termMonths: 36, aprPct: 19, bankFundingSharePct: 80, active: true },
  { id: "KT-1395", client: "EMC Staff Lease", brand: "Chery", model: "Tiggo 4 Pro", pricingTierId: "self-funded", financialPartnerId: "fp-emc-self", insurancePartnerId: "ip_cb", vehiclePrice: 1890000, vehicleCost: 1450000, downPaymentPct: 28, termMonths: 36, aprPct: 20, bankFundingSharePct: 0, active: true }
];

const operationalBridge = [
  { label: "Overdue cases", value: 7, tone: "amber" as const, note: "Demo operations bridge; readonly" },
  { label: "Immobilized vehicles", value: 2, tone: "red" as const, note: "Separate from finance status" },
  { label: "Pending controller approvals", value: 3, tone: "amber" as const, note: "No actions on this screen" },
  { label: "Pending restore approvals", value: 1, tone: "blue" as const, note: "Readonly enforcement handoff" }
];

function partnerName(id: string) {
  return financialPartners.find((partner) => partner.id === id)?.partnerName ?? id;
}

function tierName(id: string) {
  return pricingTiers.find((tier) => tier.id === id)?.tierName ?? id;
}

function insuranceFor(id: string) {
  return insurancePartners.find((partner) => partner.id === id) ?? insurancePartners[0];
}

function partnerFor(id: string) {
  return financialPartners.find((partner) => partner.id === id) ?? financialPartners[0];
}

function tierFor(id: string) {
  return pricingTiers.find((tier) => tier.id === id) ?? pricingTiers[0];
}

function contractPreview(contract: ActiveFinanceContract) {
  const tier = tierFor(contract.pricingTierId);
  const partner = partnerFor(contract.financialPartnerId);
  const insurance = insuranceFor(contract.insurancePartnerId);
  return calculateDealPreview({
    vehiclePrice: contract.vehiclePrice,
    vehicleCost: contract.vehicleCost,
    downPaymentPct: contract.downPaymentPct,
    termMonths: contract.termMonths,
    aprPct: contract.aprPct,
    gpsFeeGross: tier.gpsFee,
    gpsCostGsm: 700,
    insurancePct: insurance.premiumPct,
    insuranceCommissionPct: insurance.commissionPct,
    bankCostRatePct: partner.costRatePct,
    bankFundingSharePct: contract.bankFundingSharePct
  });
}

function applicationPreview(application: FinanceApplication) {
  const tier = tierFor(application.pricingTierId);
  const partner = partnerFor(application.financialPartnerId);
  const insurance = insuranceFor(application.insurancePartnerId);
  return calculateDealPreview({
    vehiclePrice: application.vehiclePrice,
    vehicleCost: application.vehicleCost,
    downPaymentPct: application.downPaymentPct,
    termMonths: application.termMonths,
    aprPct: application.aprPct,
    gpsFeeGross: tier.gpsFee,
    gpsCostGsm: 700,
    insurancePct: insurance.premiumPct,
    insuranceCommissionPct: insurance.commissionPct,
    bankCostRatePct: partner.costRatePct,
    bankFundingSharePct: application.bankFundingSharePct
  });
}

function composeRows<T>(rows: T[], labelFor: (row: T) => string, amountFor: (row: T) => number): CompositionRow[] {
  const total = rows.reduce((sum, row) => sum + amountFor(row), 0);
  const map = new Map<string, { count: number; amount: number }>();
  rows.forEach((row) => {
    const label = labelFor(row);
    const current = map.get(label) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += amountFor(row);
    map.set(label, current);
  });
  return [...map.entries()]
    .map(([label, value]) => ({ label, count: value.count, amount: value.amount, share: total ? value.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

function addMonths(start: Date, months: number) {
  const date = new Date(start);
  date.setMonth(date.getMonth() + months);
  return date;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

function MiniTable({ title, rows }: { title: string; rows: CompositionRow[] }) {
  return (
    <section className={financeStyles.compactPanel}>
      <h3>{title}</h3>
      <table className={financeStyles.previewTable}>
        <thead>
          <tr>
            <th>Segment</th>
            <th>Count</th>
            <th>Amount</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.count}</td>
              <td>{formatMoney(row.amount)}</td>
              <td>{(row.share * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function Portfolio() {
  const data = useMemo(() => {
    const activeRows = activeFinanceContracts.map((contract) => ({ contract, preview: contractPreview(contract) }));
    const pendingApplications = applicationPipeline.filter((application) => application.stage !== "APPROVED" && application.stage !== "REJECTED");
    const pendingApplicationRows = pendingApplications.map((application) => ({ application, preview: applicationPreview(application) }));
    const activeFinancedAmount = activeRows.reduce((sum, row) => sum + row.preview.financedAmount, 0);
    const expectedMonthlyLeaseIncome = activeRows.reduce((sum, row) => sum + row.preview.totalMonthly, 0);
    const estimatedEmcRetainedMonthly = activeRows.reduce((sum, row) => sum + row.preview.emcRetainedMonthly, 0);
    const pendingApplicationsValue = pendingApplicationRows.reduce((sum, row) => sum + row.preview.financedAmount, 0);
    const averageApr = activeFinanceContracts.reduce((sum, contract) => sum + contract.aprPct, 0) / activeFinanceContracts.length;
    const averageDown = activeFinanceContracts.reduce((sum, contract) => sum + contract.downPaymentPct, 0) / activeFinanceContracts.length;
    const bankShareMonthly = activeRows.reduce((sum, row) => sum + row.preview.bankPi, 0);
    const receivables = Array.from({ length: 6 }, (_, index) => {
      const month = addMonths(new Date("2026-06-01T00:00:00.000Z"), index);
      return {
        month: monthLabel(month),
        expectedLeaseIncome: expectedMonthlyLeaseIncome,
        estimatedBankShare: bankShareMonthly,
        estimatedEmcRetained: estimatedEmcRetainedMonthly,
        activeContractsCount: activeRows.length
      };
    });

    return {
      activeRows,
      pendingApplications,
      activeFinancedAmount,
      expectedMonthlyLeaseIncome,
      pendingApplicationsValue,
      averageApr,
      averageDown,
      estimatedEmcRetainedMonthly,
      receivables
    };
  }, []);

  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Portfolio</h1>
            <p className={financeStyles.intro}>Readonly lender finance overview using demo estimates. Values are not audited financial statements and do not mutate contracts, payments, collections, or GPS workflows.</p>
          </div>
        </header>

        <FinanceSummaryStrip
          metrics={[
            { label: "Active financed amount", value: formatMoney(data.activeFinancedAmount), tone: "blue" },
            { label: "Expected monthly lease income", value: formatMoney(data.expectedMonthlyLeaseIncome), tone: "green" },
            { label: "Pending applications value", value: formatMoney(data.pendingApplicationsValue), tone: "amber" },
            { label: "Average APR", value: `${data.averageApr.toFixed(1)}%` },
            { label: "Average down payment", value: `${data.averageDown.toFixed(1)}%` },
            { label: "Estimated EMC retained / month", value: formatMoney(data.estimatedEmcRetainedMonthly), tone: "green" }
          ]}
        />

        <section className="screen-panel">
          <h2>Portfolio composition</h2>
          <p className={financeStyles.intro}>Demo composition excludes down payments from collection efficiency and keeps finance segmentation separate from enforcement state.</p>
          <div className={financeStyles.compositionGrid}>
            <MiniTable title="By pricing tier" rows={composeRows(activeFinanceContracts, (contract) => tierName(contract.pricingTierId), (contract) => contractPreview(contract).financedAmount)} />
            <MiniTable title="By financial partner" rows={composeRows(activeFinanceContracts, (contract) => partnerName(contract.financialPartnerId), (contract) => contractPreview(contract).financedAmount)} />
            <MiniTable title="By vehicle brand" rows={composeRows(activeFinanceContracts, (contract) => contract.brand, (contract) => contractPreview(contract).financedAmount)} />
            <MiniTable title="By application stage" rows={composeRows(applicationPipeline, (application) => applicationStageLabels[application.stage], (application) => applicationPreview(application).financedAmount)} />
          </div>
        </section>

        <section className="screen-panel">
          <h2>Future receivables preview</h2>
          <DataTable
            rows={data.receivables}
            rowKey={(row) => row.month}
            exportCSV="finance-receivables-preview.csv"
            columns={[
              { key: "month", header: "Month" },
              { key: "expectedLeaseIncome", header: "Expected lease income", render: (row) => <span className={financeStyles.money}>{formatMoney(row.expectedLeaseIncome)}</span>, csvValue: (row) => row.expectedLeaseIncome, sortValue: (row) => row.expectedLeaseIncome },
              { key: "estimatedBankShare", header: "Estimated bank share", render: (row) => <span className={financeStyles.money}>{formatMoney(row.estimatedBankShare)}</span>, csvValue: (row) => row.estimatedBankShare, sortValue: (row) => row.estimatedBankShare },
              { key: "estimatedEmcRetained", header: "Estimated EMC retained", render: (row) => <span className={financeStyles.money}>{formatMoney(row.estimatedEmcRetained)}</span>, csvValue: (row) => row.estimatedEmcRetained, sortValue: (row) => row.estimatedEmcRetained },
              { key: "activeContractsCount", header: "Active contracts count", render: (row) => <span className={financeStyles.number}>{row.activeContractsCount}</span>, sortValue: (row) => row.activeContractsCount }
            ]}
          />
        </section>

        <section className="screen-panel">
          <h2>Risk / operations bridge</h2>
          <p className={financeStyles.intro}>Readonly operational context only. No controller, collections, GPS, restore, or Telegram action is available from this finance page.</p>
          <div className={financeStyles.opsBridgeGrid}>
            {operationalBridge.map((item) => (
              <div key={item.label} className={financeStyles.opsBridgeItem}>
                <FinanceTraffic tone={item.tone === "red" ? "red" : item.tone === "blue" ? "blue" : "amber"} label={item.label} />
                <strong>{item.value}</strong>
                <span>{item.note}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </FinanceGate>
  );
}
