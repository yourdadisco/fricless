/**
 * Tag Command — 为当前对话添加标签
 *
 * 对应斜杠命令:
 *   /tag <标签> [标签2 ...] — 为当前会话添加标签
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /tag 命令
 *
 * @param addTags - 添加标签的回调
 * @param getTags - 获取当前标签的回调
 */
export function createTagCommand(
  addTags?: (sessionId: string, tags: string[]) => Promise<void>,
  getTags?: (sessionId: string) => string[],
): CommandDef {
  return {
    name: 'tag',
    aliases: ['tags', 'label', 'add-tag'],
    description: '为当前会话添加标签',
    usage: '/tag <标签> [标签2 ...]',
    async execute(args: string[], ctx: CommandContext) {
      if (args.length === 0) {
        // 显示当前标签
        const currentTags = getTags?.(ctx.sessionId) ?? [
          'general',
          'development',
        ];
        if (currentTags.length === 0) {
          await ctx.sendMessage('当前会话没有标签。使用 `/tag <标签>` 添加。');
        } else {
          const lines = [
            '🏷 **当前标签**',
            '---',
            currentTags.map(t => `  • \`${t}\``).join('\n'),
            '---',
            '使用 `/tag <标签1> <标签2> ...` 添加新标签。',
          ];
          await ctx.sendMessage(lines.join('\n'));
        }
        return;
      }

      const newTags = args.map(t => t.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')).filter(Boolean);

      if (newTags.length === 0) {
        await ctx.sendMessage('标签只能包含字母、数字、下划线和连字符。');
        return;
      }

      if (addTags) {
        try {
          await addTags(ctx.sessionId, newTags);
          await ctx.sendMessage(`🏷 已添加标签: ${newTags.map(t => `\`${t}\``).join(', ')}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`添加标签失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(`🏷 已添加标签: ${newTags.map(t => `\`${t}\``).join(', ')}（模拟）`);
      }
    },
  };
}
