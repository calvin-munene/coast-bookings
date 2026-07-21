import { money, percentage, type Money } from "@/modules/shared/money";

export type RefundInput = Readonly<{
  accommodationPaidMinor: bigint;
  serviceFeePaidMinor: bigint;
  providerChargesMinor: bigint;
  refundableAccommodationBasisPoints: number;
  serviceFeeRefundable: boolean;
  guestPenaltyMinor: bigint;
  manualAdjustmentMinor: bigint;
}>;

export type RefundResult = Readonly<{
  refundableAccommodation: Money;
  refundableServiceFee: Money;
  providerChargesRetained: Money;
  guestPenalty: Money;
  manualAdjustmentMinor: bigint;
  finalRefund: Money;
}>;

export function calculateRefund(input: RefundInput): RefundResult {
  const refundableAccommodation = percentage(money(input.accommodationPaidMinor), input.refundableAccommodationBasisPoints);
  const refundableServiceFee = money(input.serviceFeeRefundable ? input.serviceFeePaidMinor : 0n);
  const beforeAdjustment = refundableAccommodation.amountMinor + refundableServiceFee.amountMinor
    - input.providerChargesMinor - input.guestPenaltyMinor + input.manualAdjustmentMinor;
  const maximumPaid = input.accommodationPaidMinor + input.serviceFeePaidMinor;
  const finalMinor = beforeAdjustment < 0n ? 0n : beforeAdjustment > maximumPaid ? maximumPaid : beforeAdjustment;
  return {
    refundableAccommodation,
    refundableServiceFee,
    providerChargesRetained: money(input.providerChargesMinor),
    guestPenalty: money(input.guestPenaltyMinor),
    manualAdjustmentMinor: input.manualAdjustmentMinor,
    finalRefund: money(finalMinor),
  };
}
