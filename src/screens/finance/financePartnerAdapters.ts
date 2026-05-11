import type { FinancialPartnerRecord, InsurancePartnerRecord } from "../../services/api";
import type { FinancialPartner, InsurancePartner, TrafficTone } from "./financeReferenceData";

function statusTraffic(active: boolean, rate: number): TrafficTone {
  if (!active) return "slate";
  if (rate >= 14) return "amber";
  return "green";
}

export function toFinancialPartnerOption(record: FinancialPartnerRecord): FinancialPartner {
  const active = record.status === "ACTIVE";
  return {
    id: record.id,
    partnerName: record.name,
    fundingType: record.funding_type,
    costRatePct: record.cost_rate_pct,
    activeContractsCount: record.active_contracts_count,
    active,
    traffic: statusTraffic(active, record.cost_rate_pct),
    notes: record.notes
  };
}

export function toInsurancePartnerOption(record: InsurancePartnerRecord): InsurancePartner {
  const active = record.status === "ACTIVE";
  return {
    id: record.id,
    insurer: record.name,
    premiumPct: record.premium_pct,
    commissionPct: record.commission_pct,
    settlementTiming: record.settlement_timing,
    active,
    traffic: statusTraffic(active, record.premium_pct),
    notes: record.notes
  };
}
