/**
 * Keybindings Command — 显示键盘快捷键
 *
 * 对应斜杠命令:
 *   /keybindings — 显示键盘快捷键列表
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

const DEFAULT_KEYBINDINGS = [
  { key: 'Ctrl+Enter', action: '发送消息' },
  { key: 'Ctrl+C', action: '中断当前操作' },
  { key: 'Ctrl+L', action: '清屏' },
  { key: 'Ctrl+D', action: '退出' },
  { key: 'Up/Down', action: '浏览命令历史' },
  { key: 'Tab', action: '自动补全命令' },
  { key: 'Ctrl+Shift+F', action: '搜索' },
  { key: 'Ctrl+Shift+P', action: '命令面板' },
];

export function createKeybindingsCommand(
  getKeybindings?: () => { key: string; action: string }[],
): CommandDef {
  return {
    name: 'keybindings',
    aliases: ['keys', 'shortcuts', 'hotkeys'],
    description: '显示键盘快捷键列表',
    usage: '/keybindings',
    async execute(_args: string[], ctx: CommandContext) {
      const bindings = getKeybindings?.() ?? DEFAULT_KEYBINDINGS;

      const lines = [
        '⌨️ **键盘快捷键**',
        '---',
        ...bindings.map(b => `  • \`${b.key}\` — ${b.action}`),
        '---',
        '在配置文件中自定义快捷键: `.claude/keybindings.json`',
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
