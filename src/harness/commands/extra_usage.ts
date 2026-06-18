/**
 * ExtraUsage Command — 显示额外使用统计
 *
 * 对应斜杠命令:
 *   /extra_usage — 显示详细的使用统计信息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createExtraUsageCommand(
  getStats?: () => {
    totalCalls: number;
    totalTokens: number;
    averagePerCall: number;
    peakTokens: number;
    activeDays: number;
    longestSession: number;
  },
): CommandDef {
  return {
    name: 'extra_usage',
    aliases: ['usage-detail', 'extra-stats', 'detailed-usage'],
    description: '显示详细的使用统计信息',
    usage: '/extra_usage',
    async execute(_args: string[], ctx: CommandContext) {
      if (!getStats) {
        await ctx.sendMessage(
          '📈 **额外使用统计（模拟）**\n---\n' +
          'API 调用次数: 0\n' +
          '总 Tokens: 0\n' +
          '平均每次调用: 0\n' +
          '峰值 Tokens: 0\n' +
          '活跃天数: 0\n' +
          '最长会话: 0 分钟',
        );
        return;
      }

      const stats = getStats();
      const lines = [
        '📈 **额外使用统计**',
        '---',
        `总 API 调用次数: ${stats.totalCalls.toLocaleString()}`,
        `总 Tokens: ${stats.totalTokens.toLocaleString()}`,
        `平均每次 Tokens: ${stats.averagePerCall.toLocaleString()}`,
        `峰值 Tokens: ${stats.peakTokens.toLocaleString()}`,
        `活跃天数: ${stats.activeDays}`,
        `最长会话: ${stats.longestSession} 分钟`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
