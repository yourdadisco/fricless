/**
 * Color Command — 切换颜色输出模式
 *
 * 对应斜杠命令:
 *   /color [on|off] — 切换颜色输出
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createColorCommand(
  getColorEnabled?: () => boolean,
  setColorEnabled?: (enabled: boolean) => void,
): CommandDef {
  return {
    name: 'color',
    aliases: ['colour', 'toggle-color', 'ansi'],
    description: '切换终端颜色输出模式',
    usage: '/color [on|off]',
    async execute(args: string[], ctx: CommandContext) {
      const current = getColorEnabled?.() ?? true;
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

      setColorEnabled?.(newState);
      const icon = newState ? '🎨' : '⚪';
      await ctx.sendMessage(`${icon} 颜色输出已${newState ? '启用' : '禁用'}。`);
    },
  };
}
