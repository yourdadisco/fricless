/**
 * Env Command — 显示环境变量（安全模式）
 *
 * 对应斜杠命令:
 *   /env [变量名] — 显示安全的环境变量信息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /env 命令
 *
 * @param getSafeEnv - 获取安全环境变量的回调
 */
export function createEnvCommand(
  getSafeEnv?: () => Record<string, string>,
): CommandDef {
  return {
    name: 'env',
    aliases: ['environment', 'env-vars'],
    description: '显示安全的环境变量信息',
    usage: '/env [变量名]',
    async execute(args: string[], ctx: CommandContext) {
      const safeEnv = getSafeEnv?.() ?? {
        NODE_ENV: 'development',
        PLATFORM: 'win32',
        LANG: 'zh-CN',
        SHELL: 'powershell',
        CLAUDE_CODE_VERSION: '1.0.0',
      };

      const keys = args.filter(a => !a.startsWith('-'));
      const showAll = args.includes('--all') || args.includes('-a');

      if (keys.length > 0) {
        const entries = keys.map(k => {
          const val = safeEnv[k];
          return val !== undefined
            ? `  • **${k}**: \`${val}\``
            : `  • **${k}**: (未设置)`;
        });
        await ctx.sendMessage([
          '🌐 **环境变量**',
          '---',
          ...entries,
          '---',
          '仅显示安全变量，敏感信息已隐藏。',
        ].join('\n'));
        return;
      }

      const filtered = showAll
        ? Object.entries(safeEnv)
        : Object.entries(safeEnv).slice(0, 10);

      const lines = [
        '🌐 **环境变量**',
        '---',
        ...filtered.map(([k, v]) => `  • **${k}**: \`${v}\``),
        ...(filtered.length < Object.keys(safeEnv).length ? ['', `... 还有 ${Object.keys(safeEnv).length - filtered.length} 项`] : []),
        '---',
        '使用 `/env <变量名>` 查看单项，`/env --all` 查看全部。',
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
