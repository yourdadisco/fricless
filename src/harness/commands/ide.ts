/**
 * IDE Command — IDE 集成设置
 *
 * 对应斜杠命令:
 *   /ide [status|connect] — IDE 集成管理
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createIdeCommand(
  getIdeStatus?: () => { connected: boolean; name?: string; version?: string },
): CommandDef {
  return {
    name: 'ide',
    aliases: ['vscode', 'editor', 'cursor'],
    description: 'IDE 集成设置与状态',
    usage: '/ide [status]',
    async execute(args: string[], ctx: CommandContext) {
      const subcommand = args[0]?.toLowerCase() || 'status';

      if (subcommand === 'status') {
        if (getIdeStatus) {
          const status = getIdeStatus();
          const icon = status.connected ? '🟢' : '🔴';
          const lines = [
            `${icon} **IDE 集成**`,
            '---',
            `状态: ${status.connected ? '已连接' : '未连接'}`,
            status.name ? `IDE: ${status.name}` : '',
            status.version ? `版本: ${status.version}` : '',
          ];
          await ctx.sendMessage(lines.filter(Boolean).join('\n'));
        } else {
          await ctx.sendMessage(
            '🔴 **IDE 集成**\n---\n' +
            '状态: 未连接\n\n' +
            '支持的 IDE:\n' +
            '  • VS Code\n  • Cursor\n  • JetBrains\n\n' +
            '安装对应插件以启用 IDE 集成。',
          );
        }
        return;
      }

      await ctx.sendMessage(`未知子命令 "${subcommand}"。可用: status`);
    },
  };
}
