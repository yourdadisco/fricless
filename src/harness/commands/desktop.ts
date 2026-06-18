/**
 * Desktop Command — 桌面应用集成信息
 *
 * 对应斜杠命令:
 *   /desktop — 显示桌面应用集成信息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createDesktopCommand(
  getDesktopInfo?: () => { version?: string; connected: boolean; platform?: string },
): CommandDef {
  return {
    name: 'desktop',
    aliases: ['app', 'desktop-app'],
    description: '桌面应用集成信息',
    usage: '/desktop',
    async execute(_args: string[], ctx: CommandContext) {
      if (getDesktopInfo) {
        const info = getDesktopInfo();
        const icon = info.connected ? '🖥️' : '💻';
        const lines = [
          `${icon} **桌面应用集成**`,
          '---',
          `连接状态: ${info.connected ? '已连接' : '未连接'}`,
          info.version ? `版本: ${info.version}` : '',
          info.platform ? `平台: ${info.platform}` : '',
        ];
        await ctx.sendMessage(lines.filter(Boolean).join('\n'));
      } else {
        await ctx.sendMessage(
          '💻 **桌面应用集成**\n---\n' +
          '桌面应用集成允许 Fricless 与本地桌面环境交互。\n\n' +
          '状态: 未配置\n' +
          '在设置中启用桌面集成以使用此功能。',
        );
      }
    },
  };
}
