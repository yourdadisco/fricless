/**
 * Export Command — 导出会话为 JSON
 *
 * 对应斜杠命令:
 *   /export — 将当前会话的所有消息导出为 JSON 格式
 *
 * 需要访问 Session 存储以获取完整的消息历史。
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';
import type { ISessionStore } from '../../session/ISessionStore.js';

/**
 * 创建 /export 命令
 *
 * @param sessionStore - Session 存储实例
 */
export function createExportCommand(sessionStore: ISessionStore): CommandDef {
  return {
    name: 'export',
    aliases: ['export-json', 'download'],
    description: '导出当前会话为 JSON 格式',
    usage: '/export',
    async execute(_args: string[], ctx: CommandContext) {
      const session = sessionStore.get(ctx.sessionId);
      if (!session) {
        await ctx.sendMessage('当前会话不存在或已过期。');
        return;
      }

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        session: {
          id: session.id,
          userId: session.userId,
          chatId: session.chatId ?? null,
          createdAt: session.createdAt.toISOString(),
          lastActiveAt: session.lastActiveAt.toISOString(),
          messageCount: session.messages.length,
        },
        messages: session.messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string'
            ? msg.content
            : msg.content.map(c => c.text || '[非文本内容]').join(' '),
          toolCallId: msg.toolCallId ?? undefined,
          toolName: msg.toolName ?? undefined,
          timestamp: msg.metadata?.timestamp ?? undefined,
        })),
      };

      const json = JSON.stringify(exportData, null, 2);

      // 如果消息太长，分块发送
      const maxChunkSize = 15000;
      if (json.length <= maxChunkSize) {
        await ctx.sendMessage(`📦 **会话导出**\n\`\`\`json\n${json}\n\`\`\``);
      } else {
        await ctx.sendMessage(`📦 **会话导出** (${session.messages.length} 条消息，${json.length} 字符，已分块)`);
        for (let i = 0; i < json.length; i += maxChunkSize) {
          const chunk = json.slice(i, i + maxChunkSize);
          await ctx.sendMessage(`\`\`\`json\n${chunk}\n\`\`\``);
        }
      }
    },
  };
}
