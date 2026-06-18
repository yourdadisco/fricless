/**
 * Compact Command — 紧凑视图切换
 *
 * 对应斜杠命令:
 *   /compact [on|off] — 切换紧凑显示模式
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /compact 命令
 *
 * @param isCompact - 检查当前是否为紧凑模式
 * @param setCompact - 设置紧凑模式
 */
export function createCompactCommand(
  isCompact?: () => boolean,
  setCompact?: (enabled: boolean) => void,
): CommandDef {
  return {
    name: 'compact',
    aliases: ['compact-view', 'toggle-compact'],
    description: '切换紧凑显示模式',
    usage: '/compact [on|off]',
    async execute(args: string[], ctx: CommandContext) {
      const current = isCompact?.() ?? false;

      if (args.length === 0) {
        const status = current ? '🟢 已开启' : '🔴 已关闭';
        const lines = [
          '📏 **紧凑模式**',
          '---',
          `状态: ${status}`,
          '',
          '紧凑模式下，输出会减少冗余信息，更精简。',
          '',
          '用法:',
          '  • `/compact on` — 开启紧凑模式',
          '  • `/compact off` — 关闭紧凑模式',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      const arg = args[0].toLowerCase();
      let newState: boolean;

      if (arg === 'on' || arg === 'true' || arg === '1' || arg === 'enable') {
        newState = true;
      } else if (arg === 'off' || arg === 'false' || arg === '0' || arg === 'disable') {
        newState = false;
      } else {
        await ctx.sendMessage(`无效参数 "${arg}"。请使用 \`on\` 或 \`off\`。`);
        return;
      }

      if (!setCompact) {
        await ctx.sendMessage('当前环境不支持切换紧凑模式。');
        return;
      }

      setCompact(newState);
      await ctx.sendMessage(`✅ 紧凑模式已${newState ? '开启' : '关闭'}。`);
    },
  };
}
