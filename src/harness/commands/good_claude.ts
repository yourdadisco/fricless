/**
 * GoodClaude Command — 向 Claude 发送反馈
 *
 * 对应斜杠命令:
 *   /good_claude <反馈内容> — 发送反馈给 Claude
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createGoodClaudeCommand(
  submitFeedback?: (feedback: string) => Promise<void>,
): CommandDef {
  return {
    name: 'good_claude',
    aliases: ['feedback-claude', 'claude-feedback', 'praise'],
    description: '向 Claude 发送反馈（好评/建议）',
    usage: '/good_claude <反馈内容>',
    async execute(args: string[], ctx: CommandContext) {
      const feedback = args.join(' ').trim();

      if (!feedback) {
        await ctx.sendMessage(
          '💬 **反馈**\n---\n' +
          '分享你的想法帮助改进 Claude。\n\n' +
          '用法: `/good_claude <反馈内容>`',
        );
        return;
      }

      if (submitFeedback) {
        try {
          await submitFeedback(feedback);
          await ctx.sendMessage('✅ 感谢你的反馈！我们会持续改进。');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`提交反馈失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage('✅ 感谢你的反馈！已记录（模拟）。');
      }
    },
  };
}
