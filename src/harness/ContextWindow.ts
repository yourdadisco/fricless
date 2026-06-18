/**
 * Context Window — Claude Code 的 utils/context.ts 移植
 *
 * 模型上下文窗口解析 + 最大输出 token 计算。
 */
export const MODEL_CONTEXT_WINDOW_DEFAULT = 200_000;
export const COMPACT_MAX_OUTPUT_TOKENS = 20_000;
export const MAX_OUTPUT_TOKENS_DEFAULT = 32_000;
export const MAX_OUTPUT_TOKENS_UPPER_LIMIT = 64_000;

// 直接从 Claude Code 源码复制
const MODEL_MAX_OUTPUT_LOOKUP: Record<string, { default: number; upperLimit: number }> = {
  'opus-4-6': { default: 64000, upperLimit: 128000 },
  'sonnet-4-6': { default: 32000, upperLimit: 128000 },
  'claude-3-5-sonnet': { default: 32000, upperLimit: 64000 },
  'claude-3-opus': { default: 32000, upperLimit: 64000 },
  'gpt-4o': { default: 16384, upperLimit: 32768 },
  'deepseek-chat': { default: 32000, upperLimit: 64000 },
  'deepseek-reasoner': { default: 32000, upperLimit: 64000 },
};

/** 获取模型上下文窗口大小 */
export function getContextWindowForModel(model: string): number {
  if (model.includes('sonnet-4') || model.includes('opus-4')) return 200000;
  if (model.includes('deepseek')) return 64000;
  if (model.includes('gpt-4')) return 128000;
  if (model.includes('qwen') || model.includes('kimi')) return 128000;
  return MODEL_CONTEXT_WINDOW_DEFAULT;
}

/** 获取模型最大输出 token */
export function getModelMaxOutputTokens(model: string): { default: number; upperLimit: number } {
  const key = Object.keys(MODEL_MAX_OUTPUT_LOOKUP).find(k => model.includes(k));
  return key ? MODEL_MAX_OUTPUT_LOOKUP[key] : { default: MAX_OUTPUT_TOKENS_DEFAULT, upperLimit: MAX_OUTPUT_TOKENS_UPPER_LIMIT };
}

/** 计算上下文百分比 */
export function calculateContextPercentages(usage: number, windowSize: number): { used: number; remaining: number } {
  return {
    used: Math.round((usage / windowSize) * 100),
    remaining: Math.round(((windowSize - usage) / windowSize) * 100),
  };
}
