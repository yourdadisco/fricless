/**
 * Vim Command — Vim 模式切换
 *
 * 对应斜杠命令:
 *   /vim [on|off] — 切换 Vim 键绑定模式
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createVimCommand(
  isVimMode?: () => boolean,
  setVimMode?: (enabled: boolean) => void,
): CommandDef {
  return {
    name: 'vim',
    aliases: ['vim-mode', 'vi-mode', 'vim-keybindings'],
    description: '切换 Vim 键绑定模式',
    usage: '/vim [on|off]',
    async execute(args: string[], ctx: CommandContext) {
      const current = isVimMode?.() ?? false;
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

      setVimMode?.(newState);
      const icon = newState ? '⌨️' : '📝';
      await ctx.sendMessage(
        `${icon} Vim 模式已${newState ? '启用' : '禁用'}。` +
        (newState ? '现已支持 Vim 键绑定。' : '已恢复默认键绑定。'),
      );
    },
  };
}
