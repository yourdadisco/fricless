/**
 * Login Command — 身份认证占位
 *
 * 对应斜杠命令:
 *   /login [token] — 登录/认证
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createLoginCommand(
  loginFn?: (token?: string) => Promise<{ success: boolean; message: string }>,
): CommandDef {
  return {
    name: 'login',
    aliases: ['signin', 'auth', 'authenticate'],
    description: '登录/身份认证',
    usage: '/login [token]',
    async execute(args: string[], ctx: CommandContext) {
      const token = args.join(' ').trim() || undefined;

      if (loginFn) {
        try {
          const result = await loginFn(token);
          if (result.success) {
            await ctx.sendMessage(`🔑 登录成功。${result.message}`);
          } else {
            await ctx.sendMessage(`🔑 登录失败: ${result.message}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`登录失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(
          '🔑 **登录**\n---\n' +
          '当前认证系统未配置。\n\n' +
          '请设置 \`AUTH_TOKEN\` 环境变量或使用 \`/login <token>\` 进行认证。',
        );
      }
    },
  };
}
