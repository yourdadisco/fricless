/**
 * Usage Command — 显示 API 使用详情
 *
 * 对应斜杠命令:
 *   /usage — 显示 API 使用详情
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface ApiUsage {
  periodStart: string;
  periodEnd: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCalls: number;
  estimatedCost: number;
}

export function createUsageCommand(
  getUsage?: () => ApiUsage,
): CommandDef {
  return {
    name: 'usage',
    aliases: ['api-usage', 'usage-stats', 'token-usage'],
    description: '显示 API 使用详情和统计',
    usage: '/usage',
    async execute(_args: string[], ctx: CommandContext) {
      if (getUsage) {
        const usage = getUsage();
        const lines = [
          '📊 **API 使用详情**',
          '---',
          `周期: ${usage.periodStart} — ${usage.periodEnd}`,
          `总调用次数: ${usage.totalCalls}`,
          `总 Tokens: ${usage.totalTokens.toLocaleString()}`,
          `  输入 Tokens: ${usage.inputTokens.toLocaleString()}`,
          `  输出 Tokens: ${usage.outputTokens.toLocaleString()}`,
          `估算费用: $${usage.estimatedCost.toFixed(4)}`,
        ];
        await ctx.sendMessage(lines.join('\n'));
      } else {
        await ctx.sendMessage(
          '📊 **API 使用详情**\n---\n' +
          '当前无使用数据。使用 API 后将在此显示统计信息。',
        );
      }
    },
  };
}
