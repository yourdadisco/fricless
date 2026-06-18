/**
 * ResetLimits Command — 重置使用限制
 *
 * 对应斜杠命令:
 *   /reset_limits — 重置使用限制计数器
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createResetLimitsCommand(
  resetFn?: () => Promise<{ success: boolean; message: string }>,
): CommandDef {
  return {
    name: 'reset_limits',
    aliases: ['reset-limits', 'limits-reset'],
    description: '重置使用限制计数器',
    usage: '/reset_limits',
    async execute(_args: string[], ctx: CommandContext) {
      if (resetFn) {
        try {
          const result = await resetFn();
          if (result.success) {
            await ctx.sendMessage(`🔄 使用限制已重置。${result.message}`);
          } else {
            await ctx.sendMessage(`❌ 重置失败: ${result.message}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`重置失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage('🔄 使用限制已重置（模拟）。');
      }
    },
  };
}
