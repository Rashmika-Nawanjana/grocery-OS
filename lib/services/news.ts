import type { CrisisAlert } from '@/lib/types';

const CRISIS_KEYWORDS: Record<string, CrisisAlert['type']> = {
  flood: 'flood',
  flooding: 'flood',
  storm: 'storm',
  cyclone: 'storm',
  strike: 'strike',
  protest: 'strike',
  curfew: 'strike',
};

const SRI_LANKA_AREAS = ['Colombo', 'Ratmalana', 'Battaramulla', 'Gampaha', 'Kandy', 'Western Province'];

function detectAreas(text: string): string[] {
  const lower = text.toLowerCase();
  return SRI_LANKA_AREAS.filter((a) => lower.includes(a.toLowerCase()));
}

function crisisTermsFromQuestion(question?: string): string[] {
  if (!question?.trim()) return [];
  const lower = question.toLowerCase();
  const terms = new Set<string>();
  for (const kw of Object.keys(CRISIS_KEYWORDS)) {
    if (lower.includes(kw)) terms.add(kw);
  }
  if (/\bnews\b/i.test(question) && terms.size === 0) {
    terms.add('flood');
    terms.add('storm');
  }
  return [...terms];
}

function buildNewsQueries(location: string, question?: string): string[] {
  const queries: string[] = [];
  const terms = crisisTermsFromQuestion(question);

  if (terms.length) {
    const termClause = terms.join(' OR ');
    queries.push(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(`(${termClause}) AND (${location} OR Sri Lanka)`)}&language=en&sortBy=publishedAt&pageSize=12&apiKey=`
    );
  }

  if (question && question.length > 12 && !terms.length) {
    const topic = question.replace(/[^\w\s]/g, ' ').trim().slice(0, 100);
    queries.push(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(`${topic} Sri Lanka`)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=`
    );
  }

  queries.push(
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(`(flood OR storm OR strike OR cyclone OR warning) AND (${location} OR Sri Lanka)`)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=`
  );
  queries.push(`https://newsapi.org/v2/top-headlines?country=lk&pageSize=10&apiKey=`);

  return queries;
}

function articleMatchesQuestion(
  article: { title: string; description?: string },
  question?: string,
  focusType?: CrisisAlert['type']
): boolean {
  if (!question?.trim() && !focusType) return true;
  const text = `${article.title} ${article.description || ''}`.toLowerCase();
  const terms = crisisTermsFromQuestion(question);
  if (focusType && focusType !== 'none') {
    const focusKeywords = Object.entries(CRISIS_KEYWORDS)
      .filter(([, type]) => type === focusType)
      .map(([kw]) => kw);
    if (focusKeywords.some((kw) => text.includes(kw))) return true;
  }
  if (terms.length) return terms.some((t) => text.includes(t));
  const words = question!
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4 && !['about', 'there', 'check', 'warnings', 'recent'].includes(w));
  return words.some((w) => text.includes(w));
}

