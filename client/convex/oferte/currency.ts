export type OfferCurrency = "EUR" | "RON";

// Catalog prices and stored offer totals are always in EUR.
export function euroConversionRate(currency: OfferCurrency, eurToRon: number | null | undefined): number | null {
  if (currency === "EUR") return 1;
  return typeof eurToRon === "number" && Number.isFinite(eurToRon) && eurToRon > 0 ? eurToRon : null;
}

export function convertEuroAmount(amount: number, currency: OfferCurrency, eurToRon: number | null | undefined): number | null {
  const rate = euroConversionRate(currency, eurToRon);
  return rate === null ? null : amount * rate;
}
