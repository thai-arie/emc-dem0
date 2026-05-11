export type TrafficTone = "green" | "amber" | "red" | "blue" | "slate";

export interface VehicleCatalogItem {
  id: string;
  brand: string;
  model: string;
  variant?: string;
  year: number;
  defaultSalePrice: number;
  defaultVehicleCost: number;
  category: string;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  stockCount: number;
  active: boolean;
  traffic: TrafficTone;
  notes: string;
}

export interface PricingTier {
  id: string;
  tierName: string;
  aprRange: string;
  riskFeePct: number;
  gpsFee: number;
  insuranceDefaultPct: number;
  fundingMode: string;
  active: boolean;
  traffic: TrafficTone;
  notes: string;
}

export interface FinancialPartner {
  id: string;
  partnerName: string;
  fundingType: string;
  costRatePct: number;
  activeContractsCount: number;
  active: boolean;
  traffic: TrafficTone;
  notes: string;
}

export interface InsurancePartner {
  id: string;
  insurer: string;
  premiumPct: number;
  commissionPct: number;
  settlementTiming: string;
  active: boolean;
  traffic: TrafficTone;
  notes: string;
}

export interface BankAccount {
  id: string;
  accountName: string;
  partnerLink: string;
  currency: string;
  settlementRole: string;
  active: boolean;
  traffic: TrafficTone;
  notes: string;
}

export const vehicleCatalog: VehicleCatalogItem[] = [
  { id: "v1", brand: "PAIDI", model: "KT11EV", year: 2026, defaultSalePrice: 860000, defaultVehicleCost: 645000, category: "Commercial EV", stockStatus: "IN_STOCK", stockCount: 8, active: true, traffic: "green", notes: "Core mass-market financed asset." },
  { id: "v2", brand: "PAIDI", model: "KT11EV Cargo", year: 2026, defaultSalePrice: 920000, defaultVehicleCost: 690000, category: "Cargo EV", stockStatus: "LOW_STOCK", stockCount: 2, active: true, traffic: "amber", notes: "Useful for fleet and recovery-friendly contracts." },
  { id: "v3", brand: "Chery", model: "Arrizo 5", year: 2026, defaultSalePrice: 1456000, defaultVehicleCost: 1100000, category: "Passenger EV", stockStatus: "IN_STOCK", stockCount: 5, active: true, traffic: "green", notes: "Legacy demo pricing reference." },
  { id: "v4", brand: "Chery", model: "Tiggo 4 Pro", year: 2026, defaultSalePrice: 1890000, defaultVehicleCost: 1450000, category: "SUV", stockStatus: "LOW_STOCK", stockCount: 1, active: true, traffic: "amber", notes: "Higher ticket size, watch partner exposure." },
  { id: "v5", brand: "BYD", model: "Atto 3", year: 2026, defaultSalePrice: 3250000, defaultVehicleCost: 2700000, category: "Passenger EV", stockStatus: "IN_STOCK", stockCount: 3, active: true, traffic: "green", notes: "Premium borrower profile reference." },
  { id: "v6", brand: "Wuling", model: "Mini EV", year: 2026, defaultSalePrice: 980000, defaultVehicleCost: 735000, category: "Micro EV", stockStatus: "OUT_OF_STOCK", stockCount: 0, active: false, traffic: "slate", notes: "Inactive until inventory refresh." },
  { id: "v7", brand: "Leapmotor", model: "T03", year: 2026, defaultSalePrice: 1240000, defaultVehicleCost: 930000, category: "Passenger EV", stockStatus: "IN_STOCK", stockCount: 4, active: true, traffic: "green", notes: "Standard finance reference unit." },
  { id: "v8", brand: "Gecko", model: "EV Truck 1T", year: 2026, defaultSalePrice: 1650000, defaultVehicleCost: 1250000, category: "Commercial Truck", stockStatus: "LOW_STOCK", stockCount: 1, active: true, traffic: "amber", notes: "Commercial risk tier review recommended." }
];

