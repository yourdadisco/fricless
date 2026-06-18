/**
 * Branch Command — 创建命名对话分支
 *
 * 对应斜杠命令:
 *   /branch <name> — 从当前对话创建新分支
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createBranchCommand(
  createBranch?: (name: string) => Promise<string>,
): CommandDef {
  return {
    name: 'branch',
    aliases: ['fork', 'checkpoint'],
    description: '从当前对话创建命名分支',
    usage: '/branch <分支名称>',
    async execute(args: string[], ctx: CommandContext) {
      const name = args.join('_').trim().replace(/[^a-zA-Z0-9_-]/g, '');

      if (!name) {
        await ctx.sendMessage(
          '🌿 **对话分支**\n---\n' +
          '分支允许你从当前对话创建独立的探索路径。\n\n' +
          '用法: `/branch <分支名称>`\n' +
          '切换分支: `/branch <名称>`',
        );
        return;
      }

      if (createBranch) {
        try {
          const id = await createBranch(name);
          await ctx.sendMessage(`🌿 已创建分支 \`${name}\` (ID: \`${id}\`)。使用分支命令切换到此分支。`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`创建分支失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(`🌿 已创建分支 \`${name}\`（模拟）。`);
      }
    },
  };
}
