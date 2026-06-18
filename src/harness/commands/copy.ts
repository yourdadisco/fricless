/**
 * Copy Command — 复制最后回复到剪贴板（CLI 模式）
 *
 * 对应斜杠命令:
 *   /copy — 复制最后一条 AI 回复到剪贴板
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /copy 命令
 *
 * @param getLastResponse - 获取最后一条回复
 * @param copyToClipboard - 复制到剪贴板
 */
export function createCopyCommand(
  getLastResponse?: () => string | null,
  copyToClipboard?: (text: string) => Promise<boolean>,
): CommandDef {
  return {
    name: 'copy',
    aliases: ['clipboard', 'copy-last', 'cp'],
    description: '复制最后一条回复到剪贴板（CLI 模式）',
    usage: '/copy',
    async execute(args: string[], ctx: CommandContext) {
      const lastResponse = getLastResponse?.();
      if (!lastResponse) {
        await ctx.sendMessage('当前没有可复制的回复。');
        return;
      }

      if (copyToClipboard) {
        try {
          const ok = await copyToClipboard(lastResponse);
          if (ok) {
            await ctx.sendMessage(`📋 已复制最后一条回复到剪贴板（${lastResponse.length} 字符）。`);
          } else {
            await ctx.sendMessage('复制到剪贴板失败。');
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`复制失败: ${msg}`);
        }
      } else {
        const preview = lastResponse.length > 300
          ? lastResponse.substring(0, 300) + '...'
          : lastResponse;
        const lines = [
          '📋 **复制内容 (预览)**',
          '---',
          `\`\`\`\n${preview}\n\`\`\``,
          '---',
          `共 ${lastResponse.length} 字符。`,
          '（当前环境未接入剪贴板，仅显示预览）',
        ];
        await ctx.sendMessage(lines.join('\n'));
      }
    },
  };
}
