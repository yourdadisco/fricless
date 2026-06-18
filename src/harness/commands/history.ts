/**
 * History Command — 显示最近会话历史
 *
 * 对应斜杠命令:
 *   /history [条数] — 显示最近 N 条会话消息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /history 命令
 *
 * @param getMessages - 获取当前会话消息的回调（可选）
 */
export function createHistoryCommand(
  getMessages?: () => { role: string; content: string; timestamp?: Date }[],
): CommandDef {
  return {
    name: 'history',
    aliases: ['recent', 'chat-history'],
    description: '显示最近会话历史',
    usage: '/history [条数]',
    async execute(args: string[], ctx: CommandContext) {
      const count = args[0] ? Math.min(parseInt(args[0], 10) || 10, 100) : 10;
      const messages = getMessages?.() ?? [];

      if (messages.length === 0) {
        await ctx.sendMessage('当前会话暂无消息记录。');
        return;
      }

      const recent = messages.slice(-count);
      const lines = [
        `📜 **最近会话历史** (最近 ${recent.length}/${messages.length} 条)`,
        '---',
        ...recent.map((msg, i) => {
          const roleIcon = msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️';
          const content = msg.content.length > 200
            ? msg.content.substring(0, 200) + '...'
            : msg.content;
          const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
          return `${i + 1}. ${roleIcon} **${msg.role}** ${time}\n   ${content}`;
        }),
        '---',
        `使用 /save 保存会话到文件。`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
