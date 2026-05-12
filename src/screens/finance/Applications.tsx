import { useEffect, useMemo, useState } from "react";
import DataTable from "../../components/DataTable";
import { formatDate } from "../../lib/formatDate";
import { formatMoney } from "../../lib/formatMoney";
import { api, type ApplicationPayload, type ApplicationRecord } from "../../services/api";
import { useAuth } from "../../store/auth";
import { useUi } from "../../store/ui";
import ApplicationDetailDrawer from "./ApplicationDetailDrawer";
import { calculateDealPreview } from "./applicationDealMath";
import type { ApplicationSignal, ApplicationStage, FinanceApplication } from "./applicationReferenceData";
import { applicationStageLabels } from "./applicationReferenceData";
import { financialPartners as fallbackFinancialPartners, insurancePartners as fallbackInsurancePartners, pricingTiers, vehicleCatalog as fallbackVehicleCatalog, type FinancialPartner, type InsurancePartner, type TrafficTone, type VehicleCatalogItem } from "./financeReferenceData";
import { toFinancialPartnerOption, toInsurancePartnerOption } from "./financePartnerAdapters";
import { FinanceGate, FinancePill, FinanceSummaryStrip, FinanceTraffic, financeStyles } from "./FinanceReferenceShared";
import { toVehicleCatalogItem } from "./vehicleCatalogAdapters";

const activePipelineStages: ApplicationStage[] = ["DRAFT", "DOCS_PENDING", "BANK_REVIEW", "READY_TO_SIGN"];

function signalFor(application: FinanceApplication): { label: ApplicationSignal; tone: TrafficTone } {
  if (application.stage === "APPROVED") return { label: "APPROVED", tone: "blue" };
  if (application.stage === "REJECTED" || application.stage === "CANCELLED") return { label: "REJECTED", tone: "red" };
  if (application.blockedReason) return { label: "BLOCKED", tone: "red" };
  if (application.stage === "READY_TO_SIGN") return { label: "READY", tone: "green" };
  return { label: "WATCH", tone: "amber" };
}

function stageTone(stage: ApplicationStage) {
  return stage;
}

function partnerName(id: string, partners: FinancialPartner[]) {
  return partners.find((partner) => partner.id === id)?.partnerName ?? id;
}

function tierName(id: string) {
  return pricingTiers.find((tier) => tier.id === id)?.tierName ?? id;
}

function financedAmount(application: FinanceApplication, partners: FinancialPartner[], insurers: InsurancePartner[]) {
  return calculateDealPreview({
    vehiclePrice: application.vehiclePrice,
    vehicleCost: application.vehicleCost,
    downPaymentAmount: application.downPaymentAmount,
    downPaymentPct: application.downPaymentPct,
    termMonths: application.termMonths,
    aprPct: application.aprPct,
    gpsFeeGross: pricingTiers.find((tier) => tier.id === application.pricingTierId)?.gpsFee ?? 0,
    gpsCostGsm: 700,
    insurancePct: insurers.find((partner) => partner.id === application.insurancePartnerId)?.premiumPct ?? 0,
    insuranceCommissionPct: insurers.find((partner) => partner.id === application.insurancePartnerId)?.commissionPct ?? 0,
    bankCostRatePct: partners.find((partner) => partner.id === application.financialPartnerId)?.costRatePct ?? 0,
    bankFundingSharePct: application.bankFundingSharePct
  }).financedAmount;
}

