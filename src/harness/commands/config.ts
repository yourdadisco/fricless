/**
 * Config Command — 显示配置信息
 *
 * 对应斜杠命令:
 *   /config [key] — 显示全部或指定配置项
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /config 命令
 *
 * @param getConfig - 获取配置对象的回调
 */
export function createConfigCommand(getConfig?: () => Record<string, unknown>): CommandDef {
  return {
    name: 'config',
    aliases: ['configuration', 'settings'],
    description: '显示系统配置信息',
    usage: '/config [配置键]',
    async execute(args: string[], ctx: CommandContext) {
      const config = getConfig?.() ?? {
        theme: 'dark',
        language: 'zh-CN',
        permissionMode: 'confirm',
        maxTokens: 4096,
        temperature: 0.7,
        logLevel: 'info',
      };

      const keys = args.filter(a => !a.startsWith('-'));
      const verbose = args.includes('--verbose') || args.includes('-v');

      if (keys.length > 0) {
        const entries = keys.map(k => {
          const val = (config as Record<string, unknown>)[k];
          return val !== undefined ? `  • **${k}**: \`${JSON.stringify(val)}\`` : `  • **${k}**: (未设置)`;
        });
        await ctx.sendMessage([
          `⚙️ **配置项**`,
          '---',
          ...entries,
        ].join('\n'));
        return;
      }

      const lines = [
        '⚙️ **系统配置**',
        '---',
        ...Object.entries(config).map(([k, v]) => {
          const display = typeof v === 'object' && !verbose
            ? `${JSON.stringify(v).substring(0, 60)}...`
            : JSON.stringify(v);
          return `  • **${k}**: \`${display}\``;
        }),
        '---',
        `共 ${Object.keys(config).length} 项。使用 /config <key> 查看单项。`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
