/** Server-side terminal logging for orchestration pipeline visibility. Set PLAN_LOG=false to disable. */

const PREFIX = 'PlanGro';

function enabled(): boolean {
  return process.env.PLAN_LOG !== 'false';
}

function stamp(): string {
  return new Date().toISOString().slice(11, 23);
}

function fmt(scope: string, message: string): string {
  return `[${PREFIX}] ${stamp()} [${scope}] ${message}`;
}

export function planLog(scope: string, message: string, detail?: unknown): void {
  if (!enabled()) return;
  if (detail !== undefined) console.log(fmt(scope, message), detail);
  else console.log(fmt(scope, message));
}

export function planWarn(scope: string, message: string, detail?: unknown): void {
  if (!enabled()) return;
  if (detail !== undefined) console.warn(fmt(scope, message), detail);
  else console.warn(fmt(scope, message));
}

export function planError(scope: string, message: string, detail?: unknown): void {
  if (!enabled()) return;
  if (detail !== undefined) console.error(fmt(scope, message), detail);
  else console.error(fmt(scope, message));
}

export async function planTimed<T>(scope: string, label: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled()) return fn();
  const start = Date.now();
  planLog(scope, `→ ${label}`);
  try {
    const result = await fn();
    planLog(scope, `✓ ${label} (${Date.now() - start}ms)`);
    return result;
  } catch (err) {
    planError(scope, `✗ ${label} failed (${Date.now() - start}ms)`, err instanceof Error ? err.message : err);
    throw err;
  }
}

export function planSyncTimed<T>(scope: string, label: string, fn: () => T): T {
  if (!enabled()) return fn();
  const start = Date.now();
  planLog(scope, `→ ${label}`);
  try {
    const result = fn();
    planLog(scope, `✓ ${label} (${Date.now() - start}ms)`);
    return result;
  } catch (err) {
    planError(scope, `✗ ${label} failed (${Date.now() - start}ms)`, err instanceof Error ? err.message : err);
    throw err;
  }
}

export function planAgentLog(
  agentId: string,
  status: 'start' | 'success' | 'warn' | 'skip' | 'fail',
  message: string,
  detail?: unknown
): void {
  const icons = { start: '▶', success: '✓', warn: '⚠', skip: '○', fail: '✗' };
  const fn = status === 'fail' ? planError : status === 'warn' ? planWarn : planLog;
  fn(`agent:${agentId}`, `${icons[status]} ${message}`, detail);
}
