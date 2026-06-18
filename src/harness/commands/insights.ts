/**
 * Insights Command — 显示对话洞察
 *
 * 对应斜杠命令:
 *   /insights — 分析当前对话并显示洞察
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /insights 命令
 *
 * @param getMessages - 获取消息的回调
 */
export function createInsightsCommand(
  getMessages?: () => { role: string; content: string; timestamp?: Date }[],
): CommandDef {
  return {
    name: 'insights',
    aliases: ['stats-conversation', 'conversation-insights'],
    description: '显示当前对话的统计洞察',
    usage: '/insights',
    async execute(_args: string[], ctx: CommandContext) {
      const messages = getMessages?.() ?? [];

      if (messages.length === 0) {
        await ctx.sendMessage('当前会话没有消息，无法生成洞察。');
        return;
      }

      const userMsgs = messages.filter(m => m.role === 'user');
      const assistantMsgs = messages.filter(m => m.role === 'assistant' || m.role === 'ai');
      const toolMsgs = messages.filter(m => m.role === 'tool');
      const totalChars = messages.reduce((s, m) => s + m.content.length, 0);
      const avgUserLen = userMsgs.length > 0
        ? Math.round(userMsgs.reduce((s, m) => s + m.content.length, 0) / userMsgs.length)
        : 0;
      const avgAssistantLen = assistantMsgs.length > 0
        ? Math.round(assistantMsgs.reduce((s, m) => s + m.content.length, 0) / assistantMsgs.length)
        : 0;

      const duration = messages.length > 1 && messages[0].timestamp && messages[messages.length - 1].timestamp
        ? Math.round((messages[messages.length - 1].timestamp!.getTime() - messages[0].timestamp!.getTime()) / 1000)
        : null;

      const lines = [
        '🔍 **对话洞察**',
        '---',
        `👤 用户消息: ${userMsgs.length} 条`,
        `🤖 AI 回复: ${assistantMsgs.length} 条`,
        `🔧 工具调用: ${toolMsgs.length} 次`,
        `📏 总字符数: ${totalChars.toLocaleString()}`,
        `📝 平均用户消息长度: ${avgUserLen} 字符`,
        `📝 平均 AI 回复长度: ${avgAssistantLen} 字符`,
        duration !== null ? `⏱ 对话时长: ${formatDuration(duration)}` : '',
        `📊 用户/AI 比例: ${userMsgs.length}:${assistantMsgs.length}`,
        '---',
        '使用 `/summary` 生成对话摘要。',
      ];
      await ctx.sendMessage(lines.filter(Boolean).join('\n'));
    },
  };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 60) {
    const h = Math.floor(m / 60);
    return `${h} 小时 ${m % 60} 分`;
  }
  return `${m} 分 ${s} 秒`;
}
