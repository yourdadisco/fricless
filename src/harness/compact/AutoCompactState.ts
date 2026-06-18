/**
 * Auto-Compact — Claude Code 的 autoCompact 常量和状态
 *
 * 直接复制自 Claude Code 源码:
 * - src/services/compact/autoCompact.ts (常量)
 * - src/utils/context.ts (上下文窗口)
 */

// ── 常量 (直接复制自 Claude Code) ─────────────────────────

/** 自动压缩触发的缓冲区 token */
export const AUTOCOMPACT_BUFFER_TOKENS = 13_000;

/** 警告阈值缓冲区 */
export const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000;

/** 错误阈值缓冲区 */
export const ERROR_THRESHOLD_BUFFER_TOKENS = 20_000;

/** 手动压缩缓冲区 */
export const MANUAL_COMPACT_BUFFER_TOKENS = 3_000;

/** 连续自动压缩失败上限 — 熔断器 */
export const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3;

/** 压缩后最多恢复的文件数 */
export const POST_COMPACT_MAX_FILES_TO_RESTORE = 5;

/** 压缩后 token 预算 */
export const POST_COMPACT_TOKEN_BUDGET = 50_000;

/** 每个文件最大 token */
export const POST_COMPACT_MAX_TOKENS_PER_FILE = 5_000;

// ── AutoCompactTrackingState (直接复制自 Claude Code) ──

export interface AutoCompactTrackingState {
  compacted: boolean;
  turnCounter: number;
  turnId: string;
  consecutiveFailures?: number;
}

export function createAutoCompactTrackingState(): AutoCompactTrackingState {
  return {
    compacted: false,
    turnCounter: 0,
    turnId: '',
  };
}

// ── Token 警告状态 (直接复制自 Claude Code) ─────────────

export interface TokenWarningState {
  percentLeft: number;
  isAboveWarningThreshold: boolean;
  isAboveErrorThreshold: boolean;
  isAboveAutoCompactThreshold: boolean;
  isAtBlockingLimit: boolean;
}

/**
 * 计算 token 警告状态 — 对应 Claude Code 的 calculateTokenWarningState
 */
export function calculateTokenWarningState(
  tokenUsage: number,
  contextWindow: number,
): TokenWarningState {
  const percentLeft = ((contextWindow - tokenUsage) / contextWindow) * 100;

  return {
    percentLeft,
    isAboveWarningThreshold: tokenUsage < contextWindow - WARNING_THRESHOLD_BUFFER_TOKENS,
    isAboveErrorThreshold: tokenUsage < contextWindow - ERROR_THRESHOLD_BUFFER_TOKENS,
    isAboveAutoCompactThreshold: tokenUsage < contextWindow - AUTOCOMPACT_BUFFER_TOKENS,
    isAtBlockingLimit: tokenUsage >= contextWindow - MANUAL_COMPACT_BUFFER_TOKENS,
  };
}

/**
 * 判断是否应该自动压缩 — 对应 Claude Code 的 shouldAutoCompact
 */
export function shouldAutoCompact(
  tokenUsage: number,
  contextWindow: number,
  tracking: AutoCompactTrackingState,
): boolean {
  if (tracking.compacted) return false;
  if ((tracking.consecutiveFailures ?? 0) >= MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES) return false;

  const state = calculateTokenWarningState(tokenUsage, contextWindow);
  return !state.isAboveAutoCompactThreshold;
}
