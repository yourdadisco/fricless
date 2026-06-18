/**
 * Brief Command — 显示简洁对话摘要
 *
 * 对应斜杠命令:
 *   /brief — 显示当前对话的简洁摘要
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createBriefCommand(
  getBrief?: () => string,
): CommandDef {
  return {
    name: 'brief',
    aliases: ['summary-short', 'digest'],
    description: '显示当前对话的简洁摘要',
    usage: '/brief',
    async execute(_args: string[], ctx: CommandContext) {
      if (getBrief) {
        const brief = getBrief();
        await ctx.sendMessage(`📋 **对话摘要**\n---\n${brief}`);
      } else {
        await ctx.sendMessage(
          '📋 **对话摘要（模拟）**\n---\n' +
          '当前对话尚未产生足够的内容生成摘要。继续对话后将自动生成。',
        );
      }
    },
  };
}
