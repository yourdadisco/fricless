/**
 * MockLimits Command — 显示模拟 API 限制
 *
 * 对应斜杠命令:
 *   /mock_limits — 显示当前模拟 API 的使用限制
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createMockLimitsCommand(
  getLimits?: () => {
    maxRequests: number;
    usedRequests: number;
    resetAt: string;
    maxTokens: number;
    usedTokens: number;
  },
): CommandDef {
  return {
    name: 'mock_limits',
    aliases: ['mock-limits', 'mock-api-limits'],
    description: '显示模拟 API 的使用限制',
    usage: '/mock_limits',
    async execute(_args: string[], ctx: CommandContext) {
      if (getLimits) {
        const limits = getLimits();
        const reqPercent = limits.maxRequests > 0
          ? ((limits.usedRequests / limits.maxRequests) * 100).toFixed(1)
          : '0';
        const tokPercent = limits.maxTokens > 0
          ? ((limits.usedTokens / limits.maxTokens) * 100).toFixed(1)
          : '0';

        const lines = [
          '🧪 **模拟 API 限制**',
          '---',
          `请求: ${limits.usedRequests}/${limits.maxRequests} (${reqPercent}%)`,
          `Tokens: ${limits.usedTokens.toLocaleString()}/${limits.maxTokens.toLocaleString()} (${tokPercent}%)`,
          `重置时间: ${limits.resetAt}`,
        ];
        await ctx.sendMessage(lines.join('\n'));
      } else {
        await ctx.sendMessage(
          '🧪 **模拟 API 限制**\n---\n' +
          '当前无限制（未启用模拟模式）。',
        );
      }
    },
  };
}
