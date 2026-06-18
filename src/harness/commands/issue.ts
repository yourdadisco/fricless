/**
 * Issue Command — 报告问题
 *
 * 对应斜杠命令:
 *   /issue <描述> — 报告问题/错误
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createIssueCommand(
  reportIssue?: (description: string) => Promise<string>,
): CommandDef {
  return {
    name: 'issue',
    aliases: ['bug', 'report', 'problem'],
    description: '报告问题或错误',
    usage: '/issue <问题描述>',
    async execute(args: string[], ctx: CommandContext) {
      const description = args.join(' ').trim();

      if (!description) {
        await ctx.sendMessage(
          '🐛 **报告问题**\n---\n' +
          '请描述你遇到的问题，包括复现步骤。\n\n' +
          '用法: `/issue <问题描述>`',
        );
        return;
      }

      if (reportIssue) {
        try {
          const id = await reportIssue(description);
          await ctx.sendMessage(`🐛 问题已报告 (ID: \`${id}\`)。我们会尽快处理。`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`报告问题失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage('🐛 问题已记录（模拟）。感谢你的反馈！');
      }
    },
  };
}
