import { NextResponse } from 'next/server';
import { runMiroFishSimulation } from '@/lib/agents/mirofish-simulator';
import type { MiroFishSimulationRequest } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MiroFishSimulationRequest;
    const result = await runMiroFishSimulation(body);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('MiroFish simulation error:', error);
    return NextResponse.json(
      { success: false, error: 'MiroFish simulation failed' },
      { status: 500 }
    );
  }
}
