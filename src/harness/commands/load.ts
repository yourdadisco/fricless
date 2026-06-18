/**
 * Load Command — 从 JSON 文件加载会话
 *
 * 对应斜杠命令:
 *   /load <文件名> — 从 JSON 文件加载会话
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /load 命令
 *
 * @param loadFromFile - 加载文件的回调
 * @param restoreSession - 恢复会话的回调
 */
export function createLoadCommand(
  loadFromFile?: (filename: string) => Promise<unknown>,
  restoreSession?: (data: unknown) => Promise<string>,
): CommandDef {
  return {
    name: 'load',
    aliases: ['load-session', 'import-session'],
    description: '从 JSON 文件加载会话',
    usage: '/load <文件名>',
    async execute(args: string[], ctx: CommandContext) {
      const filename = args[0]?.trim();
      if (!filename) {
        await ctx.sendMessage('请指定要加载的文件名。用法: `/load <文件名>`');
        return;
      }

      try {
        if (!loadFromFile || !restoreSession) {
          await ctx.sendMessage('当前环境不支持加载会话文件。');
          return;
        }

        const data = await loadFromFile(filename);
        const sessionId = await restoreSession(data);
        await ctx.sendMessage(`✅ 会话已从 \`${filename}\` 加载。新会话 ID: \`${sessionId}\``);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.sendMessage(`加载失败: ${msg}`);
      }
    },
  };
}
