/**
 * CtxViz Command — 可视化上下文窗口使用情况
 *
 * 对应斜杠命令:
 *   /ctx_viz — 显示上下文窗口使用情况的可视化
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createCtxVizCommand(
  getUsage?: () => { used: number; total: number; messages: number; tokensByRole?: Record<string, number> },
): CommandDef {
  return {
    name: 'ctx_viz',
    aliases: ['context-viz', 'context-visualize', 'ctx-usage'],
    description: '可视化上下文窗口使用情况',
    usage: '/ctx_viz',
    async execute(_args: string[], ctx: CommandContext) {
      if (!getUsage) {
        await ctx.sendMessage(
          '📊 **上下文可视化**\n---\n' +
          '当前无可用的上下文数据。',
        );
        return;
      }

      const usage = getUsage();
      const ratio = usage.total > 0 ? usage.used / usage.total : 0;
      const barLen = 20;
      const filled = Math.round(ratio * barLen);
      const empty = barLen - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      const percent = (ratio * 100).toFixed(1);

      const lines = [
        '📊 **上下文窗口使用情况**',
        '---',
        `[${bar}] ${percent}%`,
        `使用: ${usage.used.toLocaleString()} / ${usage.total.toLocaleString()} tokens`,
        `消息数量: ${usage.messages}`,
        '---',
        usage.tokensByRole
          ? Object.entries(usage.tokensByRole)
              .map(([role, count]) => `  • ${role}: ${count.toLocaleString()} tokens`)
              .join('\n')
          : '',
      ];
      await ctx.sendMessage(lines.filter(Boolean).join('\n'));
    },
  };
}
