/**
 * TerminalSetup Command — 终端配置信息
 *
 * 对应斜杠命令:
 *   /terminal_setup — 显示终端配置信息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createTerminalSetupCommand(): CommandDef {
  return {
    name: 'terminal_setup',
    aliases: ['terminal-setup', 'term-config', 'terminal-config'],
    description: '显示终端配置和优化指南',
    usage: '/terminal_setup',
    async execute(_args: string[], ctx: CommandContext) {
      const lines = [
        '🖥️ **终端配置**',
        '---',
        '**推荐终端:**',
        '  • Windows Terminal — 推荐',
        '  • iTerm2 (macOS)',
        '  • Alacritty (跨平台)',
        '',
        '**推荐字体 (Nerd Font):**',
        '  • JetBrains Mono Nerd Font',
        '  • FiraCode Nerd Font',
        '  • Meslo Nerd Font',
        '',
        '**环境变量:**',
        '  • \`FRICLESS_THEME\` — 设置主题',
        '  • \`FRICLESS_EDITOR\` — 默认编辑器',
        '  • \`FRICLESS_COLOR\` — 颜色模式 (truecolor/256/16)',
        '',
        '**快捷键:**',
        '  • \`/keybindings\` 查看所有快捷键',
        '---',
        '更多信息: https://fricless.dev/docs/terminal',
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
