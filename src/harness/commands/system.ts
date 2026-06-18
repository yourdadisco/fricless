/**
 * System Command — 显示系统信息
 *
 * 对应斜杠命令:
 *   /system — 显示 OS、内存、运行时间等系统信息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /system 命令
 *
 * @param getOSInfo - 获取系统信息的回调（可选）
 */
export function createSystemCommand(
  getOSInfo?: () => { platform: string; arch: string; memory: { free: number; total: number }; uptime: number; nodeVersion: string },
): CommandDef {
  return {
    name: 'system',
    aliases: ['sysinfo', 'os', 'sys'],
    description: '显示系统信息（OS、内存、运行时间）',
    usage: '/system',
    async execute(_args: string[], ctx: CommandContext) {
      const info = getOSInfo?.() ?? {
        platform: 'win32',
        arch: 'x64',
        memory: { free: 4.2 * 1024 ** 3, total: 16 * 1024 ** 3 },
        uptime: 3600 * 48,
        nodeVersion: 'v20.11.0',
      };

      const freeGB = (info.memory.free / 1024 ** 3).toFixed(1);
      const totalGB = (info.memory.total / 1024 ** 3).toFixed(1);
      const usedGB = ((info.memory.total - info.memory.free) / 1024 ** 3).toFixed(1);
      const memPercent = ((info.memory.total - info.memory.free) / info.memory.total * 100).toFixed(0);
      const uptimeDays = Math.floor(info.uptime / 86400);
      const uptimeHours = Math.floor((info.uptime % 86400) / 3600);

      const lines = [
        '💻 **系统信息**',
        '---',
        `🖥 平台: ${info.platform} (${info.arch})`,
        `⚡ Node.js: ${info.nodeVersion}`,
        `🧠 内存: ${usedGB}GB / ${totalGB}GB (${memPercent}% 已用)`,
        `💾 空闲: ${freeGB}GB`,
        `⏱ 运行时间: ${uptimeDays} 天 ${uptimeHours} 小时`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