function fromRecord(record: ApplicationRecord): FinanceApplication {
  const bankFundingSharePct =
    record.bank_funded_amount_cents != null && record.vehicle_price_cents > record.down_payment_cents
      ? Number(((record.bank_funded_amount_cents / (record.vehicle_price_cents - record.down_payment_cents)) * 100).toFixed(2))
      : 85;
  return {
    id: record.id,
    clientFullName: record.client_full_name,
    clientPhone: record.client_phone,
    clientNationalId: record.client_national_id ?? "",
    clientAddress: "",
    vehicleCatalogId: record.vehicle_catalog_id ?? "",
    vehicleBrand: record.vehicle_brand,
    vehicleModel: record.vehicle_model,
    vehicleYear: record.vehicle_year ?? new Date().getFullYear(),
    vehiclePrice: record.vehicle_price_cents,
    vehicleCost: record.vehicle_cost_cents ?? 0,
    downPaymentAmount: record.down_payment_cents,
    downPaymentPct: record.down_payment_pct,
    termMonths: record.term_months,
    aprPct: record.apr_pct,
    pricingTierId: record.pricing_tier_id ?? "basic",
    financialPartnerId: record.financial_partner_id ?? "fp_icare",
    insurancePartnerId: record.insurance_partner_id ?? "ip_cb",
    bankAccountId: record.bank_account_id ?? "ba_icare",
    bankFundingSharePct,
    bankFundedAmount: record.bank_funded_amount_cents ?? undefined,
    emcFundedAmount: record.emc_funded_amount_cents ?? undefined,
    settlementMode: (record.settlement_mode || "partner_pass_through") as FinanceApplication["settlementMode"],
    closureMode: (record.closure_mode || "standard_signing") as FinanceApplication["closureMode"],
    startDate: record.created_at,
    notes: record.notes,
    stage: record.stage,
    createdAt: record.created_at,
    rejectedReason: record.rejected_reason ?? undefined
  };
}

function blankApplication(role?: string): FinanceApplication {
  const now = new Date().toISOString();
  const isSales = role === "SALES";
  return {
    id: "APP-NEW",
    clientFullName: "",
    clientPhone: "",
    clientNationalId: "",
    clientAddress: "",
    vehicleCatalogId: "",
    vehicleBrand: "",
    vehicleModel: "",
    vehicleYear: new Date().getFullYear(),
    vehiclePrice: 0,
    vehicleCost: 0,
    downPaymentAmount: 0,
    downPaymentPct: 0,
    termMonths: 36,
    aprPct: 18,
    pricingTierId: "basic",
    financialPartnerId: isSales ? "" : "fp_icare",
    insurancePartnerId: isSales ? "" : "ip_cb",
    bankAccountId: isSales ? "" : "ba_icare",
    bankFundingSharePct: isSales ? 0 : 85,
    settlementMode: "partner_pass_through",
    closureMode: "standard_signing",
    startDate: now,
    notes: "",
    stage: "DRAFT",
    createdAt: now
  };
}

