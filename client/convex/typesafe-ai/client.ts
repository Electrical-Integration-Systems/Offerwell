import { choice, TypeSafeClient, Questions, EntryType } from "@typesafe-ai/sdk";

const client = new TypeSafeClient();

export const chooseMaterial = async (state: EntryType, materiale: any) => {
    const questions: Questions = {
        ...materiale.reduce((acc: any, material: any) => {
            acc[`material_${material}`] = choice(`What is the best match for ${material}?`, {
                option1: null,
                option2: null,
                option3: null,
            });
            return acc;
        }, {})
    }
    
    return client.systemOne({
        state: state,
        questions: questions
    });
};
