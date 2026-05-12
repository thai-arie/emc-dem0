export type ApplicationStage = "DRAFT" | "DOCS_PENDING" | "BANK_REVIEW" | "READY_TO_SIGN" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ApplicationSignal = "READY" | "WATCH" | "BLOCKED" | "APPROVED" | "REJECTED";

export interface FinanceApplication {
  id: string;
  clientFullName: string;
  clientPhone: string;
  clientNationalId: string;
  clientAddress: string;
  vehicleCatalogId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  vehiclePrice: number;
  vehicleCost: number;
  downPaymentAmount?: number;
  downPaymentPct: number;
  termMonths: number;
  aprPct: number;
  pricingTierId: string;
  financialPartnerId: string;
  insurancePartnerId: string;
  bankAccountId: string;
  bankFundingSharePct: number;
  bankFundedAmount?: number;
  emcFundedAmount?: number;
  settlementMode: "partner_pass_through" | "emc_buffer" | "self_funded";
  closureMode: "standard_signing" | "dealer_close" | "bank_close";
  startDate: string;
  notes: string;
  stage: ApplicationStage;
  createdAt: string;
  rejectedReason?: string;
  convertedContractId?: string | null;
  convertedAt?: string | null;
  blockedReason?: string;
}

export const applicationStageLabels: Record<ApplicationStage, string> = {
  DRAFT: "Draft",
  DOCS_PENDING: "Docs pending",
  BANK_REVIEW: "Bank review",
  READY_TO_SIGN: "Ready to sign",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled"
};

