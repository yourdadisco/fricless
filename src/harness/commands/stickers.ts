/**
 * Stickers Command — 管理对话贴纸
 *
 * 对应斜杠命令:
 *   /stickers [list|add|remove] — 管理对话贴纸
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface Sticker {
  emoji: string;
  label: string;
}

const AVAILABLE_STICKERS: Sticker[] = [
  { emoji: '⭐', label: '重要' },
  { emoji: '❓', label: '待解决' },
  { emoji: '✅', label: '已完成' },
  { emoji: '📌', label: '已固定' },
  { emoji: '🔥', label: '紧急' },
  { emoji: '💡', label: '灵感' },
];

export function createStickersCommand(
  getStickers?: () => Sticker[],
  addSticker?: (emoji: string) => Promise<void>,
  removeSticker?: (emoji: string) => Promise<void>,
): CommandDef {
  return {
    name: 'stickers',
    aliases: ['sticker', 'emoji-tags'],
    description: '管理对话贴纸标签',
    usage: '/stickers [list|add <emoji>|remove <emoji>]',
    async execute(args: string[], ctx: CommandContext) {
      const subcommand = args[0]?.toLowerCase();

      if (!subcommand || subcommand === 'list') {
        const current = getStickers?.() ?? [
          { emoji: '⭐', label: '重要' },
        ];

        const lines = [
          '🏷️ **对话贴纸**',
          '---',
          '当前贴纸:',
          current.length > 0
            ? current.map(s => `  ${s.emoji} — ${s.label}`).join('\n')
            : '  无',
          '---',
          '可用贴纸:',
          ...AVAILABLE_STICKERS.map(s => `  ${s.emoji} — ${s.label}`),
          '---',
          '使用 \`/stickers add <emoji>\` 或 \`/stickers remove <emoji>\` 管理。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      if (subcommand === 'add') {
        const emoji = args[1]?.trim();
        if (!emoji) {
          await ctx.sendMessage('请指定要添加的 emoji。');
          return;
        }
        if (addSticker) {
          await addSticker(emoji);
        }
        await ctx.sendMessage(`🏷️ 已添加贴纸 ${emoji}。`);
        return;
      }

      if (subcommand === 'remove' || subcommand === 'rm') {
        const emoji = args[1]?.trim();
        if (!emoji) {
          await ctx.sendMessage('请指定要移除的 emoji。');
          return;
        }
        if (removeSticker) {
          await removeSticker(emoji);
        }
        await ctx.sendMessage(`🏷️ 已移除贴纸 ${emoji}。`);
        return;
      }

      await ctx.sendMessage(`未知子命令 "${subcommand}"。可用: list, add, remove`);
    },
  };
}
