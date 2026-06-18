/**
 * Search Command — 搜索对话
 *
 * 对应斜杠命令:
 *   /search <关键词> — 搜索当前会话或历史会话
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /search 命令
 *
 * @param searchMessages - 搜索消息的回调
 */
export function createSearchCommand(
  searchMessages?: (query: string) => Promise<{ role: string; content: string; sessionId?: string; timestamp?: Date }[]>,
): CommandDef {
  return {
    name: 'search',
    aliases: ['find', 'grep', 'search-conversation'],
    description: '搜索当前会话或历史会话',
    usage: '/search <关键词>',
    async execute(args: string[], ctx: CommandContext) {
      const query = args.join(' ').trim().toLowerCase();
      if (!query) {
        await ctx.sendMessage('请提供搜索关键词。用法: `/search <关键词>`');
        return;
      }

      if (searchMessages) {
        try {
          const results = await searchMessages(query);
          if (results.length === 0) {
            await ctx.sendMessage(`没有找到匹配 "${query}" 的消息。`);
            return;
          }

          const lines = [
            `🔍 **搜索结果: "${query}"** (${results.length} 条)`,
            '---',
            ...results.slice(0, 15).map((r, i) => {
              const icon = r.role === 'user' ? '👤' : '🤖';
              const content = r.content.length > 150
                ? r.content.substring(0, 150) + '...'
                : r.content;
              const sid = r.sessionId ? ` [${r.sessionId.substring(0, 8)}]` : '';
              return `${i + 1}. ${icon}${sid}\n   ${content}`;
            }),
            ...(results.length > 15 ? ['', `... 还有 ${results.length - 15} 条结果`] : []),
          ];
          await ctx.sendMessage(lines.join('\n'));
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`搜索失败: ${msg}`);
          return;
        }
      }

      // 回退：只能在当前会话搜索
      await ctx.sendMessage([
        `🔍 **搜索: "${query}"**`,
        '---',
        '当前环境未接入全文搜索功能。',
        '',
        '提示：可用 `/memory <关键词>` 搜索记忆内容。',
      ].join('\n'));
    },
  };
}
