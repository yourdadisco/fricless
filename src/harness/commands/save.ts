/**
 * Save Command — 将会话保存到 JSON 文件
 *
 * 对应斜杠命令:
 *   /save [文件名] — 保存当前会话到 JSON 文件
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /save 命令
 *
 * @param getSessionData - 获取当前会话数据的回调
 * @param saveToFile - 保存数据的回调（返回文件路径）
 */
export function createSaveCommand(
  getSessionData?: () => unknown,
  saveToFile?: (data: unknown, filename?: string) => Promise<string>,
): CommandDef {
  return {
    name: 'save',
    aliases: ['save-session', 'export-session'],
    description: '将当前会话保存到 JSON 文件',
    usage: '/save [文件名]',
    async execute(args: string[], ctx: CommandContext) {
      const data = getSessionData?.();
      if (!data) {
        await ctx.sendMessage('无会话数据可保存。');
        return;
      }

      const filename = args[0] || `session-${ctx.sessionId.substring(0, 8)}-${Date.now()}.json`;

      try {
        if (saveToFile) {
          const path = await saveToFile(data, filename);
          await ctx.sendMessage(`✅ 会话已保存到 \`${path}\``);
        } else {
          const json = JSON.stringify(data, null, 2);
          const preview = json.length > 500 ? json.substring(0, 500) + '\n...' : json;
          const lines = [
            '📥 **会话数据 (预览)**',
            '---',
            `\`\`\`json\n${preview}\n\`\`\``,
            '---',
            `文件: ${filename} | 大小: ${(json.length / 1024).toFixed(1)} KB`,
            '（当前环境未启用文件写入，仅显示预览）',
          ];
          await ctx.sendMessage(lines.join('\n'));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.sendMessage(`保存失败: ${msg}`);
      }
    },
  };
}
