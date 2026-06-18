/**
 * Fast Command — 切换快速模式
 *
 * 对应斜杠命令:
 *   /fast [on|off] — 切换快速模式
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createFastCommand(
  isFastMode?: () => boolean,
  setFastMode?: (enabled: boolean) => void,
): CommandDef {
  return {
    name: 'fast',
    aliases: ['fast-mode', 'turbo'],
    description: '切换快速模式（跳过非关键处理）',
    usage: '/fast [on|off]',
    async execute(args: string[], ctx: CommandContext) {
      const current = isFastMode?.() ?? false;
      const arg = args[0]?.toLowerCase();

      let newState: boolean;
      if (arg === 'on' || arg === 'true' || arg === '1') {
        newState = true;
      } else if (arg === 'off' || arg === 'false' || arg === '0') {
        newState = false;
      } else if (arg === 'toggle' || !arg) {
        newState = !current;
      } else {
        await ctx.sendMessage(`无效参数 "${arg}"。使用 on, off 或 toggle。`);
        return;
      }

      setFastMode?.(newState);
      const icon = newState ? '⚡' : '🐢';
      await ctx.sendMessage(`${icon} 快速模式已${newState ? '启用' : '禁用'}。`);
    },
  };
}
