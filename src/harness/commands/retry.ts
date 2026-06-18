/**
 * Retry Command — 重新执行上一次 AI 请求
 *
 * 对应斜杠命令:
 *   /retry — 使用相同的上下文重新发送上一次 AI 请求
 *
 * 此命令需要一个 retryHandler 回调，由调用方（Harness 创建者）提供。
 * retryHandler 通常会从 Session 中取最后一条用户消息并重新触发对话循环。
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /retry 命令
 *
 * @param retryHandler - 执行重试逻辑的回调函数
 */
export function createRetryCommand(retryHandler?: () => Promise<void>): CommandDef {
  return {
    name: 'retry',
    aliases: ['redo', 'try-again'],
    description: '重新执行上一次 AI 请求',
    usage: '/retry',
    async execute(_args: string[], ctx: CommandContext) {
      if (!retryHandler) {
        await ctx.sendMessage('重试功能不可用（未注册重试处理器）。');
        return;
      }

      await ctx.sendMessage('🔄 正在重新处理上次请求...');
      try {
        await retryHandler();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.sendMessage(`重试失败: ${msg}`);
      }
    },
  };
}