export default function Applications() {
  const role = useAuth((state) => state.user?.role);
  const [selectedApplication, setSelectedApplication] = useState<FinanceApplication | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("edit");
  const [loaded, setLoaded] = useState<FinanceApplication[]>([]);
  const [pipelineScope, setPipelineScope] = useState<"active" | "all" | "APPROVED" | "REJECTED" | "CANCELLED">("active");
  const [stageFilter, setStageFilter] = useState<"all" | ApplicationStage>("all");
  const [financialPartnerFilter, setFinancialPartnerFilter] = useState("all");
  const [insurancePartnerFilter, setInsurancePartnerFilter] = useState("all");
  const [vehicleBrandFilter, setVehicleBrandFilter] = useState("all");
  const [financialPartnerOptions, setFinancialPartnerOptions] = useState<FinancialPartner[]>(fallbackFinancialPartners);
  const [insurancePartnerOptions, setInsurancePartnerOptions] = useState<InsurancePartner[]>(fallbackInsurancePartners);
  const [vehicleCatalogOptions, setVehicleCatalogOptions] = useState<VehicleCatalogItem[]>(fallbackVehicleCatalog);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useUi((state) => state.addToast);
  const canManageApplications = role === "ADMIN" || role === "SALES" || role === "FINANCE";
  const isSales = role === "SALES";

  const loadApplications = async () => {
    setLoading(true);
    try {
      const [result, financialResult, insuranceResult, vehicleResult] = await Promise.all([
        api.getApplications(),
        api.getFinancialPartners(),
        api.getInsurancePartners(),
        api.getVehicleCatalog()
      ]);
      setLoaded(result.applications.map(fromRecord));
      setFinancialPartnerOptions(financialResult.partners.map(toFinancialPartnerOption));
      setInsurancePartnerOptions(insuranceResult.partners.map(toInsurancePartnerOption));
      setVehicleCatalogOptions(vehicleResult.vehicles.map(toVehicleCatalogItem));
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load applications";
      setLoadError(message);
      toast(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, []);

  const applications = loaded;
  const vehicleBrands = useMemo(() => Array.from(new Set(applications.map((application) => application.vehicleBrand).filter(Boolean))).sort(), [applications]);
  const filteredApplications = useMemo(
    () =>
      applications.filter((application) => {
        if (pipelineScope === "active" && !activePipelineStages.includes(application.stage)) return false;
        if (pipelineScope === "APPROVED" && application.stage !== "APPROVED") return false;
        if (pipelineScope === "REJECTED" && application.stage !== "REJECTED") return false;
        if (pipelineScope === "CANCELLED" && application.stage !== "CANCELLED") return false;
        if (stageFilter !== "all" && application.stage !== stageFilter) return false;
        if (financialPartnerFilter !== "all" && application.financialPartnerId !== financialPartnerFilter) return false;
        if (insurancePartnerFilter !== "all" && application.insurancePartnerId !== insurancePartnerFilter) return false;
        if (vehicleBrandFilter !== "all" && application.vehicleBrand !== vehicleBrandFilter) return false;
        return true;
      }),
    [applications, financialPartnerFilter, insurancePartnerFilter, pipelineScope, stageFilter, vehicleBrandFilter]
  );
  const summary = useMemo(() => {
    const total = applications.length;
    const docs = applications.filter((application) => application.stage === "DOCS_PENDING").length;
    const bankReview = applications.filter((application) => application.stage === "BANK_REVIEW").length;
    const ready = applications.filter((application) => application.stage === "READY_TO_SIGN").length;
    const avgApr = total ? applications.reduce((sum, application) => sum + application.aprPct, 0) / total : 0;
    const avgDown = total ? applications.reduce((sum, application) => sum + application.downPaymentPct, 0) / total : 0;
    return [
      { label: "Total applications", value: total },
      { label: "Docs pending", value: docs, tone: docs ? ("amber" as const) : ("slate" as const) },
      { label: "Bank review", value: bankReview, tone: "blue" as const },
      { label: "Ready to sign", value: ready, tone: "green" as const },
      { label: "Avg APR", value: `${avgApr.toFixed(1)}%` },
      { label: "Avg down payment", value: `${avgDown.toFixed(1)}%` }
    ];
  }, [applications]);

  const openApplicationDrawer = (application: FinanceApplication) => {
    setSelectedApplication(application);
    setDrawerMode("edit");
    setIsDrawerOpen(true);
  };

  const openNewApplicationDrawer = () => {
    setSelectedApplication(blankApplication(role));
    setDrawerMode("create");
    setIsDrawerOpen(true);
  };

  const closeApplicationDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedApplication(null);
  };

  const saveApplication = async (payload: ApplicationPayload) => {
    try {
      const saved = drawerMode === "create" ? await api.createApplication(payload) : await api.updateApplication(selectedApplication?.id ?? "", payload);
      toast(drawerMode === "create" ? "Application created" : "Application updated");
      await loadApplications();
      setSelectedApplication(fromRecord(saved));
      setIsDrawerOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Application save failed");
      throw error;
    }
  };

  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Applications</h1>
            <p className={financeStyles.intro}>Partner intake pipeline for proposed financed vehicle contracts. Saving an application persists intake only and does not create contracts, payments, GPS devices, or collections cases.</p>
          </div>
          {canManageApplications ? <button className="primary-button" onClick={openNewApplicationDrawer}>+ New Application</button> : null}
        </header>
        {loadError ? <p className={financeStyles.note}>{loadError}</p> : null}
        <FinanceSummaryStrip metrics={summary} />
        <section className="screen-panel">
          <h2>{loading ? "Loading applications" : "Origination pipeline"}</h2>
          <div className={financeStyles.filterGrid}>
            <label>
              <span>Pipeline view</span>
              <select value={pipelineScope} onChange={(event) => setPipelineScope(event.target.value as typeof pipelineScope)}>
                <option value="active">Active pipeline</option>
                <option value="all">All records</option>
                <option value="APPROVED">Approved only</option>
                <option value="REJECTED">Rejected only</option>
                <option value="CANCELLED">Cancelled only</option>
              </select>
            </label>
            <label>
              <span>Stage</span>
              <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as "all" | ApplicationStage)}>
                <option value="all">All stages</option>
                {Object.entries(applicationStageLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {!isSales ? (
              <label>
                <span>Financial partner</span>
                <select value={financialPartnerFilter} onChange={(event) => setFinancialPartnerFilter(event.target.value)}>
                  <option value="all">All financial partners</option>
                  {financialPartnerOptions.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.partnerName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {!isSales ? (
              <label>
                <span>Insurance partner</span>
                <select value={insurancePartnerFilter} onChange={(event) => setInsurancePartnerFilter(event.target.value)}>
                  <option value="all">All insurance partners</option>
                  {insurancePartnerOptions.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.insurer}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>Vehicle brand</span>
              <select value={vehicleBrandFilter} onChange={(event) => setVehicleBrandFilter(event.target.value)}>
                <option value="all">All brands</option>
                {vehicleBrands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DataTable
            rows={filteredApplications}
            rowKey={(row) => row.id}
            onRowClick={openApplicationDrawer}
            searchKey={(row) => `${row.id} ${row.clientFullName} ${row.clientPhone} ${row.vehicleBrand} ${row.vehicleModel} ${applicationStageLabels[row.stage]} ${tierName(row.pricingTierId)} ${partnerName(row.financialPartnerId, financialPartnerOptions)} ${insurancePartnerOptions.find((partner) => partner.id === row.insurancePartnerId)?.insurer ?? row.insurancePartnerId}`}
            exportCSV="finance-applications.csv"
            columns={[
              { key: "signal", header: "Signal", render: (row) => <FinanceTraffic tone={signalFor(row).tone} label={signalFor(row).label} />, sortValue: (row) => signalFor(row).label },
              { key: "id", header: "Application ID", render: (row) => <span className={financeStyles.tableId}>{row.id}</span> },
              { key: "clientFullName", header: "Client" },
              { key: "vehicle", header: "Vehicle", render: (row) => <span className={financeStyles.tableWideText}>{row.vehicleBrand} {row.vehicleModel}</span>, csvValue: (row) => `${row.vehicleBrand} ${row.vehicleModel}` },
              { key: "stage", header: "Status", render: (row) => <span className={financeStyles.statusCell}><FinancePill active={row.stage !== "REJECTED" && row.stage !== "CANCELLED"} label={stageTone(row.stage)} /></span>, csvValue: (row) => row.stage, sortValue: (row) => row.stage },
              { key: "pricingTierId", header: "Tier", render: (row) => tierName(row.pricingTierId), csvValue: (row) => tierName(row.pricingTierId) },
              { key: "aprPct", header: "APR", render: (row) => <span className={financeStyles.number}>{row.aprPct.toFixed(1)}%</span>, sortValue: (row) => row.aprPct },
              { key: "downPaymentPct", header: "Down %", render: (row) => <span className={financeStyles.number}>{row.downPaymentPct.toFixed(1)}%</span>, sortValue: (row) => row.downPaymentPct },
              { key: "financedAmount", header: "Financed amount", render: (row) => <span className={financeStyles.money}>{formatMoney(financedAmount(row, financialPartnerOptions, insurancePartnerOptions))}</span>, csvValue: (row) => financedAmount(row, financialPartnerOptions, insurancePartnerOptions), sortValue: (row) => financedAmount(row, financialPartnerOptions, insurancePartnerOptions) },
              ...(!isSales ? [{ key: "financialPartnerId", header: "Partner", render: (row: FinanceApplication) => <span className={financeStyles.tableWideText}>{partnerName(row.financialPartnerId, financialPartnerOptions)}</span>, csvValue: (row: FinanceApplication) => partnerName(row.financialPartnerId, financialPartnerOptions) }] : []),
              { key: "createdAt", header: "Created", render: (row) => formatDate(row.createdAt), sortValue: (row) => row.createdAt }
            ]}
          />
        </section>
        {isDrawerOpen && selectedApplication ? (
          <ApplicationDetailDrawer
            key={`${drawerMode}-${selectedApplication.id}`}
            mode={drawerMode}
            application={selectedApplication}
            financialPartnerOptions={financialPartnerOptions}
            insurancePartnerOptions={insurancePartnerOptions}
            vehicleCatalogOptions={vehicleCatalogOptions}
            duplicateApplications={applications}
            onClose={closeApplicationDrawer}
            onSave={canManageApplications ? saveApplication : undefined}
          />
        ) : null}
      </div>
    </FinanceGate>
  );
}
