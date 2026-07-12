import type {
  AgentExecutionLog,
  CrisisAlert,
  DataSource,
  LocalBusiness,
  MealPlanResponse,
  StorePrice,
  TrafficCondition,
  UserScenario,
  WeatherCondition,
} from '@/lib/types';

/** One user prompt + orchestrator run — agent output is saved per turn. */
export interface QueryTurn {
  id: string;
  userText: string;
  assistantText: string;
  isFollowUp: boolean;
  createdAt: string;
  status: 'pending' | 'complete' | 'error';
  agentLogs: AgentExecutionLog[];
  mealsResult: MealPlanResponse | null;
  weather: WeatherCondition;
  traffic: TrafficCondition;
  crisis: CrisisAlert;
  prices: StorePrice[];
  scenario: UserScenario | null;
  sources: DataSource[];
  localBusinesses?: LocalBusiness[];
  placesQuery?: string;
}

export interface QuerySession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  budgetLkr: number;
  /** Latest scenario — used for follow-up orchestration. */
  scenario: UserScenario | null;
  turns: QueryTurn[];
  /** Which turn's agent data is shown in agent tabs. */
  activeTurnId: string | null;
}

const STORAGE_KEY = 'plango_query_sessions';

export const EMPTY_WEATHER: WeatherCondition = {
  condition: 'humid',
  temperature: 28,
  rainMm: 0,
  spoilageModifier: 0.85,
  source: 'placeholder',
};
export const EMPTY_TRAFFIC: TrafficCondition = { route: 'Awaiting orchestrator...', status: 'clear', estimatedTimeMin: 0, fuelAdjustedCostLkr: 0 };
export const EMPTY_CRISIS: CrisisAlert = {
  type: 'none',
  severity: 'none',
  affectedAreas: [],
  expectedDurationDays: 0,
  warningText: '',
  source: 'placeholder',
};

export function createEmptyTurn(userText = '', isFollowUp = false): QueryTurn {
  return {
    id: crypto.randomUUID(),
    userText,
    assistantText: '',
    isFollowUp,
    createdAt: new Date().toISOString(),
    status: 'pending',
    agentLogs: [],
    mealsResult: null,
    weather: EMPTY_WEATHER,
    traffic: EMPTY_TRAFFIC,
    crisis: EMPTY_CRISIS,
    prices: [],
    scenario: null,
    sources: [],
  };
}

export function createEmptySession(budgetLkr = 5000): QuerySession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'New query',
    createdAt: now,
    updatedAt: now,
    budgetLkr,
    scenario: null,
    turns: [],
    activeTurnId: null,
  };
}

export function getActiveTurn(session: QuerySession): QueryTurn | null {
  if (session.activeTurnId) {
    return session.turns.find((t) => t.id === session.activeTurnId) ?? null;
  }
  const completed = session.turns.filter((t) => t.status === 'complete');
  return completed[completed.length - 1] ?? null;
}

export function turnAgentSnapshot(turn: QueryTurn) {
  return {
    mealsResult: turn.mealsResult,
    prices: turn.prices,
    weather: turn.weather,
    traffic: turn.traffic,
    crisis: turn.crisis,
    agentLogs: turn.agentLogs,
    scenario: turn.scenario,
  };
}

/** Migrate legacy sessions (flat messages + session-level agent data). */
function migrateSession(raw: Record<string, unknown>): QuerySession {
  if (Array.isArray(raw.turns)) {
    const session = raw as unknown as QuerySession;
    return {
      ...session,
      turns: session.turns.map((t) => ({ ...t, sources: t.sources ?? [] })),
    };
  }

  const legacy = raw as {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    budgetLkr: number;
    scenario: UserScenario | null;
    messages?: { id: string; role: string; text: string; isFollowUp: boolean; timestamp: string }[];
    agentLogs?: AgentExecutionLog[];
    mealsResult?: MealPlanResponse | null;
    weather?: WeatherCondition;
    traffic?: TrafficCondition;
    crisis?: CrisisAlert;
    prices?: StorePrice[];
  };

  const turns: QueryTurn[] = [];
  const msgs = legacy.messages ?? [];

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    if (msg.role !== 'user') continue;
    const next = msgs[i + 1];
    const assistant = next?.role === 'assistant' ? next : null;
    const isLastPair = !msgs.slice(i + 2).some((m) => m.role === 'user');

    turns.push({
      id: msg.id,
      userText: msg.text,
      assistantText: assistant?.text ?? '',
      isFollowUp: msg.isFollowUp,
      createdAt: msg.timestamp,
      status: assistant ? 'complete' : 'pending',
      agentLogs: isLastPair ? (legacy.agentLogs ?? []) : [],
      mealsResult: isLastPair ? (legacy.mealsResult ?? null) : null,
      weather: isLastPair ? (legacy.weather ?? EMPTY_WEATHER) : EMPTY_WEATHER,
      traffic: isLastPair ? (legacy.traffic ?? EMPTY_TRAFFIC) : EMPTY_TRAFFIC,
      crisis: isLastPair ? (legacy.crisis ?? EMPTY_CRISIS) : EMPTY_CRISIS,
      prices: isLastPair ? (legacy.prices ?? []) : [],
      scenario: isLastPair ? (legacy.scenario ?? null) : null,
      sources: [],
    });
    if (assistant) i++;
  }

  const lastComplete = [...turns].reverse().find((t) => t.status === 'complete');

  return {
    id: legacy.id,
    title: legacy.title,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    budgetLkr: legacy.budgetLkr ?? 5000,
    scenario: legacy.scenario ?? lastComplete?.scenario ?? null,
    turns,
    activeTurnId: lastComplete?.id ?? null,
  };
}

export function loadSessions(userKey: string): QuerySession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return parsed.map(migrateSession);
  } catch {
    return [];
  }
}

export function saveSessions(userKey: string, sessions: QuerySession[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${STORAGE_KEY}:${userKey}`, JSON.stringify(sessions));
}

export function sessionTitleFromPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= 42) return trimmed || 'New query';
  return trimmed.slice(0, 42) + '…';
}

export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Session with no messages yet — like an unsent ChatGPT draft. */
export function isSessionEmpty(session: QuerySession): boolean {
  return session.turns.length === 0;
}

export function sortSessionsByRecent(sessions: QuerySession[]): QuerySession[] {
  return [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Only sessions that have at least one prompt. */
export function getPastSessions(sessions: QuerySession[]): QuerySession[] {
  return sortSessionsByRecent(sessions.filter((s) => !isSessionEmpty(s)));
}
