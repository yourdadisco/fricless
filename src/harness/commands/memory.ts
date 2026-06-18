/**
 * Memory Command — 增强记忆管理
 *
 * 对应斜杠命令:
 *   /memory [query] — 搜索/查看记忆
 *   /memory stats — 记忆系统统计
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface MemoryStoreStats {
  total: number;
  categories: Record<string, number>;
  oldest: Date;
  newest: Date;
}

export function createMemoryCommand(
  searchMemory?: (query: string, limit?: number) => Promise<{ id: string; content: string; category: string; createdAt: Date }[]>,
  getStats?: () => MemoryStoreStats,
): CommandDef {
  return {
    name: 'memory',
    aliases: ['memories', 'remember', 'recall'],
    description: '记忆管理 — 搜索/查看/统计',
    usage: '/memory [查询关键词]',
    async execute(args: string[], ctx: CommandContext) {
      const subcommand = args[0]?.toLowerCase();

      if (subcommand === 'stats' || subcommand === 'stat') {
        if (getStats) {
          const stats = getStats();
          const lines = [
            '🧠 **记忆系统统计**',
            '---',
            `总记忆数: ${stats.total}`,
            '分类:',
            ...Object.entries(stats.categories).map(
              ([cat, count]) => `  • ${cat}: ${count}`,
            ),
            `最早记忆: ${stats.oldest.toLocaleString()}`,
            `最新记忆: ${stats.newest.toLocaleString()}`,
          ];
          await ctx.sendMessage(lines.join('\n'));
        } else {
          await ctx.sendMessage('🧠 **记忆系统统计**\n---\n总记忆数: 0\n记忆系统未启用。');
        }
        return;
      }

      const query = args.join(' ').trim();
      if (!query) {
        await ctx.sendMessage(
          '🧠 **记忆管理**\n---\n' +
          '用法:\n' +
          '  • \`/memory <关键词>\` — 搜索记忆\n' +
          '  • \`/memory stats\` — 查看统计\n' +
          '  • \`/forget <id>\` — 删除指定记忆',
        );
        return;
      }

      if (searchMemory) {
        try {
          const results = await searchMemory(query, 10);
          if (results.length === 0) {
            await ctx.sendMessage(`没有找到与 "${query}" 相关的记忆。`);
            return;
          }
          const lines = [
            `🧠 **搜索结果: "${query}"** (${results.length} 条)`,
            '---',
            ...results.map((r, i) => {
              const content = r.content.length > 150
                ? r.content.substring(0, 150) + '...'
                : r.content;
              return `${i + 1}. \`${r.id.substring(0, 8)}\`: ${content}`;
            }),
          ];
          await ctx.sendMessage(lines.join('\n'));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`搜索记忆失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage('🧠 记忆系统未启用。无法执行搜索。');
      }
    },
  };
}
