import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { type Material } from "./types";
import { action } from "./_generated/server";
import { v } from "convex/values";

const client = new TypeSafeClient();

/**
 * Update an existing material in the 'materiale' collection.
 * @param material Materialul pentru care se decide pret.
 * @param referinte Referintele materiale pentru alegerea pretului.
 * @returns Rezultatul laya.
 */
export const alegePret = async (
  material: string,
  referinte: Material[]
) => {
  const options = Object.fromEntries(
    referinte.map((ref) => [
      ref.descriere,
      `pretAchizitie=${ref.pretAchizitie}, pretVanzare=${ref.pretVanzare}, manopera=${ref.manopera}`,
    ])
  );

  return await client.systemOne({
    state: {
      material,
    },
    questions: {
      price: choice(
        `Materialul pentru care trebuie aleasă referința este: "${material}".
  
        Alege referința care corespunde cel mai bine acestui material.
        Compară denumirea materialului și caracteristicile tehnice.
        Nu lua în considerare prețul pentru a decide care material este similar.`,
        options
      ),
    },
  });
};

export const testLaya = action({
    args: {
        material: v.string(),
        referinte: v.array(v.object({
            descriere: v.string(),
            pretAchizitie: v.number(),
            pretVanzare: v.number(),
            manopera: v.number(),
        })),
    },
    handler: async (ctx, args) => {
        return await alegePret(args.material, args.referinte);
    },
});
