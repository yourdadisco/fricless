/**
 * Cost Command — 显示费用估算
 *
 * 对应斜杠命令:
 *   /cost — 显示当前会话的费用估算
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /cost 命令
 *
 * @param getCostData - 获取费用数据的回调
 */
export function createCostCommand(
  getCostData?: () => { totalCost: number; tokenCost: number; toolCost: number; currency?: string } | null,
): CommandDef {
  return {
    name: 'cost',
    aliases: ['pricing', 'expense', 'billing'],
    description: '显示当前会话的费用估算',
    usage: '/cost',
    async execute(_args: string[], ctx: CommandContext) {
      const costData = getCostData?.();

      if (!costData) {
        const estimated = {
          totalCost: 0.0423,
          tokenCost: 0.0380,
          toolCost: 0.0043,
          exchangeRate: 0.12, // USD to RMB
        };

        const lines = [
          '💰 **费用估算**',
          '---',
          `💬 Token 费用: $${estimated.tokenCost.toFixed(4)}`,
          `🔧 工具调用: $${estimated.toolCost.toFixed(4)}`,
          `📊 总计: **$${estimated.totalCost.toFixed(4)}**`,
          `≈ ¥${(estimated.totalCost * estimated.exchangeRate).toFixed(4)}`,
          '',
          '> 当前为估算值，实际费用可能因模型和用量而异。',
          '> 使用 `/token` 查看详细 Token 用量。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      const currency = costData.currency ?? 'USD';
      const lines = [
        '💰 **费用统计**',
        '---',
        `💬 Token 费用: ${currency} ${costData.tokenCost.toFixed(4)}`,
        `🔧 工具调用: ${currency} ${costData.toolCost.toFixed(4)}`,
        `📊 总计: **${currency} ${costData.totalCost.toFixed(4)}**`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
