/** All monetary amounts in the system are integer paise. */
export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => paise / 100;

export function formatINR(paise: number): string {
  return `Rs. ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function discountPercent(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
