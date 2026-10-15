export const SALE_PRICE_MULTIPLIER = 1.25;

export function salePrice(material: { pretAchizitie: number; pretVanzare: number }) {
  return material.pretVanzare === 0
    ? material.pretAchizitie * SALE_PRICE_MULTIPLIER
    : material.pretVanzare;
}
