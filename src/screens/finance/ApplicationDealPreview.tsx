import { formatMoney } from "../../lib/formatMoney";
import type { DealPreview } from "./applicationDealMath";
import { financeStyles } from "./FinanceReferenceShared";

function PreviewItem({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={emphasis ? financeStyles.previewItemEmphasis : financeStyles.previewItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ApplicationDealPreview({ preview, showMargin }: { preview: DealPreview; showMargin: boolean }) {
  return (
    <div className={financeStyles.previewGrid}>
      <section className={financeStyles.previewPanel}>
        <h3>Client-facing preview</h3>
        <PreviewItem label="Down payment" value={formatMoney(preview.downPayment)} />
        <PreviewItem label="Financed amount" value={formatMoney(preview.financedAmount)} />
        <PreviewItem label="Base P&I" value={formatMoney(preview.basePi)} />
        <PreviewItem label="GPS fee" value={formatMoney(preview.gpsFeeGross)} />
        <PreviewItem label="Insurance" value={formatMoney(preview.insuranceMonthly)} />
        <PreviewItem label="Total monthly payment" value={formatMoney(preview.totalMonthly)} emphasis />
      </section>
      {showMargin ? (
        <section className={financeStyles.previewPanel}>
          <h3>Margin-restricted preview</h3>
          <PreviewItem label="Vehicle cost" value={formatMoney(preview.vehicleCost)} />
          <PreviewItem label="Dealer margin" value={formatMoney(preview.dealerMargin)} />
          <PreviewItem label="Bank cost rate" value={`${preview.bankCostRatePct.toFixed(1)}%`} />
          <PreviewItem label="Bank funded" value={formatMoney(preview.bankFundedAmount)} />
          <PreviewItem label="EMC funded" value={formatMoney(preview.emcFundedAmount)} />
          <PreviewItem label="Bank P&I" value={formatMoney(preview.bankPi)} />
          <PreviewItem label="Interest spread" value={formatMoney(preview.interestSpread)} />
          <PreviewItem label="GPS net" value={formatMoney(preview.gpsNet)} />
          <PreviewItem label="Insurance commission" value={formatMoney(preview.insuranceCommission)} />
          <PreviewItem label="EMC retained / month" value={formatMoney(preview.emcRetainedMonthly)} emphasis />
          <PreviewItem label="Lifetime EMC gross profit" value={formatMoney(preview.lifetimeEmcGrossProfit)} emphasis />
        </section>
      ) : null}
    </div>
  );
}
