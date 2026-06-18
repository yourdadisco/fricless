/**
 * Plugins Command — 列出已加载的插件
 *
 * 对应斜杠命令:
 *   /plugins — 显示所有已加载的插件列表
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /plugins 命令
 *
 * @param getPlugins - 获取插件列表的回调（可选）
 */
export function createPluginsCommand(
  getPlugins?: () => { name: string; version: string; enabled: boolean; description?: string }[],
): CommandDef {
  return {
    name: 'plugins',
    aliases: ['plugin-list', 'extensions'],
    description: '列出所有已加载的插件',
    usage: '/plugins',
    async execute(_args: string[], ctx: CommandContext) {
      const plugins = getPlugins?.() ?? [
        { name: 'core', version: '1.0.0', enabled: true, description: '核心功能插件' },
        { name: 'tools', version: '1.0.0', enabled: true, description: '工具调用支持' },
        { name: 'memory', version: '0.5.0', enabled: false, description: '记忆存储系统' },
      ];

      if (plugins.length === 0) {
        await ctx.sendMessage('当前没有加载任何插件。');
        return;
      }

      const enabled = plugins.filter(p => p.enabled);
      const disabled = plugins.filter(p => !p.enabled);

      const lines = [
        '🧩 **插件列表**',
        '---',
        `**已启用 (${enabled.length})**`,
        ...enabled.map(p => {
          const desc = p.description ? ` — ${p.description}` : '';
          return `  • **${p.name}** v${p.version}${desc}`;
        }),
        ...(disabled.length > 0 ? [
          '',
          `**已禁用 (${disabled.length})**`,
          ...disabled.map(p => {
            const desc = p.description ? ` — ${p.description}` : '';
            return `  • ~~${p.name}~~ v${p.version}${desc}`;
          }),
        ] : []),
        '---',
        `共 ${plugins.length} 个插件。`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
