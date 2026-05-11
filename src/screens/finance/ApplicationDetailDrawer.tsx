import { useMemo, useState } from "react";
import Drawer from "../../components/Drawer";
import type { Role } from "../../entities/types";
import { formatDate } from "../../lib/formatDate";
import { formatMoney } from "../../lib/formatMoney";
import { useAuth } from "../../store/auth";
import ApplicationDealPreview from "./ApplicationDealPreview";
import { calculateDealPreview, generateInstallmentSchedulePreview } from "./applicationDealMath";
import type { FinanceApplication } from "./applicationReferenceData";
import { applicationStageLabels } from "./applicationReferenceData";
import { bankAccounts, financialPartners, insurancePartners, pricingTiers } from "./financeReferenceData";
import { DetailField, financeStyles } from "./FinanceReferenceShared";

type Draft = {
  vehiclePriceDollars: number;
  downPaymentDollars: number;
  downPaymentPct: number;
  termMonths: number;
  aprPct: number;
  pricingTierId: string;
  financialPartnerId: string;
  insurancePartnerId: string;
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
  return role === "ADMIN" || role === "CEO" || role === "FINANCIAL_CONTROLLER";
}

function formatPreviewDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function toDraft(application: FinanceApplication): Draft {
  const vehiclePriceDollars = Math.round(application.vehiclePrice / 100);
  const downPaymentPct = clamp(application.downPaymentPct, 0, 100);
  return {
    vehiclePriceDollars,
    downPaymentDollars: amountFromPct(vehiclePriceDollars, downPaymentPct),
    downPaymentPct,
    termMonths: application.termMonths,
    aprPct: application.aprPct,
    pricingTierId: application.pricingTierId,
    financialPartnerId: application.financialPartnerId,
    insurancePartnerId: application.insurancePartnerId
  };
}