function classifyArticles(
  articles: { title: string; description?: string }[],
  question?: string
): Pick<CrisisAlert, 'type' | 'severity' | 'affectedAreas' | 'expectedDurationDays' | 'warningText' | 'shoppingRecommendation'> {
  const focusTerms = crisisTermsFromQuestion(question);
  const focusType = focusTerms.length
    ? CRISIS_KEYWORDS[focusTerms.find((t) => CRISIS_KEYWORDS[t]) || focusTerms[0]] || undefined
    : undefined;

  const relevant = articles.filter((a) => articleMatchesQuestion(a, question, focusType));
  const pool = relevant.length ? relevant : articles;

  let bestType: CrisisAlert['type'] = 'none';
  let severity: CrisisAlert['severity'] = 'none';
  const affectedAreas = new Set<string>();

  for (const article of pool) {
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    for (const [kw, type] of Object.entries(CRISIS_KEYWORDS)) {
      if (text.includes(kw)) {
        if (focusType && type !== focusType) continue;
        bestType = type;
        severity =
          text.includes('severe') || text.includes('warning') || text.includes('emergency') || text.includes('red alert')
            ? 'high'
            : 'medium';
        detectAreas(text).forEach((a) => affectedAreas.add(a));
      }
    }
  }

  if (bestType === 'none') {
    const asked = focusType || (focusTerms[0] ? CRISIS_KEYWORDS[focusTerms[0]] : null);
    const topicLabel = asked && asked !== 'none' ? asked : 'crisis';
    const headlineSample = pool.slice(0, 3).map((a) => a.title).filter(Boolean);
    let warningText = `No active ${topicLabel} alerts in recent Sri Lanka news for your question.`;
    if (headlineSample.length) {
      warningText += ' Recent headlines checked do not mention an ongoing alert.';
    }
    return {
      type: 'none' as const,
      severity: 'none' as const,
      affectedAreas: [],
      expectedDurationDays: 0,
      warningText,
    };
  }

  const uniqueAreas = [...affectedAreas];
  const areas = uniqueAreas.length ? uniqueAreas : ['Colombo', 'Western Province'];

  return {
    type: bestType,
    severity,
    affectedAreas: areas,
    expectedDurationDays: severity === 'high' ? 3 : 1,
    warningText: `Live news reports ${bestType} activity affecting ${areas.join(', ')}. Consider adjusting shopping plans.`,
    shoppingRecommendation: {
      action: severity === 'high' ? 'buy 3 days food now' : 'stock essentials today',
      items: ['rice 2kg', 'dhal 1kg', 'canned food', 'water 6L'],
      urgency: severity === 'high' ? 'immediate' : 'tomorrow',
    },
  };
}

async function fetchNewsApiArticles(location: string, key: string, question?: string): Promise<{ title: string; description?: string }[]> {
  const urls = buildNewsQueries(location, question).map((u) => u + key);
  const seen = new Set<string>();

  for (const url of urls) {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) continue;
    const data = await res.json();
    const articles: { title: string; description?: string }[] = data.articles || [];
    const merged: { title: string; description?: string }[] = [];
    for (const a of articles) {
      if (!a.title || seen.has(a.title)) continue;
      seen.add(a.title);
      merged.push(a);
    }
    if (merged.length) return merged;
  }
  return [];
}

/** Fetch crisis headlines from NewsAPI, optionally scoped to the user's question. */
export async function fetchCrisisNews(location = 'Sri Lanka Colombo', question?: string): Promise<CrisisAlert> {
  const key = process.env.NEWS_API_KEY?.trim();
  const now = new Date().toISOString();

  if (!key) {
    return {
      ...noCrisis('unconfigured'),
      warningText: 'NewsAPI not configured — set NEWS_API_KEY in .env for live crisis headlines.',
      fetchedAt: now,
    };
  }

  try {
    const articles = await fetchNewsApiArticles(location, key, question);
    const headlines = articles.map((a) => a.title).filter(Boolean);

    if (!headlines.length) {
      return {
        ...noCrisis('newsapi'),
        warningText: 'NewsAPI connected but no recent Sri Lanka headlines matched your question.',
        fetchedAt: now,
      };
    }

    const classified = classifyArticles(articles, question);

    return {
      ...classified,
      newsHeadlines: headlines.slice(0, 5),
      source: 'newsapi',
      fetchedAt: now,
    };
  } catch {
    return {
      ...noCrisis('error'),
      warningText: 'Failed to fetch live news — check NEWS_API_KEY and network.',
      fetchedAt: now,
    };
  }
}

function noCrisis(source: CrisisAlert['source'] = 'placeholder'): CrisisAlert {
  return {
    type: 'none',
    severity: 'none',
    affectedAreas: [],
    expectedDurationDays: 0,
    warningText: 'No active crisis alerts detected in live news feeds.',
    source,
  };
}

export function isNewsApiConfigured(): boolean {
  return Boolean(process.env.NEWS_API_KEY?.trim());
}
