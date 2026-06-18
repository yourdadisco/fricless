/**
 * Share Command — 分享对话
 *
 * 对应斜杠命令:
 *   /share — 生成对话分享链接
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createShareCommand(
  generateShareLink?: () => Promise<string>,
): CommandDef {
  return {
    name: 'share',
    aliases: ['share-conversation', 'share-link', 'export-share'],
    description: '生成当前对话的分享链接',
    usage: '/share',
    async execute(_args: string[], ctx: CommandContext) {
      if (generateShareLink) {
        try {
          const link = await generateShareLink();
          await ctx.sendMessage(
            `🔗 **对话分享链接已生成**\n---\n${link}\n\n此链接将在 7 天后过期。`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`生成分享链接失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(
          '🔗 **分享**\n---\n' +
          '对话分享功能需要配置分享服务。\n\n' +
          '提示: 使用 \`/export\` 可以导出对话内容。',
        );
      }
    },
  };
}
