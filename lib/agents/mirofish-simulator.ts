import { geminiJson } from '@/lib/services/gemini';
import { seedMiroFishFromPrompt, checkMiroFishHealth } from '@/lib/services/mirofish-client';
import { localMiroFishAnswer } from '@/lib/mirofish/local-fallback';
import { localMiroFishConfidenceSignals } from '@/lib/mirofish/confidence-fallback';
import { mirofishResponseSchema, type GeminiMiroFishResponse } from '@/lib/mirofish/schema';
import type {
  MiroFishConfidenceSignal,
  MiroFishSimulationRequest,
  MiroFishSimulationResult,
  MiroFishWorkflowStep,
} from '@/lib/types';
import type { MiroFishSeedResult } from '@/lib/services/mirofish-client';

const MIROFISH_SYSTEM = `You are MiroFish, an AI scenario prediction assistant inside the plango family grocery app.

Follow the MiroFish workflow: seed → knowledge graph → agent simulation → prediction report.

Help users rehearse decisions — food, fish, shopping, pricing, logistics, family meals, or any everyday scenario.

Always respond in clear plain English. Be practical and specific to Sri Lankan context when relevant.
Never refuse a question. Give a direct recommendation with trade-offs when useful.

For the "answer" field, format exactly like this:
1) Executive summary as 3–4 bullet points, each on its own line starting with "- " (one key takeaway per line, not a paragraph).
2) Then 2–4 action paragraphs each starting with Firstly, Secondly, Thirdly, or Finally.
3) End with a line starting with "Recommendation:" — one clear actionable sentence.
Use **bold** sparingly for key terms only. No markdown headers.

For "confidenceSignals", return 3–5 metrics directly relevant to the user's question.
Each metric needs a realistic point estimate (value) and 90% confidence interval (ciLower, ciUpper).
Use appropriate units: %, LKR, LKR/kg, days, or min. Ensure ciLower < value < ciUpper.`;

const WORKFLOW_STEPS: MiroFishWorkflowStep[] = [
  { phase: 'seed', label: 'Seed Material', message: 'Ingesting your question as scenario seed.' },
  { phase: 'graph', label: 'Knowledge Graph', message: 'Mapping actors, incentives, and relationships.' },
  { phase: 'simulation', label: 'Agent Simulation', message: 'Exploring how the scenario could unfold.' },
  { phase: 'report', label: 'Prediction Report', message: 'Synthesizing a clear recommendation.' },
];

const LIVE_SEED_TIMEOUT_MS = 5000;

function emptyErrorResult(error: string): MiroFishSimulationResult {
  return {
    success: false,
    answer: '',
    promptInterpretation: '',
    workflowSteps: [],
    simulationSteps: [],
    error,
  };
}

function buildWorkflowSteps(liveSeed?: MiroFishSeedResult | null): MiroFishWorkflowStep[] {
  return WORKFLOW_STEPS.map((step) => {
    if (step.phase === 'graph' && liveSeed?.entityTypes.length) {
      return {
        ...step,
        message: `Mapped ${liveSeed.entityTypes.length} actors: ${liveSeed.entityTypes.slice(0, 5).join(', ')}${liveSeed.entityTypes.length > 5 ? '…' : ''}`,
      };
    }
    return step;
  });
}

function buildInterpretation(prompt: string, liveSeed?: MiroFishSeedResult | null): string {
  if (liveSeed?.entityTypes.length) {
    return `Analyzing "${prompt}" — mapped ${liveSeed.entityTypes.length} actor types (${liveSeed.entityTypes.slice(0, 6).join(', ')}${liveSeed.entityTypes.length > 6 ? ', …' : ''}) and ${liveSeed.edgeTypes.length} relationship types.`;
  }
  return `Scenario prediction for: ${prompt}`;
}

async function fetchLiveSeedWithTimeout(prompt: string): Promise<MiroFishSeedResult | null> {
  if (!(await checkMiroFishHealth())) return null;

  return Promise.race([
    seedMiroFishFromPrompt(prompt).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LIVE_SEED_TIMEOUT_MS)),
  ]);
}

function normalizeSignals(raw: GeminiMiroFishResponse['confidenceSignals']): MiroFishConfidenceSignal[] {
  return raw
    .filter(
      (s) =>
        s.metric &&
        typeof s.value === 'number' &&
        typeof s.ciLower === 'number' &&
        typeof s.ciUpper === 'number' &&
        s.ciLower < s.ciUpper
    )
    .slice(0, 5)
    .map((s) => ({
      metric: s.metric,
      value: s.value,
      ciLower: Math.min(s.ciLower, s.value),
      ciUpper: Math.max(s.ciUpper, s.value),
      unit: s.unit || '',
      interpretation: s.interpretation || '',
    }));
}

export async function runMiroFishSimulation(req: MiroFishSimulationRequest): Promise<MiroFishSimulationResult> {
  const prompt = req.prompt?.trim();
  if (!prompt) return emptyErrorResult('Please enter a question.');

  const [aiResult, liveSeed] = await Promise.all([
    geminiJson<GeminiMiroFishResponse>(`User question: "${prompt}"`, MIROFISH_SYSTEM, mirofishResponseSchema),
    fetchLiveSeedWithTimeout(prompt),
  ]);

  const workflowSteps = buildWorkflowSteps(liveSeed);
  const promptInterpretation = buildInterpretation(prompt, liveSeed);
  const simulationSteps = workflowSteps.map((s) => `${s.label}: ${s.message}`);

  if (!aiResult?.answer) {
    return {
      success: true,
      answer: localMiroFishAnswer(prompt, liveSeed),
      promptInterpretation,
      workflowSteps,
      simulationSteps,
      confidenceSignals: localMiroFishConfidenceSignals(prompt),
      source: 'local',
      warning: 'Using offline fallback — Vertex AI call failed. Restart the dev server after updating .env or check server logs.',
    };
  }

  const confidenceSignals = normalizeSignals(aiResult.confidenceSignals ?? []);
  const signals =
    confidenceSignals.length > 0 ? confidenceSignals : localMiroFishConfidenceSignals(prompt);

  return {
    success: true,
    answer: aiResult.answer,
    promptInterpretation,
    workflowSteps,
    simulationSteps,
    confidenceSignals: signals,
    source: liveSeed ? 'live' : 'gemini',
  };
}
