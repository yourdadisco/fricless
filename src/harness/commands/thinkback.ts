/**
 * Thinkback Command — 回顾过去的决策
 *
 * 对应斜杠命令:
 *   /thinkback [query] — 回顾 AI 之前的决策和推理
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface Decision {
  id: string;
  timestamp: Date;
  context: string;
  decision: string;
  rationale: string;
}

export function createThinkbackCommand(
  getDecisions?: (query?: string) => Decision[],
): CommandDef {
  return {
    name: 'thinkback',
    aliases: ['recall-decision', 'history-reasoning', 'past-decisions'],
    description: '回顾 AI 过去的决策和推理过程',
    usage: '/thinkback [关键词]',
    async execute(args: string[], ctx: CommandContext) {
      const query = args.join(' ').trim() || undefined;

      if (getDecisions) {
        const decisions = getDecisions(query);
        if (decisions.length === 0) {
          await ctx.sendMessage(
            query
              ? `没有找到与 "${query}" 相关的决策记录。`
              : '暂无决策记录。',
          );
          return;
        }

        const lines = [
          '🤔 **决策回顾**',
          query ? `搜索: "${query}"` : '',
          '---',
          ...decisions.map(d =>
            `**#${d.id}** (${d.timestamp.toLocaleString()})\n` +
            `背景: ${d.context}\n` +
            `决策: ${d.decision}\n` +
            `理由: ${d.rationale}`,
          ),
        ];
        await ctx.sendMessage(lines.filter(Boolean).join('\n'));
      } else {
        const sampleDecisions: Decision[] = [
          {
            id: '1',
            timestamp: new Date(),
            context: '项目初始化',
            decision: '使用 TypeScript',
            rationale: '类型安全性和更好的开发体验',
          },
        ];

        const lines = [
          '🤔 **决策回顾（模拟）**',
          '---',
          ...sampleDecisions.map(d =>
            `**#${d.id}** (${d.timestamp.toLocaleString()})\n` +
            `背景: ${d.context}\n` +
            `决策: ${d.decision}\n` +
            `理由: ${d.rationale}`,
          ),
          '---',
          '启用决策日志以跟踪真实决策。',
        ];
        await ctx.sendMessage(lines.filter(Boolean).join('\n'));
      }
    },
  };
}
