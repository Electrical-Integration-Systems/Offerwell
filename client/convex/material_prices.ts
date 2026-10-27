export const SALE_PRICE_MULTIPLIER = 1.25;

export function validSalePriceMultiplier(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function salePrice(material: { pretAchizitie: number; pretVanzare: number; salePriceMultiplier?: number }) {
  if (material.salePriceMultiplier !== undefined) return material.pretAchizitie * material.salePriceMultiplier;
  return material.pretVanzare === 0
    ? material.pretAchizitie * SALE_PRICE_MULTIPLIER
    : material.pretVanzare;
}
