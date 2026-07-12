import { readFileSync, existsSync } from 'fs';
import { resolve as resolvePath } from 'path';
import { GoogleAuth } from 'google-auth-library';
import { planError, planLog, planWarn } from '@/lib/plan-logger';

export type ResponseSchema = {
  type: string;
  properties?: Record<string, ResponseSchema>;
  items?: ResponseSchema;
  required?: string[];
  description?: string;
};

let authClient: GoogleAuth | null = null;

export const SchemaType = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
} as const;

function credentialsPath(): string | null {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!raw) return null;
  return raw.startsWith('.') ? resolvePath(process.cwd(), raw) : raw;
}

function projectFromCredentialsFile(): string | null {
  const path = credentialsPath();
  if (!path || !existsSync(path)) return null;
  try {
    const json = JSON.parse(readFileSync(path, 'utf8')) as { project_id?: string };
    return json.project_id?.trim() || null;
  } catch {
    return null;
  }
}

export function getVertexConfig(): { project: string; location: string } | null {
  const project =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.VERTEX_AI_PROJECT?.trim() ||
    projectFromCredentialsFile();
  const location =
    process.env.GOOGLE_CLOUD_LOCATION?.trim() ||
    process.env.VERTEX_AI_LOCATION?.trim() ||
    process.env.GCP_LOCATION?.trim() ||
    'us-central1';
  if (!project) return null;
  return { project, location };
}

export function isVertexConfigured(): boolean {
  return Boolean(getVertexConfig() && (credentialsPath() || process.env.GOOGLE_APPLICATION_CREDENTIALS));
}

/** @deprecated kept for import compatibility */
export function getGemini(): { configured: true } | null {
  return isVertexConfigured() ? { configured: true } : null;
}

/** @deprecated kept for import compatibility */
export function getVertexAI(): { configured: true } | null {
  return getGemini();
}

export function vertexModelName(): string {
  return (
    process.env.VERTEX_GEMINI_MODEL ||
    process.env.GEMINI_MODEL ||
    'gemini-2.5-flash'
  ).trim();
}

async function getAccessToken(): Promise<string | null> {
  if (!authClient) {
    authClient = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  }
  const client = await authClient.getClient();
  const token = await client.getAccessToken();
  return token.token ?? null;
}

