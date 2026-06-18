/**
 * PrComments Command — 显示 PR 评论（存根）
 *
 * 对应斜杠命令:
 *   /pr_comments [pr-number] — 查看 PR 评论
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface PrComment {
  id: string;
  author: string;
  body: string;
  createdAt: Date;
  resolved: boolean;
}

export function createPrCommentsCommand(
  getComments?: (prNumber?: number) => PrComment[],
): CommandDef {
  return {
    name: 'pr_comments',
    aliases: ['pr-comments', 'pull-request-comments', 'review-comments'],
    description: '显示 PR 评论',
    usage: '/pr_comments [PR编号]',
    async execute(args: string[], ctx: CommandContext) {
      const prNumber = args[0] ? parseInt(args[0], 10) : undefined;

      if (prNumber && isNaN(prNumber)) {
        await ctx.sendMessage('PR 编号无效。用法: `/pr_comments [PR编号]`');
        return;
      }

      if (getComments) {
        const comments = getComments(prNumber);
        if (comments.length === 0) {
          await ctx.sendMessage(`PR #${prNumber || '当前'} 没有评论。`);
          return;
        }
        const lines = [
          `💬 **PR 评论${prNumber ? ` #${prNumber}` : ''}**`,
          '---',
          ...comments.map(c =>
            `${c.resolved ? '✅' : '📝'} **${c.author}** (${c.createdAt.toLocaleString()})\n` +
            `${c.body.length > 200 ? c.body.substring(0, 200) + '...' : c.body}`,
          ),
        ];
        await ctx.sendMessage(lines.join('\n'));
      } else {
        const prLabel = prNumber ? ` #${prNumber}` : '';
        await ctx.sendMessage(
          `💬 **PR 评论${prLabel}**\n---\n` +
          'PR 评论功能需要配置 Git 集成。\n\n' +
          '使用 \`/bridge\` 连接远程仓库以启用此功能。',
        );
      }
    },
  };
}
