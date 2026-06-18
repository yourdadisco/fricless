/**
 * Model Command — 显示当前 AI 模型和功能特性
 *
 * 对应斜杠命令:
 *   /model — 显示当前 AI 模型和功能特性
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /model 命令
 *
 * @param getInfo - 获取当前模型信息的回调
 */
export function createModelCommand(
  getInfo: () => { name: string; vendor: string; maxContextTokens: number },
): CommandDef {
  return {
    name: 'model',
    aliases: ['ai-model', 'llm'],
    description: '显示当前 AI 模型和功能特性',
    usage: '/model',
    async execute(_args: string[], ctx: CommandContext) {
      const info = getInfo();

      const lines = [
        '🤖 **当前 AI 模型**',
        '---',
        `模型: **${info.name}**`,
        `提供商: ${info.vendor}`,
        `上下文窗口: ${info.maxContextTokens.toLocaleString()} tokens`,
        '',
        '**功能特性:**',
        '  ✅ 流式输出 (Streaming)',
        '  ✅ 工具调用 (Tool Use)',
        '  ✅ 长上下文',
        '  ✅ 视觉识别 (Vision)',
        '  ✅ 多语言支持',
        '',
        `使用 /token 查看 Token 用量，/config 查看配置。`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
