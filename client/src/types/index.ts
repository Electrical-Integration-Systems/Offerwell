export type Material = {
  id?: string;
  descriere: string;
  pretAchizitie: number;
  pretVanzare: number;
  manopera: number;
};

export type MaterialHit = Material & {
  matchedWords?: string[];
};
