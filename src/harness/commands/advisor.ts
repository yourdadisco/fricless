/**
 * Advisor Command — 获取 AI 最佳实践建议
 *
 * 对应斜杠命令:
 *   /advisor [主题] — 获取关于某个主题的最佳实践建议
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createAdvisorCommand(
  getAdvice?: (topic: string) => Promise<string>,
): CommandDef {
  return {
    name: 'advisor',
    aliases: ['advice', 'best-practices', 'tip'],
    description: '获取 AI 最佳实践建议',
    usage: '/advisor [主题]',
    async execute(args: string[], ctx: CommandContext) {
      const topic = args.join(' ').trim();

      if (!topic) {
        const lines = [
          '💡 **最佳实践顾问**',
          '---',
          '提供关于以下主题的建议:',
          '  • 代码审查流程',
          '  • 提示词工程',
          '  • 对话管理',
          '  • 工具使用模式',
          '---',
          '使用 `/advisor <主题>` 获取针对性建议。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      if (getAdvice) {
        try {
          const advice = await getAdvice(topic);
          await ctx.sendMessage(`💡 **关于 "${topic}" 的建议**\n---\n${advice}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`获取建议失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(
          `💡 **关于 "${topic}" 的建议（模拟）**\n\n` +
          `1. 将复杂任务分解为小步骤\n` +
          `2. 使用明确的命名规范\n` +
          `3. 定期进行代码审查\n` +
          `4. 编写自动化测试\n` +
          `5. 保持文档与代码同步`,
        );
      }
    },
  };
}
