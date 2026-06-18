/**
 * OauthRefresh Command — 刷新 OAuth 令牌
 *
 * 对应斜杠命令:
 *   /oauth_refresh — 刷新 OAuth 认证令牌
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createOauthRefreshCommand(
  refreshToken?: () => Promise<{ success: boolean; message: string }>,
): CommandDef {
  return {
    name: 'oauth_refresh',
    aliases: ['refresh-token', 'token-refresh'],
    description: '刷新 OAuth 认证令牌',
    usage: '/oauth_refresh',
    async execute(_args: string[], ctx: CommandContext) {
      if (refreshToken) {
        try {
          const result = await refreshToken();
          if (result.success) {
            await ctx.sendMessage(`🔄 OAuth 令牌已刷新。${result.message}`);
          } else {
            await ctx.sendMessage(`🔄 令牌刷新失败: ${result.message}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`令牌刷新失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(
          '🔄 **OAuth 刷新**\n---\n' +
          '当前未配置 OAuth 认证。\n\n' +
          '使用 \`/login\` 进行认证，或配置环境变量。',
        );
      }
    },
  };
}
