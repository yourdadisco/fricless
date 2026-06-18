/**
 * Onboarding Command — 显示新手指南
 *
 * 对应斜杠命令:
 *   /onboarding — 显示新手指南/快速入门
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createOnboardingCommand(): CommandDef {
  return {
    name: 'onboarding',
    aliases: ['welcome', 'guide', 'getting-started', 'tutorial'],
    description: '显示新手指南和快速入门信息',
    usage: '/onboarding',
    async execute(_args: string[], ctx: CommandContext) {
      const lines = [
        '🎉 **欢迎使用 Fricless！**',
        '---',
        '**快速入门:**',
        '',
        '1. **发送消息** — 直接输入文字与 AI 对话',
        '2. **斜杠命令** — 使用 / 开头执行命令',
        '3. **代码编辑** — AI 可以直接编辑你的代码',
        '',
        '**常用命令:**',
        '  • \`/help\` — 查看所有命令',
        '  • \`/clear\` — 清空对话',
        '  • \`/init\` — 初始化项目',
        '  • \`/config\` — 配置设置',
        '',
        '**提示:**',
        '  • 使用 \`Ctrl+Enter\` 发送消息',
        '  • 使用 \`Tab\` 自动补全命令',
        '  • 输入 / 查看命令建议',
        '---',
        '更多信息: https://fricless.dev/docs',
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
