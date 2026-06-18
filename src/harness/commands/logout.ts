/**
 * Logout Command — 登出/取消认证
 *
 * 对应斜杠命令:
 *   /logout — 登出当前会话
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createLogoutCommand(
  logoutFn?: () => Promise<void>,
): CommandDef {
  return {
    name: 'logout',
    aliases: ['signout', 'deauth', 'deauthenticate'],
    description: '登出当前会话',
    usage: '/logout',
    async execute(_args: string[], ctx: CommandContext) {
      if (logoutFn) {
        try {
          await logoutFn();
          await ctx.sendMessage('🔒 已成功登出。');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`登出失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage('🔒 已登出（模拟）。');
      }
    },
  };
}
