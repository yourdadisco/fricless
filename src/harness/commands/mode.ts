/**
 * Mode Command — 切换 auto/confirm 权限模式
 *
 * 对应斜杠命令:
 *   /mode [auto|confirm] — 查看或切换权限模式
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /mode 命令
 *
 * @param getMode - 获取当前模式
 * @param setMode - 设置新模式（可选，null 表示只读）
 */
export function createModeCommand(
  getMode?: () => string,
  setMode?: (mode: string) => void,
): CommandDef {
  return {
    name: 'mode',
    aliases: ['permission-mode', 'perm-mode'],
    description: '查看或切换 auto/confirm 权限模式',
    usage: '/mode [auto|confirm]',
    async execute(args: string[], ctx: CommandContext) {
      const currentMode = getMode?.() ?? 'confirm';

      if (args.length === 0) {
        const lines = [
          '🔐 **权限模式**',
          '---',
          `当前模式: **${currentMode}**`,
          '',
          '可选模式:',
          '  • `auto` — 自动允许所有操作',
          '  • `confirm` — 每次操作前确认（默认）',
          '',
          '使用 `/mode auto` 或 `/mode confirm` 切换。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      const newMode = args[0].toLowerCase();
      if (newMode !== 'auto' && newMode !== 'confirm') {
        await ctx.sendMessage(`无效模式 "${newMode}"。请使用 \`auto\` 或 \`confirm\`。`);
        return;
      }

      if (!setMode) {
        await ctx.sendMessage('当前环境不支持切换权限模式。');
        return;
      }

      setMode(newMode);
      await ctx.sendMessage(`✅ 权限模式已切换为 **${newMode}**。`);
    },
  };
}
