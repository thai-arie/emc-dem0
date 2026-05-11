export interface DealInput {
  vehiclePrice: number;
  vehicleCost: number;
  downPaymentAmount?: number;
  downPaymentPct: number;
  termMonths: number;
  aprPct: number;
  gpsFeeGross: number;
  gpsCostGsm: number;
  insurancePct: number;
  insuranceCommissionPct: number;
  bankCostRatePct: number;
  bankFundingSharePct: number;
}

export interface DealPreview {
  vehiclePrice: number;
  vehicleCost: number;
  gpsFeeGross: number;
  bankCostRatePct: number;
  downPayment: number;
  financedAmount: number;
  basePi: number;
  insuranceMonthly: number;
  totalMonthly: number;
  dealerMargin: number;
  bankFundedAmount: number;
  emcFundedAmount: number;
  bankPi: number;
  interestSpread: number;
  gpsNet: number;
  insuranceCommission: number;
  emcRetainedMonthly: number;
  lifetimeEmcGrossProfit: number;
}

export interface InstallmentPreviewRow {
  seqNo: number;
  dueDate: string;
  principal: number;
  interest: number;
  totalPayment: number;
  remainingBalance: number;
}

export function annuityPayment(principal: number, annualRatePct: number, termMonths: number) {
  if (principal <= 0 || termMonths <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate <= 0) return Math.round(principal / termMonths);
  const growth = Math.pow(1 + monthlyRate, termMonths);
  return Math.round((principal * monthlyRate * growth) / (growth - 1));
}

function addMonths(value: string, months: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

export function generateInstallmentSchedulePreview(input: { startDate: string; financedAmount: number; annualRatePct: number; termMonths: number; totalMonthlyPayment: number; basePi: number; limit?: number }): InstallmentPreviewRow[] {
  const rows: InstallmentPreviewRow[] = [];
  const monthlyRate = input.annualRatePct / 100 / 12;
  let balance = input.financedAmount;
  const count = Math.min(input.limit ?? 6, input.termMonths);

  for (let index = 1; index <= count; index += 1) {
    const interest = Math.round(balance * monthlyRate);
    const principal = Math.min(balance, Math.max(0, input.basePi - interest));
    balance = Math.max(0, balance - principal);
    rows.push({
      seqNo: index,
      dueDate: addMonths(input.startDate, index),
      principal,
      interest,
      totalPayment: input.totalMonthlyPayment,
      remainingBalance: balance
    });
  }

  return rows;
}

export function calculateDealPreview(input: DealInput): DealPreview {
  const calculatedDownPayment = Math.round(input.vehiclePrice * (input.downPaymentPct / 100));
  const downPayment = Math.min(Math.max(input.downPaymentAmount ?? calculatedDownPayment, 0), input.vehiclePrice);
  const financedAmount = Math.max(0, input.vehiclePrice - downPayment);
  const basePi = annuityPayment(financedAmount, input.aprPct, input.termMonths);
  const insuranceMonthly = Math.round((input.vehiclePrice * (input.insurancePct / 100)) / 12);
  const totalMonthly = basePi + input.gpsFeeGross + insuranceMonthly;
  const dealerMargin = input.vehiclePrice - input.vehicleCost;
  const bankFundedAmount = Math.round(financedAmount * (Math.min(Math.max(input.bankFundingSharePct, 0), 100) / 100));
  const emcFundedAmount = Math.max(0, financedAmount - bankFundedAmount);
  const bankPi = annuityPayment(bankFundedAmount, input.bankCostRatePct, input.termMonths);
  const interestSpread = basePi - bankPi;
  const gpsNet = input.gpsFeeGross - input.gpsCostGsm;
  const insuranceCommission = Math.round(insuranceMonthly * (input.insuranceCommissionPct / 100));
  const emcRetainedMonthly = interestSpread + gpsNet + insuranceCommission;
  const lifetimeEmcGrossProfit = dealerMargin + emcRetainedMonthly * input.termMonths;

  return {
    vehiclePrice: input.vehiclePrice,
    vehicleCost: input.vehicleCost,
    gpsFeeGross: input.gpsFeeGross,
    bankCostRatePct: input.bankCostRatePct,
    downPayment,
    financedAmount,
    basePi,
    insuranceMonthly,
    totalMonthly,
    dealerMargin,
    bankFundedAmount,
    emcFundedAmount,
    bankPi,
    interestSpread,
    gpsNet,
    insuranceCommission,
    emcRetainedMonthly,
    lifetimeEmcGrossProfit
  };
}
