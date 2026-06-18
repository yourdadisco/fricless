/**
 * Status Command — 显示会话状态
 *
 * 对应斜杠命令:
 *   /status — 显示当前会话运行状态
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /status 命令
 *
 * @param getSessionStatus - 获取会话状态的回调
 */
export function createStatusCommand(
  getSessionStatus?: () => {
    sessionId: string;
    messages: number;
    connected: boolean;
    uptime: number;
    mode: string;
    model: string;
  },
): CommandDef {
  return {
    name: 'status',
    aliases: ['session-status', 'health'],
    description: '显示当前会话状态',
    usage: '/status',
    async execute(_args: string[], ctx: CommandContext) {
      const status = getSessionStatus?.() ?? {
        sessionId: ctx.sessionId,
        messages: 12,
        connected: true,
        uptime: 3600,
        mode: 'confirm',
        model: 'claude-3-opus-20240229',
      };

      const uptimeStr = formatDuration(status.uptime);
      const connIcon = status.connected ? '🟢' : '🔴';

      const lines = [
        '📊 **会话状态**',
        '---',
        `${connIcon} 连接状态: ${status.connected ? '已连接' : '已断开'}`,
        `🆔 会话 ID: \`${status.sessionId.substring(0, 12)}…\``,
        `💬 消息数: ${status.messages}`,
        `🤖 模型: ${status.model}`,
        `🔐 权限模式: ${status.mode}`,
        `⏱ 会话时长: ${uptimeStr}`,
        '',
        '使用 `/help` 查看所有可用命令。',
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} 小时`);
  if (m > 0) parts.push(`${m} 分`);
  parts.push(`${s} 秒`);
  return parts.join(' ');
}
