export interface AdvancedDebtValues {
  creditLimit?: string;
  apr?: string;
  monthlyFees?: string;
  yearlyFees?: string;
  lateFees?: string;
  idealPayment?: string;
}

interface AdvancedDebtDetailsProps {
  values: AdvancedDebtValues;
  onChange: (values: AdvancedDebtValues) => void;
  defaultOpen?: boolean;
}

export function AdvancedDebtDetails(_props: AdvancedDebtDetailsProps) {
  return null;
}

export function calculateDebtMetrics(bill: {
  totalBalance?: number;
  creditLimit?: number;
  apr?: number;
  monthlyFees?: number;
  yearlyFees?: number;
}) {
  const {
    totalBalance = 0,
    creditLimit,
    apr,
    monthlyFees = 0,
    yearlyFees = 0,
  } = bill;

  const utilization =
    creditLimit && creditLimit > 0 ? (totalBalance / creditLimit) * 100 : null;

  const monthlyInterest =
    apr && totalBalance > 0 ? (apr / 100 / 12) * totalBalance : null;

  const trueMonthlyCost =
    (monthlyInterest ?? 0) + monthlyFees + yearlyFees / 12;

  return {
    utilization,
    monthlyInterest,
    trueMonthlyCost: trueMonthlyCost > 0 ? trueMonthlyCost : null,
  };
}