export const pricingTiers: PricingTier[] = [
  { id: "premium", tierName: "Premium", aprRange: "14% - 16%", riskFeePct: 0, gpsFee: 3300, insuranceDefaultPct: 2.5, fundingMode: "Bank prime", active: true, traffic: "green", notes: "Lowest rate, best client profile, longer term tolerance." },
  { id: "basic", tierName: "Basic", aprRange: "17% - 19%", riskFeePct: 0, gpsFee: 3300, insuranceDefaultPct: 2.9, fundingMode: "Bank standard", active: true, traffic: "green", notes: "Default mass-market finance profile from legacy app." },
  { id: "risky", tierName: "Risky", aprRange: "22% - 24%", riskFeePct: 0, gpsFee: 3300, insuranceDefaultPct: 3.2, fundingMode: "Bank or hybrid", active: true, traffic: "amber", notes: "Higher APR, higher down payment, shorter exposure window." },
  { id: "self-funded", tierName: "Self-funded", aprRange: "18% - 22%", riskFeePct: 0, gpsFee: 3300, insuranceDefaultPct: 2.9, fundingMode: "EMC capital", active: false, traffic: "slate", notes: "Reference only until capital policy is approved." }
];

export const financialPartners: FinancialPartner[] = [
  { id: "fp_icare", partnerName: "iCare Leasing Plc", fundingType: "Bank partner", costRatePct: 12, activeContractsCount: 18, active: true, traffic: "green", notes: "NBC licensed primary partner in the legacy reference." },
  { id: "fp_acleda", partnerName: "ACLEDA Bank", fundingType: "Bank", costRatePct: 11, activeContractsCount: 12, active: true, traffic: "green", notes: "Prime client funding reference." },
  { id: "fp_wemoney", partnerName: "WE.MONEY MFI", fundingType: "MFI", costRatePct: 14, activeContractsCount: 7, active: true, traffic: "amber", notes: "Sub-prime tier reference; watch cost spread." },
  { id: "fp-emc-self", partnerName: "EMC Self-Funded", fundingType: "Self-funded", costRatePct: 0, activeContractsCount: 4, active: true, traffic: "blue", notes: "Own capital, no external bank repayment." },
  { id: "fp_chailease", partnerName: "Chailease Royal", fundingType: "Bank partner", costRatePct: 12.5, activeContractsCount: 0, active: false, traffic: "slate", notes: "Inactive reference partner." }
];

export const insurancePartners: InsurancePartner[] = [
  { id: "ip_cb", insurer: "CB General Insurance", premiumPct: 2.9, commissionPct: 12, settlementTiming: "Monthly pass-through", active: true, traffic: "green", notes: "Primary insurance reference." },
  { id: "ip_forte", insurer: "Forte Insurance", premiumPct: 3.2, commissionPct: 10, settlementTiming: "Monthly pass-through", active: true, traffic: "green", notes: "Higher premium, lower commission." },
  { id: "ip_asia", insurer: "Asia Insurance Cambodia", premiumPct: 2.5, commissionPct: 15, settlementTiming: "Monthly pass-through", active: true, traffic: "amber", notes: "Aggressive premium, strong commission reference." },
  { id: "ip_manual", insurer: "Manual policy override", premiumPct: 0, commissionPct: 0, settlementTiming: "Per contract", active: false, traffic: "slate", notes: "Placeholder for negotiated policies." }
];

export const bankAccounts: BankAccount[] = [
  { id: "ba_default", accountName: "ABA Bank - Primary Receiving", partnerLink: "General EMC receiving", currency: "USD", settlementRole: "Client collections", active: true, traffic: "green", notes: "Legacy default receiving account." },
  { id: "ba_acleda", accountName: "ACLEDA - Partner Settlement", partnerLink: "ACLEDA Bank", currency: "USD", settlementRole: "Bank pass-through", active: true, traffic: "green", notes: "Dedicated settlement account reference." },
  { id: "ba_icare", accountName: "iCare Settlement Account", partnerLink: "iCare Leasing Plc", currency: "USD", settlementRole: "Bank pass-through", active: true, traffic: "green", notes: "Used for partner-linked settlement mode." },
  { id: "ba_buffer", accountName: "EMC Buffer Account", partnerLink: "Internal", currency: "USD", settlementRole: "Buffer servicing", active: true, traffic: "amber", notes: "For contracts where EMC settles bank manually." },
  { id: "ba_old", accountName: "Legacy Intake Account", partnerLink: "Legacy", currency: "USD", settlementRole: "Archived", active: false, traffic: "slate", notes: "Readonly inactive account." }
];
