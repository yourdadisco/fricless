/**
 * Session Commands — 查看会话信息
 *
 * 对应斜杠命令:
 *   /session — 显示当前会话 ID、消息数、创建时间
 *   /sessions — 列出所有活跃会话（需 sessionStore 访问权限）
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';
import type { ISessionStore } from '../../session/ISessionStore.js';

/**
 * 创建 /session 和 /sessions 命令
 *
 * @param sessionStore - Session 存储实例（用于 /sessions 命令）
 */
export function createSessionCommands(sessionStore: ISessionStore): CommandDef[] {
  const sessionCommand: CommandDef = {
    name: 'session',
    aliases: ['session-info'],
    description: '显示当前会话信息',
    usage: '/session',
    async execute(_args: string[], ctx: CommandContext) {
      const session = sessionStore.get(ctx.sessionId);
      if (!session) {
        await ctx.sendMessage('当前会话不存在或已过期。');
        return;
      }

      const messageCount = session.messages.length;
      const created = session.createdAt.toISOString();
      const lastActive = session.lastActiveAt.toISOString();
      const idleMinutes = Math.round((Date.now() - session.lastActiveAt.getTime()) / 60000);

      const lines = [
        '📋 **当前会话信息**',
        '---',
        `ID: \`${session.id}\``,
        `用户: \`${session.userId}\``,
        `消息数: ${messageCount}`,
        `创建时间: ${created}`,
        `最后活动: ${lastActive} (${idleMinutes} 分钟前)`,
        session.chatId ? `来源: \`${session.chatId}\`` : '',
      ];
      await ctx.sendMessage(lines.filter(Boolean).join('\n'));
    },
  };

  const sessionsCommand: CommandDef = {
    name: 'sessions',
    aliases: ['session-list', 'active-sessions'],
    description: '列出所有活跃会话',
    usage: '/sessions',
    async execute(_args: string[], ctx: CommandContext) {
      const allSessions = sessionStore.getAll();

      if (allSessions.length === 0) {
        await ctx.sendMessage('当前没有活跃会话。');
        return;
      }

      const lines = [
        `📊 **活跃会话列表** (共 ${allSessions.length} 个)`,
        '---',
        ...allSessions.map(s => {
          const msgCount = s.messages.length;
          const idleMin = Math.round((Date.now() - s.lastActiveAt.getTime()) / 60000);
          const idleStr = idleMin < 1 ? '刚刚活动' : `${idleMin} 分钟前`;
          return `• \`${s.id.substring(0, 8)}…\` — ${s.userId} — ${msgCount} 条消息 — ${idleStr}`;
        }),
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };

  return [sessionCommand, sessionsCommand];
}
