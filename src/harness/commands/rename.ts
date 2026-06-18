/**
 * Rename Command — 重命名当前会话
 *
 * 对应斜杠命令:
 *   /rename <新名称> — 重命名当前会话
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /rename 命令
 *
 * @param renameSession - 重命名会话的回调
 */
export function createRenameCommand(
  renameSession?: (sessionId: string, newName: string) => Promise<void>,
): CommandDef {
  return {
    name: 'rename',
    aliases: ['session-rename', 'name'],
    description: '重命名当前会话',
    usage: '/rename <新名称>',
    async execute(args: string[], ctx: CommandContext) {
      const newName = args.join(' ').trim();
      if (!newName) {
        await ctx.sendMessage('请提供新名称。用法: `/rename <新名称>`');
        return;
      }

      if (newName.length > 100) {
        await ctx.sendMessage('名称过长，请限制在 100 个字符以内。');
        return;
      }

      if (renameSession) {
        try {
          await renameSession(ctx.sessionId, newName);
          await ctx.sendMessage(`✏️ 会话已重命名为: **${newName}**`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`重命名失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(`✏️ 会话已重命名为: **${newName}**（模拟）`);
      }
    },
  };
}
