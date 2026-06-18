/**
 * Feedback Command — 发送反馈
 *
 * 对应斜杠命令:
 *   /feedback <内容> — 发送反馈信息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /feedback 命令
 *
 * @param submitFeedback - 提交反馈的回调（可选）
 */
export function createFeedbackCommand(
  submitFeedback?: (content: string, ctx: CommandContext) => Promise<void>,
): CommandDef {
  return {
    name: 'feedback',
    aliases: ['report', 'issue'],
    description: '发送反馈',
    usage: '/feedback <反馈内容>',
    async execute(args: string[], ctx: CommandContext) {
      const content = args.join(' ').trim();
      if (!content) {
        await ctx.sendMessage('请提供反馈内容。用法: `/feedback <反馈内容>`');
        return;
      }

      if (submitFeedback) {
        try {
          await submitFeedback(content, ctx);
          await ctx.sendMessage('💬 感谢您的反馈！已成功提交。');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`反馈提交失败: ${msg}`);
        }
      } else {
        const lines = [
          '💬 **反馈已记录**',
          '---',
          `内容: ${content}`,
          `用户: \`${ctx.userId}\``,
          `会话: \`${ctx.sessionId.substring(0, 8)}…\``,
          `时间: ${new Date().toISOString()}`,
          '---',
          '（当前环境未接入反馈系统，以上为本地记录）',
        ];
        await ctx.sendMessage(lines.join('\n'));
      }
    },
  };
}
