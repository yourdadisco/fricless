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
 * @param options - 可选的模型信息覆盖
 */
export function createModelCommand(options?: { modelName?: string; features?: string[] }): CommandDef {
  return {
    name: 'model',
    aliases: ['ai-model', 'llm'],
    description: '显示当前 AI 模型和功能特性',
    usage: '/model',
    async execute(_args: string[], ctx: CommandContext) {
      const model = options?.modelName ?? 'claude-3-opus-20240229';
      const features = options?.features ?? [
        '流式输出 (Streaming)',
        '工具调用 (Tool Use)',
        '长上下文 200K',
        '视觉识别 (Vision)',
        '多语言支持',
      ];

      const lines = [
        '🤖 **当前 AI 模型**',
        '---',
        `模型: **${model}**`,
        `提供商: Anthropic`,
        `上下文窗口: 200,000 tokens`,
        '',
        '**功能特性:**',
        ...features.map(f => `  ✅ ${f}`),
        '',
        `使用 /token 查看 Token 用量，/config 查看配置。`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
