export type Material = {
  id?: string;
  descriere: string;
  pretAchizitie: number;
  pretVanzare: number;
  manopera: number;
};

export type MaterialExtras = {
      sheetName?: string;
      rand: number;
      descriere: string;
      cantitate: number;
      unitate: string;
    };

export type MaterialHit = Material;
