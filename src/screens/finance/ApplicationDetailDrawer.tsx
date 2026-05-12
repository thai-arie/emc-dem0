import { useMemo, useState } from "react";
import Drawer from "../../components/Drawer";
import type { Role } from "../../entities/types";
import { formatDate } from "../../lib/formatDate";
import { formatMoney } from "../../lib/formatMoney";
import type { ApplicationPayload } from "../../services/api";
import { useAuth } from "../../store/auth";
import ApplicationDealPreview from "./ApplicationDealPreview";
import { calculateDealPreview, generateInstallmentSchedulePreview } from "./applicationDealMath";
import type { FinanceApplication } from "./applicationReferenceData";
import { applicationStageLabels } from "./applicationReferenceData";
import {
  bankAccounts,
  financialPartners as fallbackFinancialPartners,
  insurancePartners as fallbackInsurancePartners,
  pricingTiers,
  vehicleCatalog as fallbackVehicleCatalog,
  type FinancialPartner,
  type InsurancePartner,
  type VehicleCatalogItem
} from "./financeReferenceData";
import { DetailField, financeStyles } from "./FinanceReferenceShared";

type Draft = {
  clientFullName: string;
  clientPhone: string;
  clientNationalId: string;
  vehicleCatalogId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  vehiclePriceDollars: number;
  vehicleCostDollars: number;
  downPaymentDollars: number;
  downPaymentPct: number;
  termMonths: number;
  aprPct: number;
  pricingTierId: string;
  financialPartnerId: string;
  insurancePartnerId: string;
  bankAccountId: string;
  stage: FinanceApplication["stage"];
  settlementMode: FinanceApplication["settlementMode"];
  closureMode: FinanceApplication["closureMode"];
  notes: string;
  rejectedReason: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pctFromAmount(amountDollars: number, vehiclePriceDollars: number) {
  if (vehiclePriceDollars <= 0) return 0;
  return Number(((amountDollars / vehiclePriceDollars) * 100).toFixed(2));
}

function amountFromPct(vehiclePriceDollars: number, downPaymentPct: number) {
  return Math.round(vehiclePriceDollars * (downPaymentPct / 100));
}

const tierDefaults: Record<string, { aprPct: number; downPaymentPct: number; termMonths: number }> = {
  premium: { aprPct: 15, downPaymentPct: 15, termMonths: 48 },
  basic: { aprPct: 18, downPaymentPct: 20, termMonths: 36 },
  risky: { aprPct: 23, downPaymentPct: 35, termMonths: 30 },
  "self-funded": { aprPct: 20, downPaymentPct: 25, termMonths: 36 }
};

function canViewMargin(role: Role | undefined) {
  return role === "ADMIN" || role === "FINANCE";
}

function formatPreviewDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toDraft(application: FinanceApplication): Draft {
  const vehiclePriceDollars = Math.round(application.vehiclePrice / 100);
  const vehicleCostDollars = Math.round(application.vehicleCost / 100);
  const downPaymentPct = clamp(application.downPaymentPct, 0, 100);
  const downPaymentDollars = Math.round((application.downPaymentAmount ?? amountFromPct(vehiclePriceDollars, downPaymentPct) * 100) / 100);
  return {
    clientFullName: application.clientFullName,
    clientPhone: application.clientPhone,
    clientNationalId: application.clientNationalId,
    vehicleCatalogId: application.vehicleCatalogId,
    vehicleBrand: application.vehicleBrand,
    vehicleModel: application.vehicleModel,
    vehicleYear: application.vehicleYear,
    vehiclePriceDollars,
    vehicleCostDollars,
    downPaymentDollars,
    downPaymentPct,
    termMonths: application.termMonths,
    aprPct: application.aprPct,
    pricingTierId: application.pricingTierId,
    financialPartnerId: application.financialPartnerId,
    insurancePartnerId: application.insurancePartnerId,
    bankAccountId: application.bankAccountId,
    stage: application.stage,
    settlementMode: application.settlementMode,
    closureMode: application.closureMode,
    notes: application.notes,
    rejectedReason: application.rejectedReason ?? ""
  };
}

export default function ApplicationDetailDrawer({
  application,
  mode = "edit",
  financialPartnerOptions = fallbackFinancialPartners,
  insurancePartnerOptions = fallbackInsurancePartners,
  vehicleCatalogOptions = fallbackVehicleCatalog,
  duplicateApplications = [],
  onClose,
  onSave
}: {
  application: FinanceApplication;
  mode?: "create" | "edit";
  financialPartnerOptions?: FinancialPartner[];
  insurancePartnerOptions?: InsurancePartner[];
  vehicleCatalogOptions?: VehicleCatalogItem[];
  duplicateApplications?: FinanceApplication[];
  onClose: () => void;
  onSave?: (payload: ApplicationPayload) => Promise<void>;
}) {
  const role = useAuth((state) => state.user?.role);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(application));
  const isSales = role === "SALES";
  const canSeeInternalEconomics = role === "ADMIN" || role === "FINANCE";
  const salesStageOptions: FinanceApplication["stage"][] = ["DRAFT", "DOCS_PENDING", "BANK_REVIEW"];
  const canEditStage = !isSales || salesStageOptions.includes(draft.stage);
  const stageOptions = isSales ? (salesStageOptions.includes(draft.stage) ? salesStageOptions : [draft.stage]) : Object.keys(applicationStageLabels) as FinanceApplication["stage"][];
  const partnerOptions = financialPartnerOptions.length ? financialPartnerOptions : fallbackFinancialPartners;
  const insurerOptions = insurancePartnerOptions.length ? insurancePartnerOptions : fallbackInsurancePartners;
  const vehicleOptions = vehicleCatalogOptions.length ? vehicleCatalogOptions : fallbackVehicleCatalog;
  const selectedTier = pricingTiers.find((tier) => tier.id === draft.pricingTierId) ?? pricingTiers[0];
  const selectedPartner = partnerOptions.find((partner) => partner.id === draft.financialPartnerId);
  const selectedInsurance = insurerOptions.find((partner) => partner.id === draft.insurancePartnerId);
  const selectedAccount = bankAccounts.find((account) => account.id === draft.bankAccountId);
  const duplicateWarnings = useMemo(() => {
    const normalize = (value: string) => value.trim().toLowerCase();
    const normalizePhone = (value: string) => value.replace(/\D/g, "");
    const normalizeNationalId = (value: string) => value.trim().toUpperCase();
    const phone = normalizePhone(draft.clientPhone);
    const nationalId = normalizeNationalId(draft.clientNationalId);
    const clientName = normalize(draft.clientFullName);
    const vehicleBrand = normalize(draft.vehicleBrand);
    const vehicleModel = normalize(draft.vehicleModel);
    const candidates = duplicateApplications.filter((candidate) => candidate.id !== application.id);
    const warnings: string[] = [];
    const samePhone = phone ? candidates.filter((candidate) => normalizePhone(candidate.clientPhone) === phone) : [];
    const sameNationalId = nationalId ? candidates.filter((candidate) => normalizeNationalId(candidate.clientNationalId) === nationalId) : [];
    const sameClientVehicle =
      clientName && vehicleBrand && vehicleModel
        ? candidates.filter(
            (candidate) =>
              normalize(candidate.clientFullName) === clientName &&
              normalize(candidate.vehicleBrand) === vehicleBrand &&
              normalize(candidate.vehicleModel) === vehicleModel
          )
        : [];
    if (samePhone.length) warnings.push(`Possible duplicate: existing application ${samePhone.map((item) => item.id).join(", ")} with same phone`);
    if (sameNationalId.length) warnings.push(`Possible duplicate: existing application ${sameNationalId.map((item) => item.id).join(", ")} with same national ID`);
    if (sameClientVehicle.length) warnings.push(`Possible duplicate: same client and vehicle already exists (${sameClientVehicle.map((item) => item.id).join(", ")})`);
    return warnings;
  }, [application.id, draft.clientFullName, draft.clientNationalId, draft.clientPhone, draft.vehicleBrand, draft.vehicleModel, duplicateApplications]);

  const vehiclePrice = Math.max(0, Math.round(draft.vehiclePriceDollars * 100));
  const vehicleCost = Math.max(0, Math.round(draft.vehicleCostDollars * 100));
  const fundingShare = selectedPartner?.fundingType === "Self-funded" ? 0 : application.bankFundingSharePct;
  const preview = useMemo(
    () =>
      calculateDealPreview({
        vehiclePrice,
        vehicleCost,
        downPaymentAmount: Math.round(draft.downPaymentDollars * 100),
        downPaymentPct: draft.downPaymentPct,
        termMonths: draft.termMonths,
        aprPct: draft.aprPct,
        gpsFeeGross: selectedTier.gpsFee,
        gpsCostGsm: 700,
        insurancePct: selectedInsurance?.premiumPct ?? 0,
        insuranceCommissionPct: selectedInsurance?.commissionPct ?? 0,
        bankCostRatePct: selectedPartner?.costRatePct ?? 0,
        bankFundingSharePct: fundingShare
      }),
    [draft.aprPct, draft.downPaymentDollars, draft.downPaymentPct, draft.termMonths, fundingShare, selectedInsurance?.commissionPct, selectedInsurance?.premiumPct, selectedPartner?.costRatePct, selectedTier.gpsFee, vehicleCost, vehiclePrice]
  );
  const installmentPreview = useMemo(
    () =>
      generateInstallmentSchedulePreview({
        startDate: application.startDate,
        financedAmount: preview.financedAmount,
        annualRatePct: draft.aprPct,
        termMonths: draft.termMonths,
        totalMonthlyPayment: preview.totalMonthly,
        basePi: preview.basePi,
        limit: 6
      }),
    [application.startDate, draft.aprPct, draft.termMonths, preview.basePi, preview.financedAmount, preview.totalMonthly]
  );

  const updateSimpleNumber = (key: keyof Pick<Draft, "termMonths" | "aprPct">, value: string) => {
    const parsed = Number(value);
    setDraft((current) => ({ ...current, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  const updateText = (key: keyof Pick<Draft, "clientFullName" | "clientPhone" | "clientNationalId" | "vehicleCatalogId" | "vehicleBrand" | "vehicleModel" | "bankAccountId" | "notes" | "rejectedReason">, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateVehiclePrice = (value: string) => {
    const parsed = Number(value);
    const vehiclePriceDollars = Math.max(0, Number.isFinite(parsed) ? parsed : 0);
    setDraft((current) => {
      const downPaymentDollars = clamp(current.downPaymentDollars, 0, vehiclePriceDollars);
      return {
        ...current,
        vehiclePriceDollars,
        downPaymentDollars,
        downPaymentPct: pctFromAmount(downPaymentDollars, vehiclePriceDollars)
      };
    });
  };

  const updateDownPaymentAmount = (value: string) => {
    const parsed = Number(value);
    setDraft((current) => {
      const downPaymentDollars = clamp(Number.isFinite(parsed) ? parsed : 0, 0, current.vehiclePriceDollars);
      return {
        ...current,
        downPaymentDollars,
        downPaymentPct: pctFromAmount(downPaymentDollars, current.vehiclePriceDollars)
      };
    });
  };

  const updateDownPaymentPct = (value: string) => {
    const parsed = Number(value);
    setDraft((current) => {
      const downPaymentPct = clamp(Number.isFinite(parsed) ? parsed : 0, 0, 100);
      return {
        ...current,
        downPaymentPct,
        downPaymentDollars: amountFromPct(current.vehiclePriceDollars, downPaymentPct)
      };
    });
  };

  const updateVehicleCatalog = (vehicleCatalogId: string) => {
    const selected = vehicleOptions.find((item) => item.id === vehicleCatalogId);
    if (!selected) {
      setDraft((current) => ({ ...current, vehicleCatalogId: "" }));
      return;
    }

    const vehiclePriceDollars = Math.round(selected.defaultSalePrice / 100);
    setDraft((current) => {
      const downPaymentDollars = clamp(current.downPaymentDollars, 0, vehiclePriceDollars);
      return {
        ...current,
        vehicleCatalogId: selected.id,
        vehicleBrand: selected.brand,
        vehicleModel: selected.model,
        vehicleYear: selected.year,
        vehiclePriceDollars,
        vehicleCostDollars: Math.round(selected.defaultVehicleCost / 100),
        downPaymentDollars,
        downPaymentPct: pctFromAmount(downPaymentDollars, vehiclePriceDollars)
      };
    });
  };

  const updateTier = (tierId: string) => {
    const defaults = tierDefaults[tierId];
    setDraft((current) => ({
      ...current,
      pricingTierId: tierId,
      aprPct: defaults?.aprPct ?? current.aprPct,
      downPaymentPct: defaults?.downPaymentPct ?? current.downPaymentPct,
      downPaymentDollars: amountFromPct(current.vehiclePriceDollars, defaults?.downPaymentPct ?? current.downPaymentPct),
      termMonths: defaults?.termMonths ?? current.termMonths
    }));
  };

  const buildPayload = (): ApplicationPayload => ({
    client_full_name: draft.clientFullName,
    client_phone: draft.clientPhone,
    client_national_id: draft.clientNationalId || null,
    vehicle_catalog_id: draft.vehicleCatalogId || null,
    vehicle_brand: draft.vehicleBrand,
    vehicle_model: draft.vehicleModel,
    vehicle_year: draft.vehicleYear || null,
    vehicle_price_cents: preview.vehiclePrice,
    vehicle_cost_cents: isSales ? application.vehicleCost : preview.vehicleCost,
    down_payment_cents: preview.downPayment,
    down_payment_pct: draft.downPaymentPct,
    term_months: draft.termMonths,
    apr_pct: draft.aprPct,
    pricing_tier_id: draft.pricingTierId || null,
    financial_partner_id: isSales ? application.financialPartnerId || null : draft.financialPartnerId || null,
    insurance_partner_id: isSales ? application.insurancePartnerId || null : draft.insurancePartnerId || null,
    bank_account_id: isSales ? application.bankAccountId || null : draft.bankAccountId || null,
    bank_funded_amount_cents: isSales ? application.bankFundedAmount ?? null : preview.bankFundedAmount,
    emc_funded_amount_cents: isSales ? application.emcFundedAmount ?? null : preview.emcFundedAmount,
    settlement_mode: draft.settlementMode,
    closure_mode: draft.closureMode,
    stage: draft.stage,
    notes: draft.notes,
    rejected_reason: draft.rejectedReason || null
  });

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(buildPayload());
    } finally {
      setSaving(false);
    }
  };

  const canPrintSummary = role === "ADMIN" || role === "SALES" || role === "FINANCE";

  const printSummary = () => {
    const rows: Array<[string, string]> = [
      ["Application ID", mode === "create" ? "Draft application" : application.id],
      ["Client name", draft.clientFullName || "-"],
      ["Phone", draft.clientPhone || "-"],
      ...(draft.clientNationalId ? ([["National ID", draft.clientNationalId]] as Array<[string, string]>) : []),
      ["Vehicle", `${draft.vehicleBrand} ${draft.vehicleModel} ${draft.vehicleYear || ""}`.trim() || "-"],
      ["Sale price", formatMoney(preview.vehiclePrice)],
      ["Down payment amount", formatMoney(preview.downPayment)],
      ["Down payment %", `${draft.downPaymentPct.toFixed(2)}%`],
      ["Financed amount", formatMoney(preview.financedAmount)],
      ["Term", `${draft.termMonths} months`],
      ["APR", `${draft.aprPct.toFixed(1)}%`],
      ["Monthly payment", formatMoney(preview.totalMonthly)],
      ...(canSeeInternalEconomics && selectedPartner ? ([["Finance partner", selectedPartner.partnerName]] as Array<[string, string]>) : []),
      ...(canSeeInternalEconomics && selectedInsurance ? ([["Insurance partner", selectedInsurance.insurer]] as Array<[string, string]>) : []),
      ["Stage", applicationStageLabels[draft.stage]],
      ...(draft.notes.trim() ? ([["Notes", draft.notes.trim()]] as Array<[string, string]>) : [])
    ];
    const summaryWindow = window.open("", "_blank", "width=900,height=1000");
    if (!summaryWindow) return;

    summaryWindow.opener = null;
    summaryWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Application Summary - ${escapeHtml(mode === "create" ? "Draft" : application.id)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 40px;
              color: #111827;
              background: #ffffff;
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              line-height: 1.45;
            }
            .document {
              max-width: 760px;
              margin: 0 auto;
            }
            .eyebrow {
              color: #475569;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.12em;
              text-transform: uppercase;
            }
            h1 {
              margin: 8px 0 6px;
              font-size: 28px;
              line-height: 1.15;
            }
            .subtitle {
              margin: 0 0 24px;
              color: #475569;
              font-size: 14px;
            }
            .disclaimer {
              margin: 0 0 24px;
              padding: 12px 14px;
              border: 1px solid #cbd5e1;
              background: #f8fafc;
              color: #334155;
              font-size: 13px;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid #cbd5e1;
            }
            th, td {
              padding: 10px 12px;
              border-bottom: 1px solid #e2e8f0;
              text-align: left;
              vertical-align: top;
              font-size: 13px;
            }
            th {
              width: 34%;
              background: #f1f5f9;
              color: #334155;
              font-weight: 800;
            }
            td {
              color: #0f172a;
              font-weight: 650;
              white-space: pre-wrap;
            }
            .footer {
              margin-top: 24px;
              color: #64748b;
              font-size: 11px;
            }
            @media print {
              @page { size: A4; margin: 18mm; }
              body { padding: 0; }
              .document { max-width: none; }
            }
          </style>
        </head>
        <body>
          <main class="document">
            <div class="eyebrow">EMC Financing Proposal</div>
            <h1>Application Summary</h1>
            <p class="subtitle">Generated ${escapeHtml(formatDate(new Date().toISOString()))}</p>
            <p class="disclaimer">This is a financing proposal summary, not a final signed contract.</p>
            <table>
              <tbody>
                ${rows
                  .map(
                    ([label, value]) => `
                      <tr>
                        <th>${escapeHtml(label)}</th>
                        <td>${escapeHtml(value)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
            <p class="footer">For partner review only. Final terms are subject to approval and signed contract documentation.</p>
          </main>
        </body>
      </html>
    `);
    summaryWindow.document.close();
    summaryWindow.focus();
    window.setTimeout(() => summaryWindow.print(), 150);
  };

  return (
    <Drawer title={`${mode === "create" ? "New Application" : application.id} - ${draft.clientFullName || "Partner intake"}`} onClose={onClose}>
      <div className={financeStyles.drawerStack}>
        <section className={financeStyles.drawerSection}>
          <h3>Client</h3>
          <div className={financeStyles.controlGrid}>
            <label>
              <span>Client full name</span>
              <input value={draft.clientFullName} onChange={(event) => updateText("clientFullName", event.target.value)} />
            </label>
            <label>
              <span>Phone</span>
              <input value={draft.clientPhone} onChange={(event) => updateText("clientPhone", event.target.value)} />
            </label>
            <label>
              <span>National ID / passport</span>
              <input value={draft.clientNationalId} onChange={(event) => updateText("clientNationalId", event.target.value)} />
            </label>
            <label>
              <span>Stage</span>
              <select disabled={!canEditStage} value={draft.stage} onChange={(event) => setDraft((current) => ({ ...current, stage: event.target.value as FinanceApplication["stage"] }))}>
                {stageOptions.map((value) => (
                  <option key={value} value={value}>
                    {applicationStageLabels[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {duplicateWarnings.length ? (
          <section className={financeStyles.warningPanel}>
            <h3>Duplicate watch</h3>
            <ul>
              {duplicateWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <p>Save is still allowed. Review before progressing this intake.</p>
          </section>
        ) : null}

        <section className={financeStyles.drawerSection}>
          <h3>Vehicle</h3>
          <div className={financeStyles.controlGrid}>
            <label>
              <span>Catalog reference</span>
              <select value={draft.vehicleCatalogId} onChange={(event) => updateVehicleCatalog(event.target.value)}>
                <option value="">Manual / not selected</option>
                {vehicleOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.brand} {item.model}{item.variant ? ` ${item.variant}` : ""} {item.year} - {formatMoney(item.defaultSalePrice)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Vehicle year</span>
              <input type="number" min="0" value={draft.vehicleYear} onChange={(event) => setDraft((current) => ({ ...current, vehicleYear: Math.round(Number(event.target.value || 0)) }))} />
            </label>
            <label>
              <span>Brand</span>
              <input value={draft.vehicleBrand} onChange={(event) => updateText("vehicleBrand", event.target.value)} />
            </label>
            <label>
              <span>Model</span>
              <input value={draft.vehicleModel} onChange={(event) => updateText("vehicleModel", event.target.value)} />
            </label>
          </div>
        </section>

        <section className={financeStyles.drawerSection}>
          <h3>Terms</h3>
          <div className={financeStyles.controlGrid}>
            <label>
              <span>Vehicle price</span>
              <input type="number" min="0" value={draft.vehiclePriceDollars} onChange={(event) => updateVehiclePrice(event.target.value)} />
            </label>
            {canSeeInternalEconomics ? (
              <label>
                <span>Vehicle cost</span>
                <input type="number" min="0" value={draft.vehicleCostDollars} onChange={(event) => setDraft((current) => ({ ...current, vehicleCostDollars: Math.max(0, Number(event.target.value || 0)) }))} />
              </label>
            ) : null}
            <div className={financeStyles.downPaymentPair}>
              <label>
                <span>Down payment ($)</span>
                <input type="number" min="0" max={draft.vehiclePriceDollars} value={draft.downPaymentDollars} onChange={(event) => updateDownPaymentAmount(event.target.value)} />
              </label>
              <label>
                <span>Down payment (%)</span>
                <input type="number" min="0" max="100" step="0.1" value={draft.downPaymentPct} onChange={(event) => updateDownPaymentPct(event.target.value)} />
              </label>
            </div>
            <label>
              <span>Term months</span>
              <input type="number" min="1" value={draft.termMonths} onChange={(event) => updateSimpleNumber("termMonths", event.target.value)} />
            </label>
            <label>
              <span>APR %</span>
              <input type="number" min="0" step="0.1" value={draft.aprPct} onChange={(event) => updateSimpleNumber("aprPct", event.target.value)} />
            </label>
            {canSeeInternalEconomics ? (
              <label>
                <span>Pricing tier</span>
                <select value={draft.pricingTierId} onChange={(event) => updateTier(event.target.value)}>
                  {pricingTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.tierName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {canSeeInternalEconomics ? (
              <label>
                <span>Financial partner</span>
                <select value={draft.financialPartnerId} onChange={(event) => setDraft((current) => ({ ...current, financialPartnerId: event.target.value }))}>
                  <option value="">Not assigned</option>
                  {partnerOptions.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.partnerName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {canSeeInternalEconomics ? (
              <label>
                <span>Insurance partner</span>
                <select value={draft.insurancePartnerId} onChange={(event) => setDraft((current) => ({ ...current, insurancePartnerId: event.target.value }))}>
                  <option value="">Not assigned</option>
                  {insurerOptions.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.insurer}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {canSeeInternalEconomics ? (
              <label>
                <span>Bank account</span>
                <select value={draft.bankAccountId} onChange={(event) => updateText("bankAccountId", event.target.value)}>
                  <option value="">Not assigned</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <p className={financeStyles.note}>Simulation only. Closing this drawer discards changes and does not create a contract, payment, GPS device, collections case, or audit log.</p>
        </section>

        {canSeeInternalEconomics ? (
          <section className={financeStyles.drawerSection}>
            <h3>Partners</h3>
            <div className={financeStyles.detailGridTwo}>
              <DetailField label="Pricing tier" value={`${selectedTier.tierName} - ${selectedTier.aprRange}`} />
              <DetailField label="Financial partner" value={selectedPartner ? `${selectedPartner.partnerName} (${selectedPartner.costRatePct.toFixed(1)}% cost)` : "Not assigned"} />
              <DetailField label="Insurance" value={selectedInsurance ? `${selectedInsurance.insurer} (${selectedInsurance.premiumPct.toFixed(1)}%)` : "Not assigned"} />
              <DetailField label="Bank account" value={selectedAccount?.accountName ?? "-"} />
            </div>
          </section>
        ) : null}

        {canSeeInternalEconomics ? (
          <section className={financeStyles.drawerSection}>
            <h3>Funding split</h3>
            <div className={financeStyles.detailGridTwo}>
              <DetailField label="Bank funded estimate" value={formatMoney(preview.bankFundedAmount)} />
              <DetailField label="EMC funded estimate" value={formatMoney(preview.emcFundedAmount)} />
              <DetailField label="Settlement mode" value={draft.settlementMode} />
              <DetailField label="Closure mode" value={draft.closureMode} />
            </div>
          </section>
        ) : null}

        <section className={financeStyles.drawerSection}>
          <h3>Deal preview</h3>
          <ApplicationDealPreview preview={preview} showMargin={canViewMargin(role)} />
        </section>

        {canSeeInternalEconomics ? (
          <section className={financeStyles.drawerSection}>
            <h3>Contract Conversion Preview</h3>
            <p className={financeStyles.note}>No contract is created in this demo phase. Operational workflows remain inactive until real backend approval is implemented.</p>
            <div className={financeStyles.detailGridTwo}>
              <DetailField label="Preview contract ID" value="KT-PREVIEW" />
              <DetailField label="Client" value={draft.clientFullName} />
              <DetailField label="Vehicle" value={`${draft.vehicleBrand} ${draft.vehicleModel}`} />
              <DetailField label="Sale price" value={formatMoney(preview.vehiclePrice)} />
              <DetailField label="Down payment amount" value={formatMoney(preview.downPayment)} />
              <DetailField label="Down payment %" value={`${draft.downPaymentPct.toFixed(2)}%`} />
              <DetailField label="Financed amount" value={formatMoney(preview.financedAmount)} />
              <DetailField label="APR" value={`${draft.aprPct.toFixed(1)}%`} />
              <DetailField label="Term" value={`${draft.termMonths} months`} />
              <DetailField label="Total monthly payment" value={formatMoney(preview.totalMonthly)} />
              <DetailField label="Pricing tier" value={selectedTier.tierName} />
              <DetailField label="Financial partner" value={selectedPartner?.partnerName ?? "Not assigned"} />
              <DetailField label="Insurance partner" value={selectedInsurance?.insurer ?? "Not assigned"} />
              <DetailField label="Funding split" value={`${formatMoney(preview.bankFundedAmount)} bank / ${formatMoney(preview.emcFundedAmount)} EMC`} />
            </div>

            <div className={financeStyles.conversionSubsection}>
              <h4>Installment Schedule Preview</h4>
              <table className={financeStyles.previewTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due date</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Total payment</th>
                    <th>Remaining balance</th>
                  </tr>
                </thead>
                <tbody>
                  {installmentPreview.map((row) => (
                    <tr key={row.seqNo}>
                      <td>{row.seqNo}</td>
                      <td>{formatPreviewDate(row.dueDate)}</td>
                      <td>{formatMoney(row.principal)}</td>
                      <td>{formatMoney(row.interest)}</td>
                      <td>{formatMoney(row.totalPayment)}</td>
                      <td>{formatMoney(row.remainingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={financeStyles.conversionSubsection}>
              <h4>Operational Attachment Preview</h4>
              <div className={financeStyles.attachmentGrid}>
                <span>GPS device</span>
                <strong>Not assigned</strong>
                <span>Collections case</span>
                <strong>Not created</strong>
                <span>Enforcement status</span>
                <strong>Inactive</strong>
                <span>Vehicle control</span>
                <strong>Disabled until activation</strong>
                <span>Telegram notifications</span>
                <strong>Not triggered</strong>
                <span>Audit</span>
                <strong>Will be written on real approval</strong>
              </div>
            </div>
          </section>
        ) : null}

        <section className={financeStyles.drawerSection}>
          <h3>Internal notes</h3>
          <label className={financeStyles.fullWidthControl}>
            <span>Notes</span>
            <textarea value={draft.notes} onChange={(event) => updateText("notes", event.target.value)} />
          </label>
          <label className={financeStyles.fullWidthControl}>
            <span>Rejected reason</span>
            <textarea value={draft.rejectedReason} onChange={(event) => updateText("rejectedReason", event.target.value)} />
          </label>
        </section>

        <div className={financeStyles.saveBar}>
          <span>{mode === "create" ? "Creates an application record only. No contract or operational workflow is created." : `Last updated ${formatDate(application.createdAt)}`}</span>
          <div>
            {canPrintSummary ? <button className="secondary-button" type="button" onClick={printSummary}>Print Summary</button> : null}
            <button className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="primary-button" onClick={save} disabled={saving || !onSave}>{saving ? "Saving..." : "Save application"}</button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
