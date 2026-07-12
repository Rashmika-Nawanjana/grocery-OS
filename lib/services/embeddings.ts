import { vertexEmbedText } from '@/lib/services/gemini';

const EMBEDDING_DIM = 768;

/** Local fallback when Vertex embeddings are unavailable. */
function localEmbed(text: string, dim = EMBEDDING_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);

  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) {
      h = (Math.imul(31, h) + token.charCodeAt(i)) >>> 0;
    }
    vec[h % dim] += 1;
    vec[(h >>> 8) % dim] += 0.5;
  }

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function embedText(text: string): Promise<number[] | null> {
  if (!text.trim()) return null;

  const vertex = await vertexEmbedText(text, EMBEDDING_DIM);
  if (vertex?.length) return vertex;

  return localEmbed(text);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
