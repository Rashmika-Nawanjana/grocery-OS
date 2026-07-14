import { NextResponse } from 'next/server';
import { runOrchestration } from '@/lib/orchestrator';
import { createClient } from '@/lib/supabase/server';
import { getInventoryForQuery, getFamily } from '@/lib/supabase/data';
import { getUserMemory, saveUserMemory } from '@/lib/supabase/memory';
import { extractMemoryFromResult } from '@/lib/memory/extract';
import type { OrchestrationRequest, OrchestrationResult } from '@/lib/types';
import type { UserMemory } from '@/lib/memory/types';
import { planError, planLog, planTimed } from '@/lib/plan-logger';

function toSnapshot(memory: UserMemory) {
  return {
    defaultBudgetLkr: memory.defaultBudgetLkr,
    preferredStores: memory.preferredStores,
    homeArea: memory.homeArea,
    entries: memory.entries,
  };
}

async function prepareRequest(body: OrchestrationRequest, reqId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let memoryForRequest: UserMemory | null = null;

  if (user) {
    const [inventory, family, serverMemory] = await Promise.all([
      getInventoryForQuery(user.id, body.prompt),
      body.family?.length ? Promise.resolve(body.family) : getFamily(user.id),
      getUserMemory(user.id),
    ]);
    body.inventory = inventory;
    body.family = family;
    body.userId = user.id;
    memoryForRequest = serverMemory;
    body.memory = body.memory ?? toSnapshot(serverMemory);
    planLog('api/plan', `Loaded user data — inventory: ${inventory.length}, family: ${family.length}`);
  } else if (body.memory) {
    memoryForRequest = {
      ...body.memory,
      updatedAt: new Date().toISOString(),
    } as UserMemory;
  }

  return { body, user, memoryForRequest };
}

async function finalizeResult(
  body: OrchestrationRequest,
  result: OrchestrationResult,
  user: { id: string } | null,
  memoryForRequest: UserMemory | null
): Promise<OrchestrationResult> {
  if (memoryForRequest) {
    const updated = extractMemoryFromResult(memoryForRequest, body.prompt, result, {
      clarificationContext: body.clarificationContext,
      mealComponents: result.mealComponents,
    });
    if (user) {
      await saveUserMemory(user.id, updated);
    }
    result.updatedMemory = toSnapshot(updated);
  }
  return result;
}

export async function POST(request: Request) {
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    const body = (await request.json()) as OrchestrationRequest & { stream?: boolean };
    const url = new URL(request.url);
    const wantsStream = body.stream === true || url.searchParams.get('stream') === '1';

    planLog('api/plan', `━━━ Request ${reqId} ━━━`, {
      prompt: body.prompt.slice(0, 120),
      followUp: body.isFollowUp ?? false,
      budgetLkr: body.budgetLkr,
      stream: wantsStream,
    });

    const { body: preparedBody, user, memoryForRequest } = await prepareRequest(body, reqId);

    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (payload: unknown) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          };

          try {
            const result = await runOrchestration(preparedBody, reqId, (event) => {
              send(event);
            });
            await finalizeResult(preparedBody, result, user, memoryForRequest);
            planLog('api/plan', `━━━ Done ${reqId} (stream) ━━━`, {
              scenario: result.scenario,
              agents: result.agentsRun,
            });
            send({ type: 'result', result });
          } catch (error) {
            planError('api/plan', `Stream ${reqId} failed`, error instanceof Error ? error.message : error);
            send({ type: 'error', error: 'Orchestration failed' });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    const result = await planTimed('api/plan', `orchestration ${reqId}`, () => runOrchestration(preparedBody, reqId));
    await finalizeResult(preparedBody, result, user, memoryForRequest);

    planLog('api/plan', `━━━ Done ${reqId} ━━━`, {
      scenario: result.scenario,
      agents: result.agentsRun,
      recipes: result.data.recipes.length,
      shoppingItems: result.data.shoppingList.length,
      totalLkr: result.data.totalBudgetSpent,
      livePrices: result.prices.filter((p) => p.sourceType === 'store_crawl' || p.sourceType === 'pola_wholesale').length,
    });

    return NextResponse.json(result);
  } catch (error) {
    planError('api/plan', `Request ${reqId} failed`, error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Orchestration failed' }, { status: 500 });
  }
}
