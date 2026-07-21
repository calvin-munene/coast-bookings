import { money, type Money } from "@/modules/shared/money";

export type PayoutInput = Readonly<{
  accommodationAndExtrasMinor: bigint;
  hostCommissionMinor: bigint;
  hostTaxWithholdingMinor: bigint;
  refundsChargedToHostMinor: bigint;
  adjustmentsMinor: bigint;
}>;

export type PayoutCalculation = Readonly<{ netPayout: Money; eligibleAt: Date; requiresManualApproval: true }>;

export function calculatePayout(input: PayoutInput, checkedInAt: Date): PayoutCalculation {
  const net = input.accommodationAndExtrasMinor - input.hostCommissionMinor - input.hostTaxWithholdingMinor
    - input.refundsChargedToHostMinor + input.adjustmentsMinor;
  if (net < 0n) throw new Error("Payout calculation cannot create a negative payment; record the balance separately");
  return { netPayout: money(net), eligibleAt: new Date(checkedInAt.getTime() + 24 * 60 * 60 * 1000), requiresManualApproval: true };
}
