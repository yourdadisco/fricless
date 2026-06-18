/**
 * Memory Commands — 记忆查看与删除
 *
 * 对应斜杠命令:
 *   /memory [query] — 显示/搜索记忆
 *   /forget <id> — 删除指定记忆
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';
import type { MemoryStore, MemoryEntry } from '../../memory/MemoryStore.js';

/**
 * 创建 /memory 和 /forget 命令
 *
 * @param memoryStore - 记忆存储实例
 */
export function createMemoryCommands(memoryStore: MemoryStore | null): CommandDef[] {
  const memoryCommand: CommandDef = {
    name: 'memory',
    aliases: ['memories', 'remember'],
    description: '显示或搜索记忆内容',
    usage: '/memory [关键词]',
    async execute(args: string[], ctx: CommandContext) {
      if (!memoryStore) {
        await ctx.sendMessage('记忆系统未启用。');
        return;
      }

      const query = args.join(' ').trim();

      try {
        if (query) {
          // 搜索记忆
          const results = await memoryStore.search(query, 10);
          if (results.length === 0) {
            await ctx.sendMessage(`没有找到与 "${query}" 相关的记忆。`);
            return;
          }

          const lines = [
            `🧠 **记忆搜索结果: "${query}"** (${results.length} 条)`,
            '---',
            ...results.map((mem, i) => {
              const content = mem.content.length > 200
                ? mem.content.substring(0, 200) + '...'
                : mem.content;
              const time = new Date(mem.createdAt).toLocaleString();
              return `${i + 1}. [${mem.id.substring(0, 8)}] ${content}\n   📅 ${time} | 🏷 ${mem.category}`;
            }),
          ];
          await ctx.sendMessage(lines.join('\n'));
        } else {
          // 列出最近记忆
          const recent = await memoryStore.search('', 20);
          if (recent.length === 0) {
            await ctx.sendMessage('暂无记忆。');
            return;
          }

          const lines = [
            `🧠 **最近记忆** (共 ${recent.length} 条)`,
            '---',
            ...recent.map((mem, i) => {
              const content = mem.content.length > 150
                ? mem.content.substring(0, 150) + '...'
                : mem.content;
              return `${i + 1}. \`${mem.id.substring(0, 8)}\`: ${content}`;
            }),
            '---',
            '使用 `/memory <关键词>` 搜索特定记忆，`/forget <id>` 删除记忆。',
          ];
          await ctx.sendMessage(lines.join('\n'));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.sendMessage(`记忆操作失败: ${msg}`);
      }
    },
  };

  const forgetCommand: CommandDef = {
    name: 'forget',
    aliases: ['delete-memory', 'forget-memory'],
    description: '删除指定记忆',
    usage: '/forget <记忆ID>',
    async execute(args: string[], ctx: CommandContext) {
      if (!memoryStore) {
        await ctx.sendMessage('记忆系统未启用。');
        return;
      }

      const id = args[0]?.trim();
      if (!id) {
        await ctx.sendMessage('请指定要删除的记忆 ID。用法: `/forget <id>`');
        return;
      }

      try {
        await memoryStore.delete(id);
        await ctx.sendMessage(`🗑️ 已删除记忆 \`${id}\`。`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.sendMessage(`删除失败: ${msg}`);
      }
    },
  };

  return [memoryCommand, forgetCommand];
}
