/**
 * Bridge Command — 显示远程桥接连接状态
 *
 * 对应斜杠命令:
 *   /bridge — 查看远程桥接状态
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createBridgeCommand(
  getStatus?: () => { connected: boolean; endpoint?: string; latency?: number },
): CommandDef {
  return {
    name: 'bridge',
    aliases: ['remote-status', 'bridge-status'],
    description: '显示远程桥接连接状态',
    usage: '/bridge',
    async execute(_args: string[], ctx: CommandContext) {
      if (getStatus) {
        const status = getStatus();
        const icon = status.connected ? '🟢' : '🔴';
        const lines = [
          `${icon} **桥接状态**`,
          '---',
          `状态: ${status.connected ? '已连接' : '未连接'}`,
          status.endpoint ? `端点: \`${status.endpoint}\`` : '',
          status.latency !== undefined ? `延迟: ${status.latency}ms` : '',
        ];
        await ctx.sendMessage(lines.filter(Boolean).join('\n'));
      } else {
        await ctx.sendMessage(
          '🔴 **桥接状态**\n---\n' +
          '状态: 未连接\n' +
          '远程桥接未配置。使用 /remote_setup 查看设置指南。',
        );
      }
    },
  };
}
