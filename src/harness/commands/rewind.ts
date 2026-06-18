/**
 * Rewind Command — 回退对话到检查点
 *
 * 对应斜杠命令:
 *   /rewind [steps] — 回退对话到之前的状态
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createRewindCommand(
  rewindTo?: (steps: number) => Promise<{ success: boolean; message: string }>,
): CommandDef {
  return {
    name: 'rewind',
    aliases: ['undo', 'rollback', 'revert'],
    description: '回退对话到之前的状态',
    usage: '/rewind [步数]',
    async execute(args: string[], ctx: CommandContext) {
      const steps = args[0] ? parseInt(args[0], 10) : 1;

      if (isNaN(steps) || steps < 1) {
        await ctx.sendMessage('请提供有效的步数（正整数）。');
        return;
      }

      if (rewindTo) {
        try {
          const result = await rewindTo(steps);
          if (result.success) {
            await ctx.sendMessage(`⏪ 已回退 ${steps} 步。${result.message}`);
          } else {
            await ctx.sendMessage(`⏪ 回退失败: ${result.message}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`回退失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(`⏪ 已回退 ${steps} 步（模拟）。`);
      }
    },
  };
}
