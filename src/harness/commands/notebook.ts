/**
 * Notebook Command — 创建笔记
 *
 * 对应斜杠命令:
 *   /notebook <内容> — 创建一条笔记
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /notebook 命令
 *
 * @param saveNote - 保存笔记的回调
 */
export function createNotebookCommand(
  saveNote?: (content: string, ctx: CommandContext) => Promise<{ id: string }>,
): CommandDef {
  return {
    name: 'notebook',
    aliases: ['note', 'memo', 'jot'],
    description: '创建一条笔记',
    usage: '/notebook <笔记内容>',
    async execute(args: string[], ctx: CommandContext) {
      const content = args.join(' ').trim();
      if (!content) {
        await ctx.sendMessage('请提供笔记内容。用法: `/notebook <笔记内容>`');
        return;
      }

      if (saveNote) {
        try {
          const { id } = await saveNote(content, ctx);
          await ctx.sendMessage(`📝 笔记已保存。ID: \`${id}\``);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`保存笔记失败: ${msg}`);
        }
      } else {
        const timestamp = new Date().toISOString();
        const preview = content.length > 200
          ? content.substring(0, 200) + '...'
          : content;
        const lines = [
          '📝 **笔记已创建**',
          '---',
          `内容: ${preview}`,
          `时间: ${timestamp}`,
          `用户: \`${ctx.userId}\``,
          '---',
          '（当前环境未接入笔记系统，仅显示预览）',
        ];
        await ctx.sendMessage(lines.join('\n'));
      }
    },
  };
}
