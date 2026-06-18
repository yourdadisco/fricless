/**
 * PerfIssue Command — 报告性能问题
 *
 * 对应斜杠命令:
 *   /perf_issue <描述> — 报告性能问题
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createPerfIssueCommand(
  reportPerfIssue?: (description: string) => Promise<string>,
): CommandDef {
  return {
    name: 'perf_issue',
    aliases: ['perf-report', 'performance-issue', 'slow'],
    description: '报告性能问题',
    usage: '/perf_issue <问题描述>',
    async execute(args: string[], ctx: CommandContext) {
      const description = args.join(' ').trim();

      if (!description) {
        await ctx.sendMessage(
          '🐢 **报告性能问题**\n---\n' +
          '描述你遇到的性能问题，包括操作步骤和预期行为。\n\n' +
          '用法: `/perf_issue <描述>`',
        );
        return;
      }

      if (reportPerfIssue) {
        try {
          const id = await reportPerfIssue(description);
          await ctx.sendMessage(`🐢 性能问题已报告 (ID: \`${id}\`)。`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`报告失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage('🐢 性能问题已记录（模拟）。');
      }
    },
  };
}
