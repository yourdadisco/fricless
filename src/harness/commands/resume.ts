/**
 * Resume Command — 恢复上次对话
 *
 * 对应斜杠命令:
 *   /resume [会话ID] — 恢复指定或上次的会话
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /resume 命令
 *
 * @param getLastSession - 获取上次会话 ID
 * @param resumeSession - 恢复会话的回调
 */
export function createResumeCommand(
  getLastSession?: () => string | null,
  resumeSession?: (sessionId: string) => Promise<void>,
): CommandDef {
  return {
    name: 'resume',
    aliases: ['continue', 'recover'],
    description: '恢复上次对话',
    usage: '/resume [会话ID]',
    async execute(args: string[], ctx: CommandContext) {
      const targetId = args[0]?.trim() || getLastSession?.() || null;

      if (!targetId) {
        await ctx.sendMessage([
          '🔄 **恢复会话**',
          '---',
          '没有找到上次的会话记录。',
          '',
          '用法:',
          '  • `/resume` — 恢复上次会话',
          '  • `/resume <会话ID>` — 恢复指定会话',
          '',
          '使用 `/history` 查看最近的会话列表。',
        ].join('\n'));
        return;
      }

      if (resumeSession) {
        try {
          await resumeSession(targetId);
          await ctx.sendMessage(`🔄 已恢复会话 \`${targetId.substring(0, 8)}…\`。`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`恢复会话失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(`🔄 将会话 \`${targetId.substring(0, 8)}…\` 标记为继续中（模拟）。`);
      }
    },
  };
}
