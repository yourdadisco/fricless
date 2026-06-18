/**
 * RateLimitOptions Command — 速率限制配置
 *
 * 对应斜杠命令:
 *   /rate_limit_options [view|set] — 管理速率限制配置
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface RateLimitConfig {
  name: string;
  maxPerMinute: number;
  current: number;
}

export function createRateLimitOptionsCommand(
  getConfig?: () => RateLimitConfig[],
  setLimit?: (name: string, max: number) => Promise<void>,
): CommandDef {
  return {
    name: 'rate_limit_options',
    aliases: ['rate-limit', 'rate-limit-config', 'throttle'],
    description: '查看和配置速率限制',
    usage: '/rate_limit_options [view|set <name> <max>]',
    async execute(args: string[], ctx: CommandContext) {
      const subcommand = args[0]?.toLowerCase();

      if (!subcommand || subcommand === 'view' || subcommand === 'list') {
        const configs = getConfig?.() ?? [
          { name: 'api-calls', maxPerMinute: 60, current: 12 },
          { name: 'tokens', maxPerMinute: 100000, current: 25000 },
        ];

        const lines = [
          '⏱️ **速率限制配置**',
          '---',
          ...configs.map(c =>
            `  • \`${c.name}\`: ${c.current}/${c.maxPerMinute} 每分钟`,
          ),
          '---',
          '使用 \`/rate_limit_options set <name> <max>\` 修改限制。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      if (subcommand === 'set') {
        const name = args[1];
        const max = parseInt(args[2], 10);

        if (!name || isNaN(max) || max < 0) {
          await ctx.sendMessage('用法: `/rate_limit_options set <name> <max>`');
          return;
        }

        if (setLimit) {
          try {
            await setLimit(name, max);
            await ctx.sendMessage(`⏱️ 速率限制 \`${name}\` 已设置为 ${max}/分钟。`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await ctx.sendMessage(`设置失败: ${msg}`);
          }
        } else {
          await ctx.sendMessage(`⏱️ 速率限制 \`${name}\` 已设置为 ${max}/分钟（模拟）。`);
        }
        return;
      }

      await ctx.sendMessage(`未知子命令 "${subcommand}"。可用: view, set`);
    },
  };
}