export default function ApplicationDetailDrawer({ application, onClose }: { application: FinanceApplication; onClose: () => void }) {
  const role = useAuth((state) => state.user?.role);
  const [draft, setDraft] = useState<Draft>(() => toDraft(application));
  const selectedTier = pricingTiers.find((tier) => tier.id === draft.pricingTierId) ?? pricingTiers[0];
  const selectedPartner = financialPartners.find((partner) => partner.id === draft.financialPartnerId) ?? financialPartners[0];
  const selectedInsurance = insurancePartners.find((partner) => partner.id === draft.insurancePartnerId) ?? insurancePartners[0];
  const selectedAccount = bankAccounts.find((account) => account.id === application.bankAccountId);

  const vehiclePrice = Math.max(0, Math.round(draft.vehiclePriceDollars * 100));
  const fundingShare = selectedPartner.fundingType === "Self-funded" ? 0 : application.bankFundingSharePct;
  const preview = useMemo(
    () =>
      calculateDealPreview({
        vehiclePrice,
        vehicleCost: application.vehicleCost,
        downPaymentAmount: Math.round(draft.downPaymentDollars * 100),
        downPaymentPct: draft.downPaymentPct,
        termMonths: draft.termMonths,
        aprPct: draft.aprPct,
        gpsFeeGross: selectedTier.gpsFee,
        gpsCostGsm: 700,
        insurancePct: selectedInsurance.premiumPct,
        insuranceCommissionPct: selectedInsurance.commissionPct,
        bankCostRatePct: selectedPartner.costRatePct,
        bankFundingSharePct: fundingShare
      }),
    [application.vehicleCost, draft.aprPct, draft.downPaymentPct, draft.termMonths, fundingShare, selectedInsurance.commissionPct, selectedInsurance.premiumPct, selectedPartner.costRatePct, selectedTier.gpsFee, vehiclePrice]
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

  return (
    <Drawer title={`${application.id} - ${application.clientFullName}`} onClose={onClose}>
      <div className={financeStyles.drawerStack}>
        <section className={financeStyles.drawerSection}>
          <h3>Client</h3>
          <div className={financeStyles.detailGridTwo}>
            <DetailField label="Client" value={application.clientFullName} />
            <DetailField label="Phone" value={application.clientPhone} />
            <DetailField label="National ID" value={application.clientNationalId} />
            <DetailField label="Address" value={application.clientAddress} />
          </div>
        </section>

        <section className={financeStyles.drawerSection}>
          <h3>Vehicle</h3>
          <div className={financeStyles.detailGridTwo}>
            <DetailField label="Vehicle" value={`${application.vehicleYear} ${application.vehicleBrand} ${application.vehicleModel}`} />
            <DetailField label="Catalog reference" value={application.vehicleCatalogId} />
            <DetailField label="Current stage" value={applicationStageLabels[application.stage]} />
            <DetailField label="Created" value={formatDate(application.createdAt)} />
          </div>
        </section>

        <section className={financeStyles.drawerSection}>
          <h3>Terms</h3>
          <div className={financeStyles.controlGrid}>
            <label>
              <span>Vehicle price</span>
              <input type="number" min="0" value={draft.vehiclePriceDollars} onChange={(event) => updateVehiclePrice(event.target.value)} />
            </label>
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
            <label>
              <span>Financial partner</span>
              <select value={draft.financialPartnerId} onChange={(event) => setDraft((current) => ({ ...current, financialPartnerId: event.target.value }))}>
                {financialPartners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.partnerName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Insurance partner</span>
              <select value={draft.insurancePartnerId} onChange={(event) => setDraft((current) => ({ ...current, insurancePartnerId: event.target.value }))}>
                {insurancePartners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.insurer}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={financeStyles.note}>Simulation only. Closing this drawer discards changes and does not create a contract, payment, GPS device, collections case, or audit log.</p>
        </section>

        <section className={financeStyles.drawerSection}>
          <h3>Partners</h3>
          <div className={financeStyles.detailGridTwo}>
            <DetailField label="Pricing tier" value={`${selectedTier.tierName} - ${selectedTier.aprRange}`} />
            <DetailField label="Financial partner" value={`${selectedPartner.partnerName} (${selectedPartner.costRatePct.toFixed(1)}% cost)`} />
            <DetailField label="Insurance" value={`${selectedInsurance.insurer} (${selectedInsurance.premiumPct.toFixed(1)}%)`} />
            <DetailField label="Bank account" value={selectedAccount?.accountName ?? "-"} />
          </div>
        </section>

        <section className={financeStyles.drawerSection}>
          <h3>Funding split</h3>
          <div className={financeStyles.detailGridTwo}>
            <DetailField label="Bank funded estimate" value={formatMoney(preview.bankFundedAmount)} />
            <DetailField label="EMC funded estimate" value={formatMoney(preview.emcFundedAmount)} />
            <DetailField label="Settlement mode" value={application.settlementMode} />
            <DetailField label="Closure mode" value={application.closureMode} />
          </div>
        </section>

        <section className={financeStyles.drawerSection}>
          <h3>Deal preview</h3>
          <ApplicationDealPreview preview={preview} showMargin={canViewMargin(role)} />
        </section>

        <section className={financeStyles.drawerSection}>
          <h3>Contract Conversion Preview</h3>
          <p className={financeStyles.note}>No contract is created in this demo phase. Operational workflows remain inactive until real backend approval is implemented.</p>
          <div className={financeStyles.detailGridTwo}>
            <DetailField label="Preview contract ID" value="KT-PREVIEW" />
            <DetailField label="Client" value={application.clientFullName} />
            <DetailField label="Vehicle" value={`${application.vehicleBrand} ${application.vehicleModel}`} />
            <DetailField label="Sale price" value={formatMoney(preview.vehiclePrice)} />
            <DetailField label="Down payment amount" value={formatMoney(preview.downPayment)} />
            <DetailField label="Down payment %" value={`${draft.downPaymentPct.toFixed(2)}%`} />
            <DetailField label="Financed amount" value={formatMoney(preview.financedAmount)} />
            <DetailField label="APR" value={`${draft.aprPct.toFixed(1)}%`} />
            <DetailField label="Term" value={`${draft.termMonths} months`} />
            <DetailField label="Total monthly payment" value={formatMoney(preview.totalMonthly)} />
            <DetailField label="Pricing tier" value={selectedTier.tierName} />
            <DetailField label="Financial partner" value={selectedPartner.partnerName} />
            <DetailField label="Insurance partner" value={selectedInsurance.insurer} />
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

        <section className={financeStyles.drawerSection}>
          <h3>Internal notes</h3>
          <p className={financeStyles.note}>{application.blockedReason ? `${application.blockedReason}. ${application.notes}` : application.notes}</p>
        </section>

        <section className={financeStyles.drawerSection}>
          <h3>Decision Placeholder</h3>
          <div className={financeStyles.disabledActionRow}>
            <button disabled>Approve application - future</button>
            <button disabled>Reject application - future</button>
            <button disabled>Request more docs - future</button>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
