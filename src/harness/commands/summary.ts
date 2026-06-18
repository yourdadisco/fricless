/**
 * Summary Command — 总结当前对话
 *
 * 对应斜杠命令:
 *   /summary — 生成当前会话的摘要
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /summary 命令
 *
 * @param getMessages - 获取消息的回调
 * @param generateSummary - 生成摘要的回调
 */
export function createSummaryCommand(
  getMessages?: () => { role: string; content: string }[],
  generateSummary?: (messages: { role: string; content: string }[]) => Promise<string>,
): CommandDef {
  return {
    name: 'summary',
    aliases: ['summarize', 'digest'],
    description: '生成当前会话的摘要',
    usage: '/summary',
    async execute(_args: string[], ctx: CommandContext) {
      const messages = getMessages?.() ?? [];

      if (messages.length === 0) {
        await ctx.sendMessage('当前会话没有消息，无法生成摘要。');
        return;
      }

      if (generateSummary) {
        try {
          const summary = await generateSummary(messages);
          const lines = [
            '📝 **对话摘要**',
            '---',
            summary,
            '---',
            `基于 ${messages.length} 条消息生成。`,
          ];
          await ctx.sendMessage(lines.join('\n'));
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`生成摘要失败: ${msg}`);
          return;
        }
      }

      // 内置简单摘要
      const userMsgs = messages.filter(m => m.role === 'user');
      const assistantMsgs = messages.filter(m => m.role === 'assistant');
      const totalChars = messages.reduce((s, m) => s + m.content.length, 0);

      const lines = [
        '📝 **对话摘要**',
        '---',
        `📊 总消息数: ${messages.length}`,
        `👤 用户消息: ${userMsgs.length} 条`,
        `🤖 AI 回复: ${assistantMsgs.length} 条`,
        `📏 总字符数: ${totalChars.toLocaleString()}`,
        '',
        '**最近主题:**',
        ...messages.slice(-4).map(m => {
          const preview = m.content.length > 100
            ? m.content.substring(0, 100) + '...'
            : m.content;
          const icon = m.role === 'user' ? '👤' : '🤖';
          return `  ${icon} ${preview}`;
        }),
        '---',
        '使用 `/save` 保存完整会话。',
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
