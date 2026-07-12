import { SchemaType, type ResponseSchema } from '@/lib/services/gemini';

export const mirofishResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    answer: {
      type: SchemaType.STRING,
      description:
        'Plain-text answer: 3-4 bullet lines starting with "- ", then Firstly/Secondly/Finally paragraphs, ending with Recommendation:',
    },
    confidenceSignals: {
      type: SchemaType.ARRAY,
      description: '3-5 scenario metrics with 90% confidence intervals',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          metric: { type: SchemaType.STRING, description: 'Short metric label' },
          value: { type: SchemaType.NUMBER, description: 'Point estimate' },
          ciLower: { type: SchemaType.NUMBER, description: '90% CI lower bound' },
          ciUpper: { type: SchemaType.NUMBER, description: '90% CI upper bound' },
          unit: { type: SchemaType.STRING, description: 'Unit e.g. %, LKR, LKR/kg, days, min' },
          interpretation: { type: SchemaType.STRING, description: 'One sentence explaining the signal' },
        },
        required: ['metric', 'value', 'ciLower', 'ciUpper', 'unit', 'interpretation'],
      },
    },
  },
  required: ['answer', 'confidenceSignals'],
};

export interface GeminiMiroFishResponse {
  answer: string;
  confidenceSignals: Array<{
    metric: string;
    value: number;
    ciLower: number;
    ciUpper: number;
    unit: string;
    interpretation: string;
  }>;
}
