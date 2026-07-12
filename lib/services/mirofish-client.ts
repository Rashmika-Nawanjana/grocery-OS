const DEFAULT_BASE_URL = 'http://168.144.36.78:5001';

export function getMiroFishBaseUrl(): string {
  const url = process.env.MIROFISH_LIVE_BASE_URL?.trim();
  return (url || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export interface MiroFishSeedResult {
  projectId: string;
  analysisSummary: string;
  entityTypes: string[];
  edgeTypes: string[];
}

export async function checkMiroFishHealth(baseUrl?: string): Promise<boolean> {
  const base = baseUrl || getMiroFishBaseUrl();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const json = (await res.json()) as { status?: string };
    return json.status === 'ok';
  } catch {
    return false;
  }
}

/** Step 1 — Seed Material: upload prompt as text seed (seafood scenarios only) */
export async function seedMiroFishFromPrompt(
  prompt: string,
  baseUrl?: string
): Promise<MiroFishSeedResult | null> {
  const base = baseUrl || getMiroFishBaseUrl();
  if (!base) return null;

  const seedText = [
    'Scenario seed:',
    '',
    prompt,
  ].join('\n');

  const form = new FormData();
  form.append('simulation_requirement', prompt);
  form.append('project_name', `plango-${Date.now()}`);
  form.append('additional_context', prompt);
  form.append('files', new Blob([seedText], { type: 'text/plain' }), 'scenario.txt');

  const res = await fetch(`${base}/api/graph/ontology/generate`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) return null;

  const json = (await res.json()) as {
    success?: boolean;
    data?: {
      project_id: string;
      analysis_summary?: string;
      ontology?: {
        entity_types?: { name: string }[];
        edge_types?: { name: string }[];
      };
    };
  };

  if (!json.success || !json.data?.project_id) return null;

  return {
    projectId: json.data.project_id,
    analysisSummary: json.data.analysis_summary || '',
    entityTypes: (json.data.ontology?.entity_types || []).map((e) => e.name),
    edgeTypes: (json.data.ontology?.edge_types || []).map((e) => e.name),
  };
}
