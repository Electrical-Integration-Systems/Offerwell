import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";

const schema: CollectionCreateSchema = {
    name: 'materiale',
    fields: [
        {name: 'descriere', type: 'string'},
        {name: 'pretAchizitie', type: 'float'},
        {name: 'pretVanzare', type: 'float'},
        {name: 'manopera', type: 'float'},
        {
            name: 'embedding',
            type: 'float[]',
            num_dim: 768,
            embed: {
                from: ['descriere'],
                model_config: {
                    model_name: 'openai/nomic-embed-text:latest',
                    api_key: '',
                    url: 'http://ollama:11434'
                }
            }
        }
    ],
};

export default schema;
