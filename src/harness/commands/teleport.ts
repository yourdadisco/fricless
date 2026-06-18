/**
 * Teleport Command — 跳转到对话的某个位置
 *
 * 对应斜杠命令:
 *   /teleport <index|id> — 跳转到对话的指定位置
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createTeleportCommand(
  teleportTo?: (target: string) => Promise<{ success: boolean; message: string }>,
): CommandDef {
  return {
    name: 'teleport',
    aliases: ['jump', 'goto', 'navigate'],
    description: '跳转到对话的指定位置',
    usage: '/teleport <索引|ID>',
    async execute(args: string[], ctx: CommandContext) {
      const target = args.join(' ').trim();

      if (!target) {
        await ctx.sendMessage(
          '🌀 **对话导航**\n---\n' +
          '用法:\n' +
          '  • \`/teleport <消息索引>\` — 跳转到指定索引\n' +
          '  • \`/teleport <消息ID>\` — 跳转到指定消息\n\n' +
          '使用 \`/history\` 查看消息索引。',
        );
        return;
      }

      if (teleportTo) {
        try {
          const result = await teleportTo(target);
          if (result.success) {
            await ctx.sendMessage(`🌀 已跳转到 \`${target}\`。${result.message}`);
          } else {
            await ctx.sendMessage(`❌ 跳转失败: ${result.message}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`跳转失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(`🌀 已跳转到 \`${target}\`（模拟）。`);
      }
    },
  };
}
