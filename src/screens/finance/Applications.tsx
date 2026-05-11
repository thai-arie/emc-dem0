import { useMemo, useState } from "react";
import DataTable from "../../components/DataTable";
import { formatDate } from "../../lib/formatDate";
import { formatMoney } from "../../lib/formatMoney";
import ApplicationDetailDrawer from "./ApplicationDetailDrawer";
import { calculateDealPreview } from "./applicationDealMath";
import type { ApplicationSignal, ApplicationStage, FinanceApplication } from "./applicationReferenceData";
import { applicationPipeline, applicationStageLabels } from "./applicationReferenceData";
import { financialPartners, insurancePartners, pricingTiers, type TrafficTone } from "./financeReferenceData";
import { FinanceGate, FinancePill, FinanceSummaryStrip, FinanceTraffic, financeStyles } from "./FinanceReferenceShared";

function signalFor(application: FinanceApplication): { label: ApplicationSignal; tone: TrafficTone } {
  if (application.stage === "approved") return { label: "APPROVED", tone: "blue" };
  if (application.stage === "rejected") return { label: "REJECTED", tone: "red" };
  if (application.blockedReason) return { label: "BLOCKED", tone: "red" };
  if (application.stage === "ready_to_sign") return { label: "READY", tone: "green" };
  return { label: "WATCH", tone: "amber" };
}

function stageTone(stage: ApplicationStage) {
  if (stage === "approved") return "APPROVED";
  if (stage === "rejected") return "REJECTED";
  return applicationStageLabels[stage].toUpperCase();
}

function partnerName(id: string) {
  return financialPartners.find((partner) => partner.id === id)?.partnerName ?? id;
}

function tierName(id: string) {
  return pricingTiers.find((tier) => tier.id === id)?.tierName ?? id;
}

function financedAmount(application: FinanceApplication) {
  return calculateDealPreview({
    vehiclePrice: application.vehiclePrice,
    vehicleCost: application.vehicleCost,
    downPaymentPct: application.downPaymentPct,
    termMonths: application.termMonths,
    aprPct: application.aprPct,
    gpsFeeGross: pricingTiers.find((tier) => tier.id === application.pricingTierId)?.gpsFee ?? 0,
    gpsCostGsm: 700,
    insurancePct: insurancePartners.find((partner) => partner.id === application.insurancePartnerId)?.premiumPct ?? 0,
    insuranceCommissionPct: insurancePartners.find((partner) => partner.id === application.insurancePartnerId)?.commissionPct ?? 0,
    bankCostRatePct: financialPartners.find((partner) => partner.id === application.financialPartnerId)?.costRatePct ?? 0,
    bankFundingSharePct: application.bankFundingSharePct
  }).financedAmount;
}

export default function Applications() {
  const [selectedApplication, setSelectedApplication] = useState<FinanceApplication | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const summary = useMemo(() => {
    const total = applicationPipeline.length;
    const docs = applicationPipeline.filter((application) => application.stage === "docs").length;
    const bankReview = applicationPipeline.filter((application) => application.stage === "bank_review").length;
    const ready = applicationPipeline.filter((application) => application.stage === "ready_to_sign").length;
    const avgApr = applicationPipeline.reduce((sum, application) => sum + application.aprPct, 0) / total;
    const avgDown = applicationPipeline.reduce((sum, application) => sum + application.downPaymentPct, 0) / total;
    return [
      { label: "Total applications", value: total },
      { label: "Docs pending", value: docs, tone: docs ? ("amber" as const) : ("slate" as const) },
      { label: "Bank review", value: bankReview, tone: "blue" as const },
      { label: "Ready to sign", value: ready, tone: "green" as const },
      { label: "Avg APR", value: `${avgApr.toFixed(1)}%` },
      { label: "Avg down payment", value: `${avgDown.toFixed(1)}%` }
    ];
  }, []);

  const openApplicationDrawer = (application: FinanceApplication) => {
    setSelectedApplication(application);
    setIsDrawerOpen(true);
  };

  const closeApplicationDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedApplication(null);
  };

  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Applications</h1>
            <p className={financeStyles.intro}>Origination pipeline for proposed financed vehicle contracts. This is a readonly, frontend-only simulator and does not create operational records.</p>
          </div>
        </header>
        <FinanceSummaryStrip metrics={summary} />
        <section className="screen-panel">
          <h2>Origination pipeline</h2>
          <DataTable
            rows={applicationPipeline}
            rowKey={(row) => row.id}
            onRowClick={openApplicationDrawer}
            searchKey={(row) => `${row.id} ${row.clientFullName} ${row.vehicleBrand} ${row.vehicleModel} ${applicationStageLabels[row.stage]} ${tierName(row.pricingTierId)} ${partnerName(row.financialPartnerId)}`}
            filters={[
              { label: "Docs", predicate: (row) => row.stage === "docs" },
              { label: "Bank review", predicate: (row) => row.stage === "bank_review" },
              { label: "Ready", predicate: (row) => row.stage === "ready_to_sign" },
              { label: "Approved", predicate: (row) => row.stage === "approved" },
              { label: "Rejected", predicate: (row) => row.stage === "rejected" }
            ]}
            exportCSV="finance-applications.csv"
            columns={[
              { key: "signal", header: "Signal", render: (row) => <FinanceTraffic tone={signalFor(row).tone} label={signalFor(row).label} />, sortValue: (row) => signalFor(row).label },
              { key: "id", header: "Application ID", render: (row) => <span className={financeStyles.tableText}>{row.id}</span> },
              { key: "clientFullName", header: "Client" },
              { key: "vehicle", header: "Vehicle", render: (row) => `${row.vehicleBrand} ${row.vehicleModel}`, csvValue: (row) => `${row.vehicleBrand} ${row.vehicleModel}` },
              { key: "stage", header: "Stage", render: (row) => <FinancePill active={row.stage !== "rejected"} label={stageTone(row.stage)} />, csvValue: (row) => row.stage },
              { key: "pricingTierId", header: "Tier", render: (row) => tierName(row.pricingTierId), csvValue: (row) => tierName(row.pricingTierId) },
              { key: "aprPct", header: "APR", render: (row) => <span className={financeStyles.number}>{row.aprPct.toFixed(1)}%</span>, sortValue: (row) => row.aprPct },
              { key: "downPaymentPct", header: "Down %", render: (row) => <span className={financeStyles.number}>{row.downPaymentPct.toFixed(1)}%</span>, sortValue: (row) => row.downPaymentPct },
              { key: "financedAmount", header: "Financed amount", render: (row) => <span className={financeStyles.money}>{formatMoney(financedAmount(row))}</span>, csvValue: financedAmount, sortValue: financedAmount },
              { key: "financialPartnerId", header: "Partner", render: (row) => <span className={financeStyles.tableText}>{partnerName(row.financialPartnerId)}</span>, csvValue: (row) => partnerName(row.financialPartnerId) },
              { key: "createdAt", header: "Created", render: (row) => formatDate(row.createdAt), sortValue: (row) => row.createdAt }
            ]}
          />
        </section>
        {isDrawerOpen && selectedApplication ? <ApplicationDetailDrawer key={selectedApplication.id} application={selectedApplication} onClose={closeApplicationDrawer} /> : null}
      </div>
    </FinanceGate>
  );
}