export const applicationPipeline: FinanceApplication[] = [
  {
    id: "APP-2101",
    clientFullName: "Sok Dara",
    clientPhone: "+855 12 210 101",
    clientNationalId: "KH-ID-2101",
    clientAddress: "Chamkar Mon, Phnom Penh",
    vehicleCatalogId: "v1",
    vehicleBrand: "PAIDI",
    vehicleModel: "KT11EV",
    vehicleYear: 2026,
    vehiclePrice: 860000,
    vehicleCost: 645000,
    downPaymentPct: 20,
    termMonths: 36,
    aprPct: 18,
    pricingTierId: "basic",
    financialPartnerId: "fp_icare",
    insurancePartnerId: "ip_cb",
    bankAccountId: "ba_icare",
    bankFundingSharePct: 85,
    settlementMode: "partner_pass_through",
    closureMode: "standard_signing",
    startDate: "2026-06-01",
    notes: "Income documents received. Waiting for final employer confirmation.",
    stage: "BANK_REVIEW",
    createdAt: "2026-05-04T03:20:00.000Z"
  },
  {
    id: "APP-2102",
    clientFullName: "Chan Monika",
    clientPhone: "+855 16 210 102",
    clientNationalId: "KH-ID-2102",
    clientAddress: "Toul Kork, Phnom Penh",
    vehicleCatalogId: "v3",
    vehicleBrand: "Chery",
    vehicleModel: "Arrizo 5",
    vehicleYear: 2026,
    vehiclePrice: 1456000,
    vehicleCost: 1100000,
    downPaymentPct: 25,
    termMonths: 42,
    aprPct: 17.5,
    pricingTierId: "basic",
    financialPartnerId: "fp_acleda",
    insurancePartnerId: "ip_asia",
    bankAccountId: "ba_acleda",
    bankFundingSharePct: 90,
    settlementMode: "partner_pass_through",
    closureMode: "bank_close",
    startDate: "2026-06-05",
    notes: "Bank review passed. Signing package can be prepared after vehicle inspection.",
    stage: "READY_TO_SIGN",
    createdAt: "2026-05-02T05:45:00.000Z"
  },
  {
    id: "APP-2103",
    clientFullName: "Vannak Logistics Co.",
    clientPhone: "+855 89 210 103",
    clientNationalId: "BUS-2103",
    clientAddress: "Sen Sok, Phnom Penh",
    vehicleCatalogId: "v8",
    vehicleBrand: "Gecko",
    vehicleModel: "EV Truck 1T",
    vehicleYear: 2026,
    vehiclePrice: 1650000,
    vehicleCost: 1250000,
    downPaymentPct: 35,
    termMonths: 30,
    aprPct: 23,
    pricingTierId: "risky",
    financialPartnerId: "fp_wemoney",
    insurancePartnerId: "ip_forte",
    bankAccountId: "ba_buffer",
    bankFundingSharePct: 70,
    settlementMode: "emc_buffer",
    closureMode: "dealer_close",
    startDate: "2026-06-10",
    notes: "Commercial use case. Risk tier requires bank committee review.",
    stage: "BANK_REVIEW",
    createdAt: "2026-05-06T02:10:00.000Z"
  },
  {
    id: "APP-2104",
    clientFullName: "Nita Phan",
    clientPhone: "+855 15 210 104",
    clientNationalId: "KH-ID-2104",
    clientAddress: "Daun Penh, Phnom Penh",
    vehicleCatalogId: "v5",
    vehicleBrand: "BYD",
    vehicleModel: "Atto 3",
    vehicleYear: 2026,
    vehiclePrice: 3250000,
    vehicleCost: 2700000,
    downPaymentPct: 30,
    termMonths: 48,
    aprPct: 15,
    pricingTierId: "premium",
    financialPartnerId: "fp_acleda",
    insurancePartnerId: "ip_asia",
    bankAccountId: "ba_acleda",
    bankFundingSharePct: 95,
    settlementMode: "partner_pass_through",
    closureMode: "bank_close",
    startDate: "2026-06-15",
    notes: "Prime borrower profile. Approved for premium pricing reference.",
    stage: "APPROVED",
    createdAt: "2026-04-29T08:35:00.000Z"
  },
  {
    id: "APP-2105",
    clientFullName: "Rithy Sok",
    clientPhone: "+855 11 210 105",
    clientNationalId: "KH-ID-2105",
    clientAddress: "Chroy Changvar, Phnom Penh",
    vehicleCatalogId: "v2",
    vehicleBrand: "PAIDI",
    vehicleModel: "KT11EV Cargo",
    vehicleYear: 2026,
    vehiclePrice: 920000,
    vehicleCost: 690000,
    downPaymentPct: 22,
    termMonths: 36,
    aprPct: 18.5,
    pricingTierId: "basic",
    financialPartnerId: "fp_icare",
    insurancePartnerId: "ip_cb",
    bankAccountId: "ba_icare",
    bankFundingSharePct: 82,
    settlementMode: "partner_pass_through",
    closureMode: "standard_signing",
    startDate: "2026-06-08",
    notes: "Missing proof of address. Intake should not progress until document gap closes.",
    stage: "DOCS_PENDING",
    createdAt: "2026-05-08T04:15:00.000Z",
    blockedReason: "Proof of address missing"
  },
  {
    id: "APP-2106",
    clientFullName: "Malis Theng",
    clientPhone: "+855 10 210 106",
    clientNationalId: "KH-ID-2106",
    clientAddress: "Mean Chey, Phnom Penh",
    vehicleCatalogId: "v7",
    vehicleBrand: "Leapmotor",
    vehicleModel: "T03",
    vehicleYear: 2026,
    vehiclePrice: 1240000,
    vehicleCost: 930000,
    downPaymentPct: 18,
    termMonths: 36,
    aprPct: 19,
    pricingTierId: "basic",
    financialPartnerId: "fp_icare",
    insurancePartnerId: "ip_cb",
    bankAccountId: "ba_icare",
    bankFundingSharePct: 80,
    settlementMode: "partner_pass_through",
    closureMode: "standard_signing",
    startDate: "2026-06-12",
    notes: "Docs package open. Waiting for income verification and guarantor contact.",
    stage: "DOCS_PENDING",
    createdAt: "2026-05-07T06:05:00.000Z"
  },
  {
    id: "APP-2107",
    clientFullName: "Borey Kim",
    clientPhone: "+855 77 210 107",
    clientNationalId: "KH-ID-2107",
    clientAddress: "Russey Keo, Phnom Penh",
    vehicleCatalogId: "v6",
    vehicleBrand: "Wuling",
    vehicleModel: "Mini EV",
    vehicleYear: 2026,
    vehiclePrice: 980000,
    vehicleCost: 735000,
    downPaymentPct: 15,
    termMonths: 36,
    aprPct: 24,
    pricingTierId: "risky",
    financialPartnerId: "fp_wemoney",
    insurancePartnerId: "ip_forte",
    bankAccountId: "ba_buffer",
    bankFundingSharePct: 60,
    settlementMode: "emc_buffer",
    closureMode: "dealer_close",
    startDate: "2026-05-20",
    notes: "Rejected reference case. Income volatility and inactive stock unit.",
    stage: "REJECTED",
    createdAt: "2026-04-25T07:25:00.000Z"
  }
];
