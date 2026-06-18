/**
 * Context Command — 显示当前上下文信息
 *
 * 对应斜杠命令:
 *   /context — 显示当前会话的上下文信息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /context 命令
 *
 * @param getContextInfo - 获取上下文信息的回调
 */
export function createContextCommand(
  getContextInfo?: () => {
    totalTokens: number;
    usedTokens: number;
    remainingTokens: number;
    toolsCount: number;
    commandsCount: number;
    messagesCount: number;
  },
): CommandDef {
  return {
    name: 'context',
    aliases: ['ctx', 'context-info'],
    description: '显示当前会话的上下文信息',
    usage: '/context',
    async execute(_args: string[], ctx: CommandContext) {
      const info = getContextInfo?.() ?? {
        totalTokens: 200000,
        usedTokens: 15230,
        remainingTokens: 184770,
        toolsCount: 15,
        commandsCount: 22,
        messagesCount: 12,
      };

      const usagePercent = ((info.usedTokens / info.totalTokens) * 100).toFixed(1);
      const progressBar = makeProgressBar(info.usedTokens / info.totalTokens);

      const lines = [
        '📐 **上下文信息**',
        '---',
        `📊 上下文使用量:`,
        `   ${progressBar} ${usagePercent}%`,
        `   使用: ${info.usedTokens.toLocaleString()} / ${info.totalTokens.toLocaleString()} tokens`,
        `   剩余: ${info.remainingTokens.toLocaleString()} tokens`,
        '',
        `🔧 可用工具: ${info.toolsCount}`,
        `💬 可用命令: ${info.commandsCount}`,
        `💬 消息数: ${info.messagesCount}`,
        '---',
        `使用 /token 查看详细 Token 用量。`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}

function makeProgressBar(ratio: number, length: number = 20): string {
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, empty));
  return `[${bar}]`;
}
