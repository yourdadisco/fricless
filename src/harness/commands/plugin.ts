/**
 * Plugin Command — 管理单个插件
 *
 * 对应斜杠命令:
 *   /plugin <name> [enable|disable|info] — 管理特定插件
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface PluginInfo {
  name: string;
  version: string;
  enabled: boolean;
  description: string;
}

export function createPluginCommand(
  getPlugin?: (name: string) => PluginInfo | undefined,
  setPluginEnabled?: (name: string, enabled: boolean) => Promise<void>,
  listPlugins?: () => PluginInfo[],
): CommandDef {
  return {
    name: 'plugin',
    aliases: ['plugin-manage', 'plugin-info'],
    description: '管理单个插件的启用/禁用和查看信息',
    usage: '/plugin <name> [enable|disable|info]',
    async execute(args: string[], ctx: CommandContext) {
      const subcommand = args[0]?.toLowerCase();

      if (!subcommand || subcommand === 'list') {
        const plugins = listPlugins?.() ?? [
          { name: 'code-analysis', version: '1.0.0', enabled: true, description: '代码分析工具' },
          { name: 'web-search', version: '1.2.0', enabled: false, description: '网络搜索集成' },
        ];

        const lines = [
          '🔌 **插件列表**',
          '---',
          ...plugins.map(p =>
            `${p.enabled ? '🟢' : '⚪'} \`${p.name}\` v${p.version} — ${p.description}`,
          ),
          '---',
          '使用 `/plugin <name> [enable|disable]` 管理插件。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      const action = args[1]?.toLowerCase();
      const plugin = getPlugin?.(subcommand);

      if (!action || action === 'info') {
        if (plugin) {
          const lines = [
            `🔌 **插件: \`${plugin.name}\`**`,
            '---',
            `版本: ${plugin.version}`,
            `状态: ${plugin.enabled ? '🟢 已启用' : '⚪ 已禁用'}`,
            `描述: ${plugin.description}`,
          ];
          await ctx.sendMessage(lines.join('\n'));
        } else {
          await ctx.sendMessage(`未找到插件 "${subcommand}"。使用 \`/plugin list\` 查看所有插件。`);
        }
        return;
      }

      if (action === 'enable' || action === 'disable') {
        if (!plugin) {
          await ctx.sendMessage(`未找到插件 "${subcommand}"。`);
          return;
        }

        const enabled = action === 'enable';
        if (setPluginEnabled) {
          try {
            await setPluginEnabled(subcommand, enabled);
            await ctx.sendMessage(`🔌 插件 \`${subcommand}\` 已${enabled ? '启用' : '禁用'}。`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await ctx.sendMessage(`操作失败: ${msg}`);
          }
        } else {
          await ctx.sendMessage(`🔌 插件 \`${subcommand}\` 已${enabled ? '启用' : '禁用'}（模拟）。`);
        }
        return;
      }

      await ctx.sendMessage(`未知操作 "${action}"。可用: enable, disable, info`);
    },
  };
}
