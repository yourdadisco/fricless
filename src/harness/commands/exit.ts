/**
 * Exit Command — 退出 CLI
 *
 * 对应斜杠命令:
 *   /exit — 退出 CLI 应用程序
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createExitCommand(
  exitFn?: () => void,
): CommandDef {
  return {
    name: 'exit',
    aliases: ['quit', 'bye', 'close'],
    description: '退出 CLI 应用程序',
    usage: '/exit',
    async execute(_args: string[], ctx: CommandContext) {
      await ctx.sendMessage('👋 正在退出...');
      if (exitFn) {
        setTimeout(() => exitFn(), 100);
      }
    },
  };
}
