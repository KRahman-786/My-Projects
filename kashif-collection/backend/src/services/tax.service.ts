/**
 * Centralised GST calculation. Every tax figure in the system (cart, checkout, order, invoice)
 * is produced here so that changing tax rules only touches this module.
 */

export interface TaxableLine {
  /** Net amount of the line in paise after all discounts */
  amount: number;
  /** GST rate in percent */
  rate: number;
}

/**
 * Tax contained in (inclusive) or added on top of (exclusive) an amount.
 * Indian retail prices (MRP) are GST-inclusive, which is the default store setting.
 */
export function lineTax(amount: number, rate: number, inclusive: boolean): number {
  if (amount <= 0 || rate <= 0) return 0;
  return inclusive ? Math.round((amount * rate) / (100 + rate)) : Math.round((amount * rate) / 100);
}

export interface TaxBreakdownRow {
  rate: number;
  taxableValue: number;
  tax: number;
}

export interface TaxSummary {
  taxTotal: number;
  breakdown: TaxBreakdownRow[];
  cgst: number;
  sgst: number;
  igst: number;
  /** true → intra-state supply (CGST + SGST), false → inter-state (IGST) */
  intraState: boolean;
}

/** Splits GST into CGST+SGST for intra-state supply, IGST otherwise. */
export function splitGst(taxTotal: number, destinationState: string | undefined, businessState: string) {
  const intraState = !destinationState || destinationState.trim().toLowerCase() === businessState.trim().toLowerCase();
  if (!intraState) return { cgst: 0, sgst: 0, igst: taxTotal, intraState };
  const cgst = Math.floor(taxTotal / 2);
  return { cgst, sgst: taxTotal - cgst, igst: 0, intraState };
}

export function summarizeTax(
  lines: Array<TaxableLine & { tax: number }>,
  inclusive: boolean,
  destinationState: string | undefined,
  businessState: string,
): TaxSummary {
  const byRate = new Map<number, TaxBreakdownRow>();
  let taxTotal = 0;
  for (const l of lines) {
    const row = byRate.get(l.rate) ?? { rate: l.rate, taxableValue: 0, tax: 0 };
    row.taxableValue += inclusive ? l.amount - l.tax : l.amount;
    row.tax += l.tax;
    byRate.set(l.rate, row);
    taxTotal += l.tax;
  }
  return {
    taxTotal,
    breakdown: [...byRate.values()].sort((a, b) => a.rate - b.rate),
    ...splitGst(taxTotal, destinationState, businessState),
  };
}
