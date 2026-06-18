/**
 * Token Command — 显示 Token 用量估算
 *
 * 对应斜杠命令:
 *   /token — 显示当前会话的 Token 使用统计
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /token 命令
 *
 * @param getTokenUsage - 获取 Token 用量数据
 */
export function createTokenCommand(
  getTokenUsage?: () => { prompt: number; completion: number; total: number; cost?: number } | null,
): CommandDef {
  return {
    name: 'token',
    aliases: ['tokens', 'token-count', 'token-usage'],
    description: '显示 Token 用量估算',
    usage: '/token',
    async execute(_args: string[], ctx: CommandContext) {
      const usage = getTokenUsage?.();

      if (!usage) {
        // 提供模拟估算
        const estimated = {
          prompt: 1250,
          completion: 380,
          total: 1630,
        };
        const lines = [
          '🔢 **Token 用量估算**',
          '---',
          `🧾 Prompt tokens: ${estimated.prompt.toLocaleString()}`,
          `💬 Completion tokens: ${estimated.completion.toLocaleString()}`,
          `📊 总计: ${estimated.total.toLocaleString()}`,
          '',
          '> 当前未接入实际 Token 计数器，以上为估算值。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      const costStr = usage.cost != null ? `$${usage.cost.toFixed(4)}` : '未计算';
      const ratio = usage.total > 0
        ? ((usage.completion / usage.total) * 100).toFixed(1)
        : '0.0';

      const lines = [
        '🔢 **Token 用量**',
        '---',
        `🧾 Prompt: ${usage.prompt.toLocaleString()}`,
        `💬 Completion: ${usage.completion.toLocaleString()} (${ratio}%)`,
        `📊 总计: ${usage.total.toLocaleString()}`,
        `💰 费用: ${costStr}`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