function vertexGenerateUrl(project: string, location: string, model: string): string {
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

function isRetryableNetworkError(err: unknown): boolean {
  const code = (err as { code?: string; cause?: { code?: string } })?.code
    || (err as { cause?: { code?: string } })?.cause?.code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'EAI_AGAIN';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function vertexGenerateContent(input: {
  prompt: string;
  systemInstruction: string;
  responseMimeType?: string;
  responseSchema?: ResponseSchema;
  maxOutputTokens?: number;
  image?: { base64: string; mimeType: string };
}): Promise<string> {
  const config = getVertexConfig();
  if (!config) throw new Error('Vertex AI not configured (GOOGLE_CLOUD_PROJECT + GOOGLE_APPLICATION_CREDENTIALS)');

  const token = await getAccessToken();
  if (!token) throw new Error('Failed to obtain Google Cloud access token');

  const model = vertexModelName();
  const url = vertexGenerateUrl(config.project, config.location, model);

  const userParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  if (input.image) {
    userParts.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.base64 } });
  }
  userParts.push({ text: input.prompt });

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: input.systemInstruction }] },
    contents: [{ role: 'user', parts: userParts }],
    generationConfig: {
      maxOutputTokens: input.maxOutputTokens ?? 4096,
      ...(input.responseMimeType ? { responseMimeType: input.responseMimeType } : {}),
      ...(input.responseSchema ? { responseSchema: input.responseSchema } : {}),
    },
  };

  let lastError: unknown;
  const callLabel = input.image
    ? 'gemini:vision-json'
    : input.responseMimeType === 'application/json'
      ? 'gemini:json'
      : 'gemini:text';
  const t0 = Date.now();
  planLog('vertex', `→ ${callLabel} (${input.prompt.length} chars)`);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Vertex AI HTTP ${res.status}: ${text.slice(0, 400)}`);
      }

      const json = JSON.parse(text) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const out =
        json.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .filter(Boolean)
          .join('') ?? '';
      planLog('vertex', `✓ ${callLabel} (${Date.now() - t0}ms, ${out.length} chars)`);
      return out;
    } catch (err) {
      lastError = err;
      if (attempt < 2 && isRetryableNetworkError(err)) {
        planWarn('vertex', `Network error attempt ${attempt + 1}/3 — retrying`, (err as Error).message);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

function stripTrailingCommas(json: string): string {
  return json.replace(/,\s*([\]}])/g, '$1');
}

function parseJsonLoose<T>(text: string): T | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = (fenced?.[1] ?? trimmed).trim();

  const attempts = [
    candidate,
    stripTrailingCommas(candidate),
    candidate.slice(candidate.indexOf('{')),
    stripTrailingCommas(candidate.slice(candidate.indexOf('{'))),
  ].filter((s) => s.startsWith('{'));

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as T;
    } catch {
      /* try salvage */
    }
    const salvaged = salvageTruncatedJson(attempt);
    if (salvaged) return salvaged as T;
  }

  return null;
}

function salvageTruncatedJson(s: string): unknown | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  const body = s.slice(start);

  for (let end = body.length; end > body.length * 0.4; end -= 1) {
    let fragment = body.slice(0, end).trimEnd().replace(/,\s*$/, '');
    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (const ch of fragment) {
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }

    if (inString) fragment += '"';
    while (stack.length) fragment += stack.pop();

    try {
      return JSON.parse(fragment);
    } catch {
      /* keep trimming */
    }
  }

  return null;
}

export async function geminiJson<T>(
  prompt: string,
  systemInstruction: string,
  schema?: ResponseSchema
): Promise<T | null> {
  if (!isVertexConfigured()) return null;

  const compactHint =
    ' Return valid compact JSON only — no markdown, no comments, no trailing commas. Keep arrays short.';

  try {
    const raw = await vertexGenerateContent({
      prompt,
      systemInstruction: systemInstruction + compactHint,
      responseMimeType: 'application/json',
      responseSchema: schema,
    });
    const data = parseJsonLoose<T>(raw);
    if (data) return data;

    if (raw) {
      planWarn('vertex', 'JSON parse failed — retrying once', { rawLength: raw.length });
      const retryRaw = await vertexGenerateContent({
        prompt: `${prompt}\n\nIMPORTANT: Previous response had invalid JSON. Return smaller, valid JSON only.`,
        systemInstruction: systemInstruction + compactHint,
        responseMimeType: 'application/json',
        responseSchema: schema,
      });
      const retryData = parseJsonLoose<T>(retryRaw);
      if (retryData) return retryData;
      if (retryRaw) planError('vertex', 'JSON parse failed after retry', retryRaw.slice(0, 200));
    }

    return null;
  } catch (err) {
    planError('vertex', 'geminiJson failed', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function geminiText(prompt: string, systemInstruction: string): Promise<string | null> {
  if (!isVertexConfigured()) return null;

  try {
    const text = await vertexGenerateContent({ prompt, systemInstruction });
    return text.trim() || null;
  } catch (err) {
    planError('vertex', 'geminiText failed', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function geminiJsonWithImage<T>(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  systemInstruction: string,
  schema?: ResponseSchema
): Promise<T | null> {
  if (!isVertexConfigured()) return null;

  const compactHint =
    ' Return valid compact JSON only — no markdown, no comments, no trailing commas. Keep arrays short.';

  try {
    const raw = await vertexGenerateContent({
      prompt,
      systemInstruction: systemInstruction + compactHint,
      responseMimeType: 'application/json',
      responseSchema: schema,
      image: { base64: imageBase64, mimeType },
    });
    const data = parseJsonLoose<T>(raw);
    if (data) return data;

    if (raw) {
      planWarn('vertex', 'Vision JSON parse failed — retrying once', { rawLength: raw.length });
      const retryRaw = await vertexGenerateContent({
        prompt: `${prompt}\n\nIMPORTANT: Previous response had invalid JSON. Return smaller, valid JSON only.`,
        systemInstruction: systemInstruction + compactHint,
        responseMimeType: 'application/json',
        responseSchema: schema,
        image: { base64: imageBase64, mimeType },
      });
      return parseJsonLoose<T>(retryRaw);
    }

    return null;
  } catch (err) {
    planError('vertex', 'geminiJsonWithImage failed', err instanceof Error ? err.message : err);
    return null;
  }
}

export const intentSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    scenario: { type: SchemaType.STRING, description: 'decided_menu | needs_suggestions | shopping_trip' },
    agentsToRun: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    decidedItems: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    reasoning: { type: SchemaType.STRING },
  },
  required: ['scenario', 'agentsToRun', 'reasoning'],
};

export async function vertexEmbedText(text: string, outputDimensionality = 768): Promise<number[] | null> {
  const config = getVertexConfig();
  if (!config || !text.trim()) return null;

  const model = (
    process.env.VERTEX_EMBEDDING_MODEL ||
    process.env.GEMINI_EMBEDDING_MODEL ||
    'text-embedding-005'
  ).trim();

  try {
    const token = await getAccessToken();
    if (!token) return null;

    const url = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.project}/locations/${config.location}/publishers/google/models/${model}:predict`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ content: text }],
        parameters: { outputDimensionality, autoTruncate: true },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('Vertex embedding error:', res.status, errBody.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as {
      predictions?: Array<{ embeddings?: { values?: number[] }; values?: number[] }>;
    };
    const prediction = data.predictions?.[0];
    return prediction?.embeddings?.values ?? prediction?.values ?? null;
  } catch (err) {
    console.error('Vertex embedding error:', err);
    return null;
  }
}
