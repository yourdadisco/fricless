/**
 * Token Budget — Claude Code 的 tokenBudget.ts 移植
 *
 * BudgetTracker + checkTokenBudget:
 * 控制对话循环何时继续、何时停止。
 */
export interface BudgetTracker {
  continuationCount: number;
  lastDeltaTokens: number;
  lastGlobalTurnTokens: number;
  startedAt: number;
}

export function createBudgetTracker(): BudgetTracker {
  return {
    continuationCount: 0,
    lastDeltaTokens: 0,
    lastGlobalTurnTokens: 0,
    startedAt: Date.now(),
  };
}

const COMPLETION_THRESHOLD = 0.9;
const DIMINISHING_THRESHOLD = 500;

export type TokenBudgetDecision =
  | { action: 'continue'; nudgeMessage: string; continuationCount: number }
  | { action: 'stop' };

/**
 * 检查 token 预算 — 对应 Claude Code 的 checkTokenBudget
 *
 * 决定:
 * - continue: 预算内，继续对话
 * - stop: 预算耗尽或收益递减（连续3次增量 < 500 token）
 */
export function checkTokenBudget(
  tracker: BudgetTracker,
  turnTokens: number,
  budget?: number,
): TokenBudgetDecision {
  // 如果超出预算 90%，停止
  if (budget && turnTokens > budget * COMPLETION_THRESHOLD) {
    return { action: 'stop' };
  }

  // 收益递减检测: 连续3次增量 < 500 token
  if (tracker.continuationCount >= 3 && tracker.lastDeltaTokens < DIMINISHING_THRESHOLD) {
    return { action: 'stop' };
  }

  // 在预算内 → 继续
  tracker.continuationCount++;
  tracker.lastDeltaTokens = turnTokens;

  return {
    action: 'continue',
    nudgeMessage: '继续。',
    continuationCount: tracker.continuationCount,
  };
}
