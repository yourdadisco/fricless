/**
 * Mobile Command — 移动设备连接信息
 *
 * 对应斜杠命令:
 *   /mobile — 显示移动设备连接信息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createMobileCommand(
  getMobileInfo?: () => { connected: boolean; device?: string; platform?: string },
): CommandDef {
  return {
    name: 'mobile',
    aliases: ['phone', 'mobile-app'],
    description: '移动设备连接信息',
    usage: '/mobile',
    async execute(_args: string[], ctx: CommandContext) {
      if (getMobileInfo) {
        const info = getMobileInfo();
        const icon = info.connected ? '📱' : '📵';
        const lines = [
          `${icon} **移动设备**`,
          '---',
          `连接状态: ${info.connected ? '已连接' : '未连接'}`,
          info.device ? `设备: ${info.device}` : '',
          info.platform ? `平台: ${info.platform}` : '',
        ];
        await ctx.sendMessage(lines.filter(Boolean).join('\n'));
      } else {
        await ctx.sendMessage(
          '📱 **移动设备**\n---\n' +
          '状态: 未连接\n\n' +
          '通过 Fricless 移动应用连接到您的设备。\n' +
          '在应用商店搜索 "Fricless" 下载。',
        );
      }
    },
  };
}
